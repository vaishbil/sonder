import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = express.Router();

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// 10MB limit — reasonable for a portfolio project; would move to
// S3/Cloudinary with proper limits and virus scanning at real scale
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.post("/", (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      console.error("Multer upload error:", err.message);
      return res.status(500).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    res.json({
      url: `/uploads/${req.file.filename}`,
      filename: req.file.originalname,
      type: req.file.mimetype,
    });
  });
});

export default router;
