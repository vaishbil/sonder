import crypto from "crypto";
import fs from "fs";
import path from "path";
import Server from "../models/Server.js";

export function registerServerHandlers(io, socket) {
  socket.on("join-server", async ({ code, username, clientId }) => {
    try {
      const server = await Server.findOne({ code });
      if (!server) {
        socket.emit("error-message", "Server not found");
        return;
      }

      socket.join(code);
      socket.data.serverCode = code;
      socket.data.username = username;
      socket.data.clientId = clientId;

      // First-ever joiner becomes the permanent owner, tied to their
      // persistent clientId rather than this session's socketId
      if (!server.ownerClientId) {
        server.ownerClientId = clientId;
      }

      // Remove any stale entry for this clientId before adding fresh —
      // this is what makes reconnects clean instead of piling up ghosts
      server.members = server.members.filter((m) => m.clientId !== clientId);
      server.members.push({ socketId: socket.id, clientId, username });
      await server.save();

      const isOwner = clientId === server.ownerClientId;

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

  socket.on("delete-message", async ({ code, channelId, messageId }) => {
    try {
      const server = await Server.findOne({ code });
      if (!server) return;

      const channel = server.channels.find((c) => c.channelId === channelId);
      if (!channel) return;

      const message = channel.messages.find((m) => m.messageId === messageId);
      if (!message) return;

      if (message.sender !== socket.data.username) {
        socket.emit("error-message", "You can only delete your own messages.");
        return;
      }

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
      const server = await Server.findOne({ code });
      if (!server) return;
      if (socket.data.clientId !== server.ownerClientId) return;

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
      const server = await Server.findOne({ code });
      if (!server) return;
      if (socket.data.clientId !== server.ownerClientId) return;
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
      const server = await Server.findOne({ code });
      if (!server) return;
      if (socket.data.clientId !== server.ownerClientId) return;

      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket && targetSocket.data.clientId !== server.ownerClientId) {
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

      // Note: ownership is intentionally NOT reassigned here. It's tied to
      // ownerClientId permanently, so the original owner automatically
      // regains admin rights the moment they reconnect with the same
      // browser (same clientId) — no manual re-election needed.

      socket.to(code).emit("member-left", {
        socketId: socket.id,
        members: server ? server.members : [],
      });
    } catch (err) {
      console.error("Error in disconnect handler:", err);
    }
  });
}
