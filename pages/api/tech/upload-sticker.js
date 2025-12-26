// pages/api/tech/upload-sticker.js
// =====================================================
// FINAL PERMANENT FIX (PRODUCTION READY)
// - All uploads -> public/uploads/stickers
// - Legacy images auto-migrated ONCE (safe)
// - Multer diskStorage
// - Sharp ultra compression (~5–6KB)
// - ZERO 404 on VPS
// =====================================================

import multer from "multer";
import fs from "fs";
import path from "path";
import sharp from "sharp";

export const config = {
  api: { bodyParser: false },
};

// =====================================================
// PATHS
// =====================================================
const CWD = process.cwd();

const PUBLIC_UPLOADS = path.join(CWD, "public", "uploads");
const PUBLIC_STICKERS = path.join(PUBLIC_UPLOADS, "stickers");
const TMP_DIR = path.join(PUBLIC_UPLOADS, "tmp");

// legacy (old VPS path)
const LEGACY_ROOT = "/var/www/chimney-uploads";
const LEGACY_STICKERS = path.join(LEGACY_ROOT, "stickers");

// =====================================================
// ENSURE DIRECTORIES
// =====================================================
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

ensureDir(PUBLIC_UPLOADS);
ensureDir(PUBLIC_STICKERS);
ensureDir(TMP_DIR);

// =====================================================
// 🔁 SAFE ONE-TIME MIGRATION (LIGHTWEIGHT)
// =====================================================
let migrated = false;

function migrateLegacyImagesOnce() {
  if (migrated) return;
  migrated = true;

  try {
    if (!fs.existsSync(LEGACY_STICKERS)) return;

    const files = fs.readdirSync(LEGACY_STICKERS);
    for (const file of files) {
      const from = path.join(LEGACY_STICKERS, file);
      const to = path.join(PUBLIC_STICKERS, file);

      if (!fs.existsSync(to)) {
        fs.copyFileSync(from, to);
      }
    }
  } catch (err) {
    console.error("Legacy migration error:", err.message);
  }
}

// =====================================================
// MULTER (RAW IMAGE ACCEPT)
// =====================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TMP_DIR);
  },
  filename: (req, file, cb) => {
    const ext =
      path.extname(file.originalname || "").toLowerCase() || ".jpg";
    const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext)
      ? ext
      : ".jpg";

    cb(
      null,
      `raw_${Date.now()}_${Math.floor(Math.random() * 100000)}${safeExt}`
    );
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files allowed"));
    }
    cb(null, true);
  },
}).single("sticker");

// =====================================================
// SHARP COMPRESSION CONFIG
// =====================================================
const TARGET_BYTES = 6 * 1024; // ~6KB
const OUTPUT_WIDTH = 64;

async function compressImage(buffer) {
  return sharp(buffer)
    .rotate()
    .resize({
      width: OUTPUT_WIDTH,
      withoutEnlargement: true,
    })
    .webp({
      quality: 6,
      effort: 6,
    })
    .toBuffer();
}

// =====================================================
// HANDLER
// =====================================================
export default function handler(req, res) {
  // make sure old images are visible
  migrateLegacyImagesOnce();

  if (req.method !== "POST") {
    return res.status(405).json({ success: false });
  }

  upload(req, res, async (err) => {
    // -------- multer error --------
    if (err) {
      if (req.file?.path) {
        fs.promises.unlink(req.file.path).catch(() => {});
      }

      return res.status(400).json({
        success: false,
        error:
          err.code === "LIMIT_FILE_SIZE"
            ? "Image too large (15MB max)"
            : err.message,
      });
    }

    // -------- no file --------
    if (!req.file || !req.file.path) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    const tempPath = req.file.path;
    const finalName = `sticker_${Date.now()}_${Math.floor(
      Math.random() * 100000
    )}.webp`;
    const finalPath = path.join(PUBLIC_STICKERS, finalName);

    try {
      const rawBuffer = await fs.promises.readFile(tempPath);
      const compressed = await compressImage(rawBuffer);

      await fs.promises.writeFile(finalPath, compressed);
      await fs.promises.chmod(finalPath, 0o644);

      // cleanup temp
      await fs.promises.unlink(tempPath).catch(() => {});

      return res.status(200).json({
        success: true,
        url: `/uploads/stickers/${finalName}`,
        sizeKB: Math.round(compressed.length / 1024),
      });
    } catch (error) {
      console.error("Sticker processing error:", error);

      await fs.promises.unlink(tempPath).catch(() => {});

      return res.status(500).json({
        success: false,
        error: "Image processing failed",
      });
    }
  });
}
