import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    sender: { type: String, required: true }, // username, not socket ID
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const channelSchema = new mongoose.Schema({
  channelId: { type: String, required: true },
  name: { type: String, required: true },
  messages: { type: [messageSchema], default: [] },
});

const memberSchema = new mongoose.Schema(
  {
    socketId: { type: String, required: true },
    username: { type: String, required: true },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const serverSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true },
    name: { type: String, default: "New Server" },
    ownerSocketId: { type: String, default: null },
    channels: {
      type: [channelSchema],
      default: [{ channelId: "general", name: "general", messages: [] }],
    },
    members: { type: [memberSchema], default: [] },
  },
  { timestamps: true }
);

const Server = mongoose.model("Server", serverSchema);

export default Server;
