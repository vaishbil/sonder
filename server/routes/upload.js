import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";

const router = express.Router();

// Files are held in memory briefly, then streamed straight to Cloudinary —
// never written to local disk at any point
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

function uploadBufferToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: "sonder-uploads", resource_type: "auto" },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

router.post("/", (req, res) => {
  // Configured here, at request time, instead of at module load time —
  // guarantees dotenv has already loaded the credentials by this point
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  upload.single("file")(req, res, async (err) => {
    if (err) {
      console.error("Multer error:", err.message);
      return res.status(500).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    try {
      const result = await uploadBufferToCloudinary(req.file.buffer);
      res.json({
        url: result.secure_url,
        filename: req.file.originalname,
        type: req.file.mimetype,
        publicId: result.public_id,
      });
    } catch (uploadErr) {
      console.error("Cloudinary upload error:", uploadErr.message);
      res.status(500).json({ error: uploadErr.message || "Cloudinary upload failed" });
    }
  });
});

export default router;
