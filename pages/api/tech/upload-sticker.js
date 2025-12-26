// pages/api/tech/upload-sticker.js
import multer from "multer";
import fs from "fs";
import path from "path";
import sharp from "sharp";

// disable built-in body parser for multer
export const config = {
  api: { bodyParser: false },
};

const TMP_DIR = path.join(process.cwd(), "tmp_uploads");
const OUT_DIR = path.join(process.cwd(), "public", "uploads", "stickers");

// ensure directories
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// multer storage (temp)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TMP_DIR),
  filename: (req, file, cb) =>
    cb(null, `raw_${Date.now()}_${Math.floor(Math.random() * 10000)}${path.extname(file.originalname)}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // allow up to 10MB raw
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only images allowed"));
    cb(null, true);
  },
}).single("sticker");

// compression targets
const TARGET_BYTES = 6 * 1024; // 6 KB
const MIN_DIM = 96;
const START_DIM = 512;
const START_QUALITY = 50;

async function compressToTarget(inputBuffer, targetBytes = TARGET_BYTES) {
  // start width from START_DIM or image width
  let meta;
  try {
    meta = await sharp(inputBuffer).metadata();
  } catch (e) {
    meta = null;
  }
  let width = Math.min(1200, meta?.width || START_DIM);
  if (width > START_DIM) width = START_DIM;

  let quality = START_QUALITY;
  let lastBuf = null;

  for (let i = 0; i < 10; i++) {
    try {
      const buf = await sharp(inputBuffer)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: Math.max(6, Math.round(quality)), effort: 6 })
        .toBuffer();

      lastBuf = buf;
      if (buf.length <= targetBytes) return buf;

      // reduce quality or width
      if (quality > 12) {
        quality = Math.max(8, quality - 8);
      } else {
        const nextWidth = Math.max(MIN_DIM, Math.round(width * 0.75));
        if (nextWidth === width) break;
        width = nextWidth;
        quality = Math.max(20, Math.round(quality * 0.8));
      }
    } catch (e) {
      // on error, reduce width
      width = Math.max(MIN_DIM, Math.round(width * 0.7));
      quality = Math.max(8, quality - 10);
    }
  }

  // fallback: aggressive tiny
  if (!lastBuf) {
    return sharp(inputBuffer).resize({ width: MIN_DIM, withoutEnlargement: true }).webp({ quality: 6 }).toBuffer();
  }
  return lastBuf;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  upload(req, res, async (err) => {
    if (err) {
      console.error("Multer error:", err);
      return res.status(400).json({ success: false, error: err.message || "Upload failed" });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded" });
    }

    const tempPath = req.file.path;
    const finalName = `sticker_${Date.now()}_${Math.floor(Math.random() * 10000)}.webp`;
    const finalPath = path.join(OUT_DIR, finalName);

    try {
      const inputBuffer = await fs.promises.readFile(tempPath);

      const compressed = await compressToTarget(inputBuffer, TARGET_BYTES);

      // write file
      await fs.promises.writeFile(finalPath, compressed);

      // remove temp
      await fs.promises.unlink(tempPath).catch(() => {});

      return res.status(200).json({
        success: true,
        url: `/uploads/stickers/${finalName}`,
        size: compressed.length,
        message: `Compressed to ${Math.round(compressed.length / 1024)} KB`,
      });
    } catch (e) {
      console.error("Processing error:", e);
      await fs.promises.unlink(tempPath).catch(() => {});
      return res.status(500).json({ success: false, error: "Processing failed" });
    }
  });
}
