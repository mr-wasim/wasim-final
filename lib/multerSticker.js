import multer from "multer";
import fs from "fs";
import path from "path";

/**
 * Base upload path (VPS permanent folder)
 * Example: /var/www/chimney/uploads
 */
const BASE_PATH =
  process.env.UPLOAD_BASE_PATH || "/var/www/chimney/uploads";

const STICKER_DIR = path.join(BASE_PATH, "stickers");

/**
 * Ensure folder exists
 */
if (!fs.existsSync(STICKER_DIR)) {
  fs.mkdirSync(STICKER_DIR, { recursive: true });
}

/**
 * Multer disk storage
 * - destination: stickers folder
 * - filename: auto from mimetype
 */
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, STICKER_DIR);
  },

  filename: function (req, file, cb) {
    const mime = file.mimetype || "image/jpeg";
    let ext = mime.split("/")[1] || "jpg";

    // safety
    if (!["jpg", "jpeg", "png", "webp"].includes(ext)) {
      ext = "jpg";
    }

    const filename = `${Date.now()}_${Math.floor(
      Math.random() * 1000000
    )}.${ext}`;

    cb(null, filename);
  },
});

/**
 * Allow only images
 */
const fileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith("image/")) {
    cb(new Error("Only image files allowed"), false);
  } else {
    cb(null, true);
  }
};

/**
 * Export multer instance
 */
export const uploadSticker = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});
