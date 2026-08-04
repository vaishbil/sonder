import express from "express";
import Server from "../models/Server.js";

const router = express.Router();

// GET /servers/:code/search?q=hello
router.get("/:code/search", async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const query = (req.query.q || "").toLowerCase().trim();

    if (!query) return res.json([]);

    const server = await Server.findOne({ code });
    if (!server) return res.status(404).json({ error: "Server not found" });

    const results = [];
    for (const channel of server.channels) {
      for (const message of channel.messages) {
        if (message.text.toLowerCase().includes(query)) {
          results.push({
            channelId: channel.channelId,
            channelName: channel.name,
            sender: message.sender,
            text: message.text,
            timestamp: message.timestamp,
          });
        }
      }
    }

    // Most recent matches first
    results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json(results.slice(0, 50));
  } catch (err) {
    console.error("Error searching messages:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;
