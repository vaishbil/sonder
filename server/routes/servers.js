import express from "express";
import Server from "../models/Server.js";

const router = express.Router();

function generateCode(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// POST /servers - create a new server
router.post("/", async (req, res) => {
  try {
    const { name } = req.body;
    let code;
    let exists = true;

    while (exists) {
      code = generateCode();
      exists = await Server.findOne({ code });
    }

    const server = await Server.create({ code, name: name || "New Server" });
    res.status(201).json(server);
  } catch (err) {
    console.error("Error creating server:", err);
    res.status(500).json({ error: "Failed to create server" });
  }
});

// GET /servers/:code
router.get("/:code", async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const server = await Server.findOne({ code });
    if (!server) return res.status(404).json({ error: "Server not found" });
    res.json(server);
  } catch (err) {
    console.error("Error fetching server:", err);
    res.status(500).json({ error: "Failed to fetch server" });
  }
});

export default router;
