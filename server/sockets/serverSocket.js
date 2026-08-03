import Server from "../models/Server.js";

// code -> ownerSocketId, kept in-memory for fast admin checks
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

      // First person to join becomes the owner/admin
      if (!serverOwners.has(code)) {
        serverOwners.set(code, socket.id);
        server.ownerSocketId = socket.id;
      }

      server.members.push({ socketId: socket.id, username });
      await server.save();

      const isOwner = serverOwners.get(code) === socket.id;

      // Send full server state to the joining client
      socket.emit("server-state", {
        name: server.name,
        channels: server.channels,
        members: server.members,
        isOwner,
      });

      // Let everyone else know who joined
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

  socket.on("send-message", async ({ code, channelId, text }) => {
    try {
      const server = await Server.findOne({ code });
      if (!server) return;

      const channel = server.channels.find((c) => c.channelId === channelId);
      if (!channel) return;

      const message = {
        sender: socket.data.username || "Unknown",
        text,
        timestamp: new Date(),
      };
      channel.messages.push(message);

      // Keep channel history bounded — fine for a portfolio scope,
      // would move to a separate paginated Message collection at real scale
      if (channel.messages.length > 200) {
        channel.messages = channel.messages.slice(-200);
      }

      await server.save();

      io.to(code).emit("new-message", { channelId, message });
    } catch (err) {
      console.error("Error in send-message:", err);
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
      if (socket.id !== ownerId) return; // only the owner can create channels

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

      // Never allow deleting the last remaining channel
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

      // Reassign owner if the owner disconnected
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
