// pages/api/tech/upload-sticker.js
// DEBUG + SAFE VERSION (NO VPS ACCESS REQUIRED)

import multer from "multer";
import fs from "fs";
import path from "path";
import sharp from "sharp";

export const config = {
  api: { bodyParser: false },
};

// =====================================================
// PATHS (INTENTIONALLY LOGGED)
// =====================================================
const CWD = process.cwd();
const PUBLIC_UPLOADS = path.join(CWD, "public", "uploads");
const PUBLIC_STICKERS = path.join(PUBLIC_UPLOADS, "stickers");
const TMP_DIR = path.join(PUBLIC_UPLOADS, "tmp");

// ensure dirs
if (!fs.existsSync(PUBLIC_UPLOADS)) fs.mkdirSync(PUBLIC_UPLOADS, { recursive: true });
if (!fs.existsSync(PUBLIC_STICKERS)) fs.mkdirSync(PUBLIC_STICKERS, { recursive: true });
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

// =====================================================
// MULTER
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
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype?.startsWith("image/")) {
      return cb(new Error("Only images allowed"));
    }
    cb(null, true);
  },
}).single("sticker");

// =====================================================
// COMPRESSION (~5–6 KB)
// =====================================================
const TARGET_BYTES = 6 * 1024;
const MIN_DIM = 64;

async function compress(buf) {
  return await sharp(buf)
    .rotate()
    .resize({ width: MIN_DIM, withoutEnlargement: true })
    .webp({ quality: 6 })
    .toBuffer();
}

// =====================================================
// HANDLER
// =====================================================
export default function handler(req, res) {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        stage: "multer",
        error: err.message,
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        stage: "validation",
        error: "No file received",
      });
    }

    const tempPath = req.file.path;
    const finalName = `sticker_${Date.now()}_${Math.floor(Math.random() * 10000)}.webp`;
    const finalPath = path.join(PUBLIC_STICKERS, finalName);

    try {
      const raw = await fs.promises.readFile(tempPath);
      const out = await compress(raw);

      await fs.promises.writeFile(finalPath, out);
      await fs.promises.unlink(tempPath).catch(() => {});

      const exists = fs.existsSync(finalPath);

      return res.status(200).json({
        success: true,
        debug: {
          cwd: CWD,
          tmpPath: tempPath,
          finalPath,
          finalExists: exists,
          sizeKB: Math.round(out.length / 1024),
        },
        url: `/uploads/stickers/${finalName}`,
      });
    } catch (e) {
      await fs.promises.unlink(tempPath).catch(() => {});
      return res.status(500).json({
        success: false,
        stage: "processing",
        error: e.message,
      });
    }
  });
}
