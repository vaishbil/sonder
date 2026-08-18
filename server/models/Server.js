import mongoose from "mongoose";

const replyToSchema = new mongoose.Schema(
  {
    messageId: { type: String, required: true },
    sender: { type: String, required: true },
    text: { type: String, default: "" },
  },
  { _id: false }
);

const reactionSchema = new mongoose.Schema(
  {
    emoji: { type: String, required: true },
    usernames: { type: [String], default: [] },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    messageId: { type: String, required: true },
    sender: { type: String, required: true },
    text: { type: String, default: "" },
    timestamp: { type: Date, default: Date.now },
    attachment: {
      url: { type: String, default: null },
      filename: { type: String, default: null },
      type: { type: String, default: null },
      publicId: { type: String, default: null },
    },
    replyTo: { type: replyToSchema, default: null },
    reactions: { type: [reactionSchema], default: [] },
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
    clientId: { type: String, required: true },
    username: { type: String, required: true },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const serverSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true },
    name: { type: String, default: "New Server" },
    ownerClientId: { type: String, default: null },
    moderatorClientIds: { type: [String], default: [] },
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
