// pages/api/tech/upload-sticker.js
// FINAL SAFE VERSION (NO VPS ACCESS REQUIRED)
// - Saves ALL images to public/uploads/stickers
// - Aggressive compression (~5–6 KB)
// - Local + Production both work
// - No 404 ever

import multer from "multer";
import fs from "fs";
import path from "path";
import sharp from "sharp";

// IMPORTANT: disable body parser
export const config = {
  api: { bodyParser: false },
};

// =====================================================
// SINGLE SAFE PATH (DO NOT CHANGE)
// =====================================================
const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");
const TMP_DIR = path.join(UPLOAD_ROOT, "tmp");
const STICKERS_DIR = path.join(UPLOAD_ROOT, "stickers");

// ensure directories exist
if (!fs.existsSync(UPLOAD_ROOT)) fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
if (!fs.existsSync(STICKERS_DIR)) fs.mkdirSync(STICKERS_DIR, { recursive: true });

// =====================================================
// MULTER (ALLOW BIG RAW IMAGE)
// =====================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TMP_DIR),
  filename: (req, file, cb) =>
    cb(
      null,
      `raw_${Date.now()}_${Math.floor(Math.random() * 10000)}${path.extname(
        file.originalname || ".jpg"
      )}`
    ),
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB raw
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files allowed"));
    }
    cb(null, true);
  },
}).single("sticker");

// =====================================================
// ULTRA COMPRESSION CONFIG
// =====================================================
const TARGET_BYTES = 6 * 1024; // ~6 KB
const MIN_DIM = 64;
const MAX_DIM = 1200;
const START_QUALITY = 80;
const MAX_ITER = 20;

async function compressToTarget(buffer) {
  let meta;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    meta = null;
  }

  let width = Math.min(MAX_DIM, meta?.width || MAX_DIM);
  let quality = START_QUALITY;
  let last = null;

  for (let i = 0; i < MAX_ITER; i++) {
    try {
      const out = await sharp(buffer)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: Math.max(4, quality), effort: 6 })
        .toBuffer();

      last = out;
      if (out.length <= TARGET_BYTES) return out;

      if (quality > 12) {
        quality -= 10;
      } else {
        width = Math.max(MIN_DIM, Math.round(width * 0.7));
      }
    } catch {
      width = Math.max(MIN_DIM, Math.round(width * 0.7));
      quality = Math.max(6, quality - 10);
    }
  }

  return (
    last ||
    (await sharp(buffer)
      .resize({ width: MIN_DIM })
      .webp({ quality: 6 })
      .toBuffer())
  );
}

// =====================================================
// API HANDLER
// =====================================================
export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false });
  }

  upload(req, res, async (err) => {
    if (err) {
      if (req?.file?.path) {
        await fs.promises.unlink(req.file.path).catch(() => {});
      }
      return res.status(400).json({
        success: false,
        error:
          err.code === "LIMIT_FILE_SIZE"
            ? "Image too large (15MB max)"
            : err.message,
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    const tempPath = req.file.path;
    const finalName = `sticker_${Date.now()}_${Math.floor(
      Math.random() * 10000
    )}.webp`;
    const finalPath = path.join(STICKERS_DIR, finalName);

    try {
      const raw = await fs.promises.readFile(tempPath);
      const compressed = await compressToTarget(raw);

      await fs.promises.writeFile(finalPath, compressed);
      await fs.promises.chmod(finalPath, 0o644);
      await fs.promises.unlink(tempPath).catch(() => {});

      // IMPORTANT: RELATIVE URL (WORKS EVERYWHERE)
      return res.status(200).json({
        success: true,
        url: `/uploads/stickers/${finalName}`,
        sizeKB: Math.round(compressed.length / 1024),
      });
    } catch (e) {
      await fs.promises.unlink(tempPath).catch(() => {});
      return res.status(500).json({
        success: false,
        error: "Processing failed",
      });
    }
  });
}
