// pages/api/tech/upload-sticker.js
// Accept large raw images (up to 15 MB) and aggressively compress to a tiny webp (~5-6 KB).
// NOTE: This endpoint is CPU-heavy when compressing large images. For heavy load consider background/queue.
// Requires: npm install multer sharp

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

// Directories
const TMP_DIR = path.join(process.cwd(), "tmp_uploads");
const OUT_DIR = path.join(process.cwd(), "public", "uploads", "stickers");

// Ensure directories exist
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// Multer disk storage (save raw upload to temp)
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

// Allow reasonably large raw uploads (user requested >=5MB). Here we set 15MB.
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
const MIN_DIM = 64; // do not reduce below this px
const MAX_START_DIM = 1200; // starting width cap
const MAX_ITER = 16; // iteration attempts
const START_QUALITY = 80; // start high, then reduce

async function compressToTarget(inputBuffer, targetBytes = TARGET_BYTES) {
  // Determine initial width from metadata
  let meta;
  try {
    meta = await sharp(inputBuffer).metadata();
  } catch (e) {
    meta = null;
  }

  // start width: use image width but cap it to MAX_START_DIM (or START_DIM fallback)
  let width = Math.min(MAX_START_DIM, meta?.width || MAX_START_DIM);
  if (!width || width <= 0) width = MAX_START_DIM;

  let quality = START_QUALITY;
  let lastBuf = null;

  // Iteratively try reducing quality first, then dimensions
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

      // If not small enough, reduce quality more aggressively first
      if (quality > 12) {
        // drop quality by a big step but not below 6
        quality = Math.max(6, quality - Math.ceil((quality - 6) * 0.5));
      } else {
        // quality is already low — reduce dimensions (75% each step)
        const nextWidth = Math.max(MIN_DIM, Math.round(width * 0.7));
        if (nextWidth === width) {
          // can't reduce more
          break;
        }
        width = nextWidth;
        // after scaling down, bump quality a little to keep contrast
        quality = Math.max(6, Math.round(quality * 0.9));
      }
    } catch (err) {
      // On any sharp failure try to reduce width & quality and continue
      width = Math.max(MIN_DIM, Math.round(width * 0.7));
      quality = Math.max(6, Math.round(quality * 0.8));
    }
  }

  // If we couldn't reach target, attempt an ultra-aggressive final pass:
  try {
    const ultra = await sharp(inputBuffer)
      .rotate()
      .resize({ width: MIN_DIM, withoutEnlargement: true })
      .webp({ quality: 6, effort: 6 })
      .toBuffer();
    // if ultra smaller than lastBuf or lastBuf null, return ultra
    if (!lastBuf || ultra.length <= lastBuf.length) return ultra;
  } catch (err) {
    // ignore
  }

  // fallback to last best buffer (may be larger than target)
  if (lastBuf) return lastBuf;

  // as very last resort convert to a tiny blank placeholder image to avoid errors
  const placeholder = await sharp({
    create: {
      width: MIN_DIM,
      height: MIN_DIM,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .png()
    .toBuffer();
  return placeholder;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  // Run multer to accept raw upload to temp
  upload(req, res, async (multerErr) => {
    // multerErr may be a MulterError or generic Error
    if (multerErr) {
      console.error("Multer error:", multerErr);
      // If multer created a file before failing, attempt to remove it
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
      // Read raw file from temp
      const inputBuffer = await fs.promises.readFile(tempPath);

      // Compress to target bytes (server-side sharp)
      const compressed = await compressToTarget(inputBuffer, TARGET_BYTES);

      // Write compressed final file
      await fs.promises.writeFile(finalPath, compressed);

      // Cleanup temp file
      await fs.promises.unlink(tempPath).catch(() => {});

      // Return URL and final size
      return res.status(200).json({
        success: true,
        url: `/uploads/stickers/${finalName}`,
        size: compressed.length,
        message: `Compressed to ${Math.round(compressed.length / 1024)} KB`,
      });
    } catch (procErr) {
      console.error("Processing error:", procErr);
      // Attempt cleanup of temp
      try {
        await fs.promises.unlink(tempPath).catch(() => {});
      } catch {}
      return res.status(500).json({ success: false, error: "Processing failed" });
    }
  });
}
