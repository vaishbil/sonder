import express from "express";

const router = express.Router();

const JAMENDO_BASE_URL = "https://api.jamendo.com/v3.0";

// GET /tracks/search?q=chill
router.get("/search", async (req, res) => {
  const query = req.query.q || "";
  const JAMENDO_CLIENT_ID = process.env.JAMENDO_CLIENT_ID;

  try {
    const url = `${JAMENDO_BASE_URL}/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=json&limit=10&namesearch=${encodeURIComponent(
      query
    )}&audioformat=mp32`;

    const response = await fetch(url);
    const data = await response.json();

    const tracks = (data.results || []).map((t) => ({
      trackId: t.id,
      title: t.name,
      artist: t.artist_name,
      audioUrl: t.audio,
      duration: t.duration,
      image: t.image,
    }));

    res.json(tracks);
  } catch (err) {
    console.error("Error searching Jamendo:", err);
    res.status(500).json({ error: "Failed to search tracks" });
  }
});

export default router;
