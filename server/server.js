import dotenv from "dotenv";
dotenv.config();

import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import mongoose from "mongoose";

import roomsRouter from "./routes/rooms.js";
import tracksRouter from "./routes/tracks.js";
import { registerRoomHandlers } from "./sockets/roomSocket.js";

const app = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
  },
});

app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

// REST routes
app.use("/rooms", roomsRouter);
app.use("/tracks", tracksRouter);

app.get("/", (req, res) => {
  res.send("Sonder backend is running");
});

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log(`New connection: ${socket.id}`);
  registerRoomHandlers(io, socket);
});

// Connect to MongoDB then start server
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });
