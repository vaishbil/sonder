import dotenv from "dotenv";
dotenv.config();

import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import mongoose from "mongoose";
import path from "path";

import serversRouter from "./routes/servers.js";
import uploadRouter from "./routes/upload.js";
import searchRouter from "./routes/search.js";
import { registerServerHandlers } from "./sockets/serverSocket.js";

const app = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

const io = new SocketIOServer(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
  },
});

app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());




app.use("/servers", serversRouter);
app.use("/upload", uploadRouter);
app.use("/servers", searchRouter); // adds GET /servers/:code/search

app.get("/", (req, res) => {
  res.send("Mini Discord backend is running");
});

io.on("connection", (socket) => {
  console.log(`New connection: ${socket.id}`);
  registerServerHandlers(io, socket);
});

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
