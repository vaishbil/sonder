import Room from "../models/Room.js";

// Keeps track of who is host per room code, in-memory for fast access
// (Mongo is the source of truth for persistence, this is for quick lookups)
const roomHosts = new Map(); // code -> hostSocketId

export function registerRoomHandlers(io, socket) {
  // Client joins a room
  socket.on("join-room", async ({ code }) => {
    try {
      const room = await Room.findOne({ code });
      if (!room) {
        socket.emit("error-message", "Room not found");
        return;
      }

      socket.join(code);
      socket.data.roomCode = code;

      // First person to join becomes host if no host exists yet
      if (!roomHosts.has(code)) {
        roomHosts.set(code, socket.id);
        room.hostSocketId = socket.id;
        await room.save();
      }

      // Add participant record
      room.participants.push({ socketId: socket.id });
      await room.save();

      const isHost = roomHosts.get(code) === socket.id;

      // Send current room state to the joining client so they sync immediately
      socket.emit("room-state", {
        currentTrack: room.currentTrack,
        playbackState: room.playbackState,
        isHost,
      });

      // Let everyone else know someone joined
      socket.to(code).emit("participant-joined", { socketId: socket.id });

      console.log(`Socket ${socket.id} joined room ${code} (host: ${isHost})`);
    } catch (err) {
      console.error("Error in join-room:", err);
      socket.emit("error-message", "Failed to join room");
    }
  });

  // Host sends a playback event (play/pause/seek) with a timestamp
  socket.on("playback-event", async ({ code, type, positionSeconds }) => {
    try {
      const hostId = roomHosts.get(code);
      if (socket.id !== hostId) {
        // Only the host is allowed to control playback
        return;
      }

      const room = await Room.findOne({ code });
      if (!room) return;

      if (type === "seek") {
        // Seeking shouldn't change whether the track is playing or paused
        room.playbackState.positionSeconds = positionSeconds;
      } else {
        room.playbackState.isPlaying = type === "play";
        room.playbackState.positionSeconds = positionSeconds;
      }
      room.playbackState.lastUpdatedAt = new Date();
      await room.save();

      // Broadcast to everyone else in the room, with server timestamp
      // so clients can compensate for network delay
      socket.to(code).emit("sync-playback", {
        type,
        positionSeconds,
        serverTime: Date.now(),
      });
    } catch (err) {
      console.error("Error in playback-event:", err);
    }
  });

  // Host changes the track
  socket.on("change-track", async ({ code, trackId, title, artist, audioUrl, sourceType, youtubeVideoId }) => {
    try {
      const hostId = roomHosts.get(code);
      if (socket.id !== hostId) return;

      const room = await Room.findOne({ code });
      if (!room) return;

      room.currentTrack = { trackId, title, artist, audioUrl, sourceType, youtubeVideoId };
      room.playbackState = {
        isPlaying: false,
        positionSeconds: 0,
        lastUpdatedAt: new Date(),
      };
      await room.save();

      io.to(code).emit("track-changed", { trackId, title, artist, audioUrl, sourceType, youtubeVideoId });
    } catch (err) {
      console.error("Error in change-track:", err);
    }
  });

  // Host removes the current track entirely
  socket.on("clear-track", async ({ code }) => {
    try {
      const hostId = roomHosts.get(code);
      if (socket.id !== hostId) return;

      const room = await Room.findOne({ code });
      if (!room) return;

      room.currentTrack = {
        trackId: null,
        title: null,
        artist: null,
        audioUrl: null,
        sourceType: "audio",
        youtubeVideoId: null,
      };
      room.playbackState = {
        isPlaying: false,
        positionSeconds: 0,
        lastUpdatedAt: new Date(),
      };
      await room.save();

      io.to(code).emit("track-changed", room.currentTrack);
    } catch (err) {
      console.error("Error in clear-track:", err);
    }
  });

  // Chat message
  socket.on("chat-message", ({ code, text, sender }) => {
    io.to(code).emit("chat-message", {
      text,
      sender,
      timestamp: Date.now(),
    });
  });

  // Handle disconnect - promote a new host if the host left
  socket.on("disconnect", async () => {
    const code = socket.data.roomCode;
    if (!code) return;

    try {
      const room = await Room.findOne({ code });
      if (room) {
        room.participants = room.participants.filter(
          (p) => p.socketId !== socket.id
        );
        await room.save();
      }

      if (roomHosts.get(code) === socket.id) {
        roomHosts.delete(code);

        // Promote the next participant in the room, if any
        const socketsInRoom = await io.in(code).fetchSockets();
        if (socketsInRoom.length > 0) {
          const newHost = socketsInRoom[0];
          roomHosts.set(code, newHost.id);
          if (room) {
            room.hostSocketId = newHost.id;
            await room.save();
          }
          io.to(code).emit("host-changed", { newHostSocketId: newHost.id });
          console.log(`New host for room ${code}: ${newHost.id}`);
        }
      }

      socket.to(code).emit("participant-left", { socketId: socket.id });
      console.log(`Socket ${socket.id} disconnected from room ${code}`);
    } catch (err) {
      console.error("Error in disconnect handler:", err);
    }
  });
}
