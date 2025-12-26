// pages/api/tech/upload-sticker.js
// FINAL PERMANENT FIX
// - Raw upload up to 15MB
// - Server-side aggressive compression (~5–6 KB)
// - SINGLE persistent path (dev + prod same)
// - Relative URL return so deploy ke baad bhi images dikhein

import multer from "multer";
import fs from "fs";
import path from "path";
import sharp from "sharp";

// ❗ disable body parser (multer needs this)
export const config = {
  api: { bodyParser: false },
};

// =====================================================
// 🔥 SINGLE SOURCE OF TRUTH (NO ENV SPLIT)
// =====================================================
const UPLOADS_ROOT = "/var/www/chimney-uploads";
const TMP_DIR = path.join(UPLOADS_ROOT, "tmp");
const STICKERS_DIR = path.join(UPLOADS_ROOT, "stickers");

// ensure folders exist
if (!fs.existsSync(UPLOADS_ROOT)) fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
if (!fs.existsSync(STICKERS_DIR)) fs.mkdirSync(STICKERS_DIR, { recursive: true });

// =====================================================
// MULTER (accept BIG raw image)
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
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB raw allowed
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files allowed"));
    }
    cb(null, true);
  },
}).single("sticker");

// =====================================================
// COMPRESSION SETTINGS (ULTRA)
// =====================================================
const TARGET_BYTES = 6 * 1024; // ~6 KB
const MIN_DIM = 64;
const MAX_START_DIM = 1200;
const START_QUALITY = 80;
const MAX_ITER = 18;

async function compressToTarget(inputBuffer) {
  let meta;
  try {
    meta = await sharp(inputBuffer).metadata();
  } catch {
    meta = null;
  }

  let width = Math.min(MAX_START_DIM, meta?.width || MAX_START_DIM);
  let quality = START_QUALITY;
  let last = null;

  for (let i = 0; i < MAX_ITER; i++) {
    try {
      const out = await sharp(inputBuffer)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: Math.max(4, Math.round(quality)), effort: 6 })
        .toBuffer();

      last = out;
      if (out.length <= TARGET_BYTES) return out;

      if (quality > 12) {
        quality = Math.max(6, quality - 10);
      } else {
        width = Math.max(MIN_DIM, Math.round(width * 0.7));
        quality = Math.max(6, Math.round(quality * 0.9));
      }
    } catch {
      width = Math.max(MIN_DIM, Math.round(width * 0.7));
      quality = Math.max(6, Math.round(quality * 0.8));
    }
  }

  // final fallback (guaranteed tiny)
  return (
    last ||
    (await sharp(inputBuffer)
      .resize({ width: MIN_DIM, withoutEnlargement: true })
      .webp({ quality: 6 })
      .toBuffer())
  );
}

// =====================================================
// API HANDLER
// =====================================================
export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false });
  }

  upload(req, res, async (err) => {
    if (err) {
      console.error("Multer error:", err);
      if (req?.file?.path) {
        await fs.promises.unlink(req.file.path).catch(() => {});
      }
      return res.status(400).json({
        success: false,
        error:
          err.code === "LIMIT_FILE_SIZE"
            ? "Raw image too large (max 15MB)"
            : err.message,
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded" });
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

      // 🔥 IMPORTANT: RELATIVE URL ONLY
      return res.status(200).json({
        success: true,
        url: `/uploads/stickers/${finalName}`,
        sizeKB: Math.round(compressed.length / 1024),
      });
    } catch (e) {
      console.error("Processing error:", e);
      await fs.promises.unlink(tempPath).catch(() => {});
      return res.status(500).json({ success: false, error: "Processing failed" });
    }
  });
}
