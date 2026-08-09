import crypto from "crypto";
import fs from "fs";
import path from "path";
import Server from "../models/Server.js";

function isAdmin(server, clientId) {
  return clientId === server.ownerClientId || server.moderatorClientIds.includes(clientId);
}

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

      if (!server.ownerClientId) {
        server.ownerClientId = clientId;
      }

      server.members = server.members.filter((m) => m.clientId !== clientId);
      server.members.push({ socketId: socket.id, clientId, username });
      await server.save();

      const isOwner = clientId === server.ownerClientId;
      const isModerator = server.moderatorClientIds.includes(clientId);

      socket.emit("server-state", {
        name: server.name,
        channels: server.channels,
        members: server.members,
        isOwner,
        isModerator,
        ownerClientId: server.ownerClientId,
        moderatorClientIds: server.moderatorClientIds,
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
        reactions: [],
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

  // Toggle an emoji reaction on a message — adds it if the user hasn't
  // reacted with that emoji yet, removes it if they have (like a like button)
  socket.on("toggle-reaction", async ({ code, channelId, messageId, emoji }) => {
    try {
      const server = await Server.findOne({ code });
      if (!server) return;

      const channel = server.channels.find((c) => c.channelId === channelId);
      if (!channel) return;

      const message = channel.messages.find((m) => m.messageId === messageId);
      if (!message) return;

      const username = socket.data.username;
      let reaction = message.reactions.find((r) => r.emoji === emoji);

      if (!reaction) {
        reaction = { emoji, usernames: [username] };
        message.reactions.push(reaction);
      } else if (reaction.usernames.includes(username)) {
        reaction.usernames = reaction.usernames.filter((u) => u !== username);
      } else {
        reaction.usernames.push(username);
      }

      // Clean up reactions nobody has anymore
      message.reactions = message.reactions.filter((r) => r.usernames.length > 0);

      await server.save();

      io.to(code).emit("reaction-updated", {
        channelId,
        messageId,
        reactions: message.reactions,
      });
    } catch (err) {
      console.error("Error in toggle-reaction:", err);
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
      if (!isAdmin(server, socket.data.clientId)) return;

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
      if (!isAdmin(server, socket.data.clientId)) return;
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

      const actorClientId = socket.data.clientId;
      if (!isAdmin(server, actorClientId)) return;

      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (!targetSocket) return;

      const targetClientId = targetSocket.data.clientId;
      const targetIsOwner = targetClientId === server.ownerClientId;
      const targetIsModerator = server.moderatorClientIds.includes(targetClientId);
      const actorIsOwner = actorClientId === server.ownerClientId;

      // Only the owner can remove the owner (never) or another moderator —
      // moderators can only kick regular members
      if (targetIsOwner) return;
      if (targetIsModerator && !actorIsOwner) return;

      targetSocket.emit("kicked");
      targetSocket.leave(code);
      targetSocket.disconnect(true);
    } catch (err) {
      console.error("Error in kick-member:", err);
    }
  });

  // Only the owner can promote/demote moderators
  socket.on("promote-moderator", async ({ code, targetClientId }) => {
    try {
      const server = await Server.findOne({ code });
      if (!server) return;
      if (socket.data.clientId !== server.ownerClientId) return;
      if (targetClientId === server.ownerClientId) return;

      if (!server.moderatorClientIds.includes(targetClientId)) {
        server.moderatorClientIds.push(targetClientId);
        await server.save();
      }

      io.to(code).emit("moderators-updated", { moderatorClientIds: server.moderatorClientIds });
    } catch (err) {
      console.error("Error in promote-moderator:", err);
    }
  });

  socket.on("demote-moderator", async ({ code, targetClientId }) => {
    try {
      const server = await Server.findOne({ code });
      if (!server) return;
      if (socket.data.clientId !== server.ownerClientId) return;

      server.moderatorClientIds = server.moderatorClientIds.filter((id) => id !== targetClientId);
      await server.save();

      io.to(code).emit("moderators-updated", { moderatorClientIds: server.moderatorClientIds });
    } catch (err) {
      console.error("Error in demote-moderator:", err);
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

      socket.to(code).emit("member-left", {
        socketId: socket.id,
        members: server ? server.members : [],
      });
    } catch (err) {
      console.error("Error in disconnect handler:", err);
    }
  });
}
