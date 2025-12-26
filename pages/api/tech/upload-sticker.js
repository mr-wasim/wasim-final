// pages/api/tech/upload-sticker.js
// Accept large raw images (up to 15 MB) and aggressively compress to a tiny webp (~5-6 KB).
// Requires: npm install multer sharp
// NOTE: This file is meant for Next.js API routes. Ensure server.js (above) is used in production
// so that /uploads is served from persistent path (/var/www/chimney-uploads).

import multer from "multer";
import fs from "fs";
import path from "path";
import sharp from "sharp";

// disable Next.js built-in body parser (required for multer)
export const config = {
  api: {
    bodyParser: false,
  },
};

// Persistent directories (must match server.js)
const PERSISTENT_ROOT = "/var/www/chimney-uploads";
const TMP_DIR = path.join(PERSISTENT_ROOT, "tmp");
const OUT_DIR = path.join(PERSISTENT_ROOT, "stickers");

// Ensure directories exist
if (!fs.existsSync(PERSISTENT_ROOT)) {
  try {
    fs.mkdirSync(PERSISTENT_ROOT, { recursive: true });
  } catch (e) {
    console.error("Failed to create PERSISTENT_ROOT:", e);
  }
}
if (!fs.existsSync(TMP_DIR)) {
  try {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  } catch (e) {
    console.error("Failed to create TMP_DIR:", e);
  }
}
if (!fs.existsSync(OUT_DIR)) {
  try {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  } catch (e) {
    console.error("Failed to create OUT_DIR:", e);
  }
}

// Multer disk storage: save raw upload to TMP_DIR
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

// Allow reasonably large raw uploads (>=5MB requested). Set to 15MB.
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files allowed"));
    }
    cb(null, true);
  },
}).single("sticker");

// Compression configuration
const TARGET_BYTES = 6 * 1024; // ~6 KB final target
const MIN_DIM = 64; // minimum dimension allowed
const MAX_START_DIM = 1200; // starting width cap
const MAX_ITER = 16;
const START_QUALITY = 80;

async function compressToTarget(inputBuffer, targetBytes = TARGET_BYTES) {
  let meta;
  try {
    meta = await sharp(inputBuffer).metadata();
  } catch (e) {
    meta = null;
  }

  // start width from metadata or cap
  let width = Math.min(MAX_START_DIM, meta?.width || MAX_START_DIM);
  if (!width || width <= 0) width = MAX_START_DIM;

  let quality = START_QUALITY;
  let lastBuf = null;

  for (let i = 0; i < MAX_ITER; i++) {
    try {
      const buf = await sharp(inputBuffer)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: Math.max(4, Math.round(quality)), effort: 6 })
        .toBuffer();

      lastBuf = buf;

      if (buf.length <= targetBytes) {
        return buf;
      }

      // reduce quality aggressively first
      if (quality > 12) {
        quality = Math.max(6, quality - Math.ceil((quality - 6) * 0.5));
      } else {
        // then reduce width
        const nextWidth = Math.max(MIN_DIM, Math.round(width * 0.7));
        if (nextWidth === width) break;
        width = nextWidth;
        quality = Math.max(6, Math.round(quality * 0.9));
      }
    } catch (err) {
      // On error, shrink width and quality and continue
      width = Math.max(MIN_DIM, Math.round(width * 0.7));
      quality = Math.max(6, Math.round(quality * 0.8));
    }
  }

  // ultra aggressive fallback
  try {
    const ultra = await sharp(inputBuffer)
      .rotate()
      .resize({ width: MIN_DIM, withoutEnlargement: true })
      .webp({ quality: 6, effort: 6 })
      .toBuffer();
    if (!lastBuf || ultra.length <= lastBuf.length) return ultra;
  } catch (e) {
    // ignore
  }

  if (lastBuf) return lastBuf;

  // final fallback: tiny blank placeholder PNG to avoid failure
  return await sharp({
    create: {
      width: MIN_DIM,
      height: MIN_DIM,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .png()
    .toBuffer();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  upload(req, res, async (multerErr) => {
    if (multerErr) {
      console.error("Multer error:", multerErr);
      // remove temp file if created
      try {
        if (req?.file?.path) await fs.promises.unlink(req.file.path).catch(() => {});
      } catch {}
      const msg =
        multerErr.code === "LIMIT_FILE_SIZE"
          ? "Raw image too large (max 15MB)."
          : multerErr.message || "Upload failed";
      return res.status(400).json({ success: false, error: msg });
    }

    if (!req.file || !req.file.path) {
      return res.status(400).json({ success: false, error: "No file uploaded" });
    }

    const tempPath = req.file.path;
    const finalName = `sticker_${Date.now()}_${Math.floor(Math.random() * 10000)}.webp`;
    const finalPath = path.join(OUT_DIR, finalName);

    try {
      const inputBuffer = await fs.promises.readFile(tempPath);

      const compressed = await compressToTarget(inputBuffer, TARGET_BYTES);

      // write final compressed file
      await fs.promises.writeFile(finalPath, compressed);

      // cleanup temp
      await fs.promises.unlink(tempPath).catch(() => {});

      return res.status(200).json({
        success: true,
        url: `/uploads/stickers/${finalName}`,
        size: compressed.length,
        message: `Compressed to ${Math.round(compressed.length / 1024)} KB`,
      });
    } catch (procErr) {
      console.error("Processing error:", procErr);
      // attempt cleanup
      try {
        await fs.promises.unlink(tempPath).catch(() => {});
      } catch {}
      return res.status(500).json({ success: false, error: "Processing failed" });
    }
  });
}

