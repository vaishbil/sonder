import crypto from "crypto";
import fs from "fs";
import path from "path";
import Server from "../models/Server.js";

const serverOwners = new Map();

export function registerServerHandlers(io, socket) {
  socket.on("join-server", async ({ code, username }) => {
    try {
      const server = await Server.findOne({ code });
      if (!server) {
        socket.emit("error-message", "Server not found");
        return;
      }

      socket.join(code);
      socket.data.serverCode = code;
      socket.data.username = username;

      if (!serverOwners.has(code)) {
        serverOwners.set(code, socket.id);
        server.ownerSocketId = socket.id;
      }

      // Remove any stale entry for this username before adding fresh —
      // prevents ghost duplicates from refreshes/reconnects
      server.members = server.members.filter((m) => m.username !== username);
      server.members.push({ socketId: socket.id, username });
      await server.save();

      const isOwner = serverOwners.get(code) === socket.id;

      socket.emit("server-state", {
        name: server.name,
        channels: server.channels,
        members: server.members,
        isOwner,
      });

      socket.to(code).emit("member-joined", {
        socketId: socket.id,
        username,
        members: server.members,
      });
    } catch (err) {
      console.error("Error in join-server:", err);
      socket.emit("error-message", "Failed to join server");
    }
  });

  socket.on("send-message", async ({ code, channelId, text, attachment, replyTo }) => {
    try {
      const server = await Server.findOne({ code });
      if (!server) return;

      const channel = server.channels.find((c) => c.channelId === channelId);
      if (!channel) return;

      const message = {
        messageId: crypto.randomUUID(),
        sender: socket.data.username || "Unknown",
        text: text || "",
        timestamp: new Date(),
        attachment: attachment || undefined,
        replyTo: replyTo || undefined,
      };
      channel.messages.push(message);

      if (channel.messages.length > 200) {
        channel.messages = channel.messages.slice(-200);
      }

      await server.save();

      io.to(code).emit("new-message", { channelId, message });
    } catch (err) {
      console.error("Error in send-message:", err);
    }
  });

  // Delete for everyone — only the original sender can do this
  socket.on("delete-message", async ({ code, channelId, messageId }) => {
    try {
      const server = await Server.findOne({ code });
      if (!server) return;

      const channel = server.channels.find((c) => c.channelId === channelId);
      if (!channel) return;

      const message = channel.messages.find((m) => m.messageId === messageId);
      if (!message) return;

      // Ownership check — only the sender can delete their own message for everyone
      if (message.sender !== socket.data.username) {
        socket.emit("error-message", "You can only delete your own messages.");
        return;
      }

      // Clean up the actual file on disk if this message had an image/attachment
      if (message.attachment?.url) {
        const filePath = path.join(process.cwd(), message.attachment.url);
        fs.unlink(filePath, (err) => {
          if (err) console.error("Failed to delete attachment file:", err.message);
        });
      }

      channel.messages = channel.messages.filter((m) => m.messageId !== messageId);
      await server.save();

      io.to(code).emit("message-deleted", { channelId, messageId });
    } catch (err) {
      console.error("Error in delete-message:", err);
    }
  });

  socket.on("typing", ({ code, channelId, username }) => {
    socket.to(code).emit("user-typing", { channelId, username });
  });

  socket.on("stop-typing", ({ code, channelId, username }) => {
    socket.to(code).emit("user-stopped-typing", { channelId, username });
  });

  socket.on("create-channel", async ({ code, name }) => {
    try {
      const ownerId = serverOwners.get(code);
      if (socket.id !== ownerId) return;

      const server = await Server.findOne({ code });
      if (!server) return;

      const channelId = name.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now().toString(36);
      const newChannel = { channelId, name, messages: [] };
      server.channels.push(newChannel);
      await server.save();

      io.to(code).emit("channel-created", newChannel);
    } catch (err) {
      console.error("Error in create-channel:", err);
    }
  });

  socket.on("delete-channel", async ({ code, channelId }) => {
    try {
      const ownerId = serverOwners.get(code);
      if (socket.id !== ownerId) return;

      const server = await Server.findOne({ code });
      if (!server) return;

      if (server.channels.length <= 1) return;

      server.channels = server.channels.filter((c) => c.channelId !== channelId);
      await server.save();

      io.to(code).emit("channel-deleted", { channelId });
    } catch (err) {
      console.error("Error in delete-channel:", err);
    }
  });

  socket.on("kick-member", async ({ code, targetSocketId }) => {
    try {
      const ownerId = serverOwners.get(code);
      if (socket.id !== ownerId || targetSocketId === ownerId) return;

      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.emit("kicked");
        targetSocket.leave(code);
        targetSocket.disconnect(true);
      }
    } catch (err) {
      console.error("Error in kick-member:", err);
    }
  });

  socket.on("disconnect", async () => {
    const code = socket.data.serverCode;
    if (!code) return;

    try {
      const server = await Server.findOne({ code });
      if (server) {
        server.members = server.members.filter((m) => m.socketId !== socket.id);
        await server.save();
      }

      if (serverOwners.get(code) === socket.id) {
        serverOwners.delete(code);
        const socketsInServer = await io.in(code).fetchSockets();
        if (socketsInServer.length > 0) {
          const newOwner = socketsInServer[0];
          serverOwners.set(code, newOwner.id);
          if (server) {
            server.ownerSocketId = newOwner.id;
            await server.save();
          }
          io.to(code).emit("owner-changed", { newOwnerSocketId: newOwner.id });
        }
      }

      socket.to(code).emit("member-left", {
        socketId: socket.id,
        members: server ? server.members : [],
      });
    } catch (err) {
      console.error("Error in disconnect handler:", err);
    }
  });
}
