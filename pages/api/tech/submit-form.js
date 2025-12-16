// pages/api/service-forms/create.js
import fs from "fs";
import path from "path";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { requireRole, getDb } from "../../../lib/api-helpers.js";

/*
  Updated: multer-based stickers upload.
  - Accepts multipart/form-data with field 'stickers' (files).
  - Enforces: at least one sticker required.
  - Per-file limit: 2MB (multer). Max files: 100.
  - Total combined size limit: 5MB (checked after upload).
  - Keeps existing duplicate upsert logic; if duplicate detected uploaded files are removed.
*/

export const config = {
  api: {
    bodyParser: false, // multer will parse the multipart body
  },
};

function normalizePhone(p) {
  if (p == null) return "";
  return String(p).replace(/\D+/g, "").slice(-15);
}

function normalizeText(s) {
  if (s == null) return "";
  return String(s).trim().toLowerCase().replace(/\s+/g, " ");
}

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "stickers");
const MAX_FILES = 100;
const MAX_TOTAL_BYTES = 5 * 1024 * 1024; // 5 MB
const PER_FILE_LIMIT = 2 * 1024 * 1024; // 2 MB per file multer limit

// ensure upload dir exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const safeExt = path.extname(file.originalname) || `.${(file.mimetype || "jpg").split("/")[1] || "jpg"}`;
    const name = `sticker_${Date.now()}_${uuidv4()}${safeExt}`;
    cb(null, name);
  },
});

function fileFilter(req, file, cb) {
  if (!file.mimetype || !file.mimetype.startsWith("image/")) {
    cb(new Error("Only image files are allowed"));
  } else {
    cb(null, true);
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    files: MAX_FILES,
    fileSize: PER_FILE_LIMIT,
  },
});

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

// handler signature preserved: (req, res, user)
async function handler(req, res, user) {
  if (req.method !== "POST") return res.status(405).end();

  // parse multipart with multer
  try {
    await runMiddleware(req, res, upload.array("stickers", MAX_FILES));
  } catch (err) {
    console.error("Multer parse error:", err);
    // multer errors come with messages like "File too large", etc.
    return res.status(400).json({ ok: false, message: err.message || "File upload error" });
  }

  try {
    // Text fields are available on req.body now
    const {
      clientName,
      address,
      payment = 0,
      phone,
      status = "Pending",
      signature,
    } = req.body || {};

    // ---- lightweight validation ----
    if (!clientName || !address || !phone) {
      // cleanup uploaded files if any
      if (req.files && req.files.length) {
        for (const f of req.files) {
          try { fs.unlinkSync(f.path); } catch (e) {}
        }
      }
      return res.status(400).json({
        ok: false,
        message: "clientName, address and phone are required.",
      });
    }

    // require at least one sticker
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        ok: false,
        message: "At least one sticker (photo) is required.",
      });
    }

    // check total combined size
    const totalBytes = req.files.reduce((acc, f) => acc + (f.size || 0), 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      // delete uploaded files
      for (const f of req.files) {
        try { fs.unlinkSync(f.path); } catch (e) {}
      }
      return res.status(400).json({
        ok: false,
        message: "Total uploaded files exceed 5MB limit.",
      });
    }

    const db = await getDb();
    const forms = db.collection("service_forms");

    // ---- normalize & fingerprint (for exact duplicate detection per day) ----
    const dayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const paymentNum = Number(payment) || 0;

    const clientNameNorm = normalizeText(clientName);
    const addressNorm = normalizeText(address);
    const phoneNorm = normalizePhone(phone);

    const filter = {
      techId: user.id, // preserve your original key (user.id)
      dayKey,
      clientNameNorm,
      addressNorm,
      phoneNorm,
      payment: paymentNum,
    };

    // build savedStickers urls
    const savedStickers = req.files.map((f) => `/uploads/stickers/${path.basename(f.filename)}`);

    const docOnInsert = {
      techId: user.id,
      techUsername: user.username,
      clientName: String(clientName).trim(),
      address: String(address).trim(),
      phone: String(phone).trim(),
      payment: paymentNum,
      status: String(status || "Pending"),
      signature: signature || null,
      // stickers urls
      stickers: savedStickers,

      // normalized fields
      clientNameNorm,
      addressNorm,
      phoneNorm,
      dayKey,

      createdAt: new Date(),
    };

    // single round-trip: insert only if not exists
    const result = await forms.updateOne(
      filter,
      { $setOnInsert: docOnInsert },
      { upsert: true }
    );

    res.setHeader("Cache-Control", "private, no-store");

    if (result.upsertedCount === 1) {
      const insertedId = result.upsertedId?._id || result.upsertedId;
      return res.status(200).json({
        ok: true,
        id: String(insertedId || ""),
        message: "Service form submitted successfully.",
        stickers: savedStickers,
        totalBytes,
      });
    }

    // Matched an existing doc => duplicate
    // cleanup uploaded files because not used
    if (req.files && req.files.length) {
      for (const f of req.files) {
        try { fs.unlinkSync(f.path); } catch (e) {}
      }
    }

    return res.status(409).json({
      ok: false,
      message: "Duplicate form detected — this form is already submitted today.",
    });
  } catch (error) {
    console.error("Service form error:", error);

    // cleanup on unexpected error
    if (req.files && req.files.length) {
      for (const f of req.files) {
        try { fs.unlinkSync(f.path); } catch (e) {}
      }
    }

    // handle duplicate key error safety
    if (error?.code === 11000) {
      return res.status(409).json({
        ok: false,
        message: "Duplicate form detected — this form is already submitted today.",
      });
    }

    return res.status(500).json({ ok: false, message: "Failed to submit service form." });
  }
}

// export with same wrapper as before
export default requireRole("technician")(handler);
