import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    hostSocketId: {
      type: String,
      default: null,
    },
    currentTrack: {
      trackId: { type: String, default: null },
      title: { type: String, default: null },
      artist: { type: String, default: null },
      audioUrl: { type: String, default: null },
      sourceType: { type: String, enum: ["audio", "youtube"], default: "audio" },
      youtubeVideoId: { type: String, default: null },
    },
    playbackState: {
      isPlaying: { type: Boolean, default: false },
      positionSeconds: { type: Number, default: 0 },
      lastUpdatedAt: { type: Date, default: Date.now },
    },
    participants: [
      {
        socketId: String,
        joinedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const Room = mongoose.model("Room", roomSchema);

export default Room;
