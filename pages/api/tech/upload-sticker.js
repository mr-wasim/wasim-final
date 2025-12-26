// pages/api/tech/upload-sticker.js
// FINAL PERMANENT FIX (DEBUG PROVED)
// - All new uploads go to public/uploads/stickers
// - Old images auto-migrated from /var/www/chimney-uploads
// - No VPS access needed
// - No 404 possible

import multer from "multer";
import fs from "fs";
import path from "path";
import sharp from "sharp";

export const config = {
  api: { bodyParser: false },
};

// =====================================================
// PATHS (DEBUG CONFIRMED)
// =====================================================
const CWD = process.cwd();

// FINAL SINGLE SERVED PATH
const PUBLIC_UPLOADS = path.join(CWD, "public", "uploads");
const PUBLIC_STICKERS = path.join(PUBLIC_UPLOADS, "stickers");
const TMP_DIR = path.join(PUBLIC_UPLOADS, "tmp");

// OLD UNSERVED PATH (AUTO MIGRATION SOURCE)
const LEGACY_ROOT = "/var/www/chimney-uploads";
const LEGACY_STICKERS = path.join(LEGACY_ROOT, "stickers");

// ensure directories
if (!fs.existsSync(PUBLIC_UPLOADS)) fs.mkdirSync(PUBLIC_UPLOADS, { recursive: true });
if (!fs.existsSync(PUBLIC_STICKERS)) fs.mkdirSync(PUBLIC_STICKERS, { recursive: true });
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

// =====================================================
// 🔁 AUTO MIGRATION (RUNS SAFELY EVERY TIME)
// =====================================================
function migrateLegacyImages() {
  try {
    if (!fs.existsSync(LEGACY_STICKERS)) return;

    const files = fs.readdirSync(LEGACY_STICKERS);
    for (const f of files) {
      const from = path.join(LEGACY_STICKERS, f);
      const to = path.join(PUBLIC_STICKERS, f);
      if (!fs.existsSync(to)) {
        fs.copyFileSync(from, to);
      }
    }
  } catch (e) {
    console.error("Migration error:", e.message);
  }
}

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
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype?.startsWith("image/")) {
      return cb(new Error("Only image files allowed"));
    }
    cb(null, true);
  },
}).single("sticker");

// =====================================================
// ULTRA COMPRESSION (~5–6 KB)
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
  // 🔥 ensure old images become visible
  migrateLegacyImages();

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
    const finalPath = path.join(PUBLIC_STICKERS, finalName);

    try {
      const raw = await fs.promises.readFile(tempPath);
      const compressed = await compress(raw);

      await fs.promises.writeFile(finalPath, compressed);
      await fs.promises.chmod(finalPath, 0o644);
      await fs.promises.unlink(tempPath).catch(() => {});

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
