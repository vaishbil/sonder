import express from "express";
import Room from "../models/Room.js";
import { generateRoomCode } from "../utils/generateRoomCode.js";

const router = express.Router();

// POST /rooms - create a new room
router.post("/", async (req, res) => {
  try {
    let code;
    let exists = true;

    // keep generating until we get a unique code
    while (exists) {
      code = generateRoomCode();
      exists = await Room.findOne({ code });
    }

    const room = await Room.create({ code });
    res.status(201).json(room);
  } catch (err) {
    console.error("Error creating room:", err);
    res.status(500).json({ error: "Failed to create room" });
  }
});

// GET /rooms/:code - fetch room by code (used when joining)
router.get("/:code", async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const room = await Room.findOne({ code });

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    res.json(room);
  } catch (err) {
    console.error("Error fetching room:", err);
    res.status(500).json({ error: "Failed to fetch room" });
  }
});

export default router;
