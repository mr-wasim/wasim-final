// pages/api/tech/submit-form.js
import fs from "fs";
import path from "path";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { requireRole, getDb } from "../../../lib/api-helpers.js";

/*
  endpoint: POST /api/tech/submit-form
  - accepts multipart/form-data
  - files field name: "stickers" (multiple)
  - signature: optional data-url string in 'signature' text field
  - if exact-duplicate exists for the same tech on same day, we APPEND new stickers to that doc
    (prevents uploaded files from being deleted and avoids "pending" UX)
*/

export const config = {
  api: {
    bodyParser: false,
  },
};

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "stickers");
const MAX_FILES = 100;
const MAX_TOTAL_BYTES = 5 * 1024 * 1024; // 5MB
const PER_FILE_LIMIT = 2 * 1024 * 1024; // 2MB per file

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname) || `.${(file.mimetype || "jpg").split("/")[1] || "jpg"}`;
    const name = `sticker_${Date.now()}_${uuidv4()}${ext}`;
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

function normalizePhone(p) {
  if (p == null) return "";
  return String(p).replace(/\D+/g, "").slice(-15);
}
function normalizeText(s) {
  if (s == null) return "";
  return String(s).trim().toLowerCase().replace(/\s+/g, " ");
}

async function handler(req, res, user) {
  if (req.method !== "POST") return res.status(405).end();

  // parse multipart
  try {
    await runMiddleware(req, res, upload.array("stickers", MAX_FILES));
  } catch (err) {
    console.error("Multer parse error:", err);
    let message = err && err.message ? err.message : "File upload error";
    // common multer messages: "File too large"
    return res.status(400).json({ ok: false, message });
  }

  try {
    const { clientName, address, payment = 0, phone, status = "Pending", signature } = req.body || {};

    // basic validation
    if (!clientName || !address || !phone) {
      // cleanup any uploaded files to avoid orphans
      if (req.files && req.files.length) {
        for (const f of req.files) {
          try { fs.unlinkSync(f.path); } catch (e) {}
        }
      }
      return res.status(400).json({ ok: false, message: "clientName, address and phone are required." });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ ok: false, message: "At least one sticker (photo) is required." });
    }

    // total size check
    const totalBytes = req.files.reduce((acc, f) => acc + (f.size || 0), 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      for (const f of req.files) {
        try { fs.unlinkSync(f.path); } catch (e) {}
      }
      return res.status(400).json({ ok: false, message: "Total uploaded files exceed 5MB limit." });
    }

    const db = await getDb();
    const forms = db.collection("service_forms");

    const dayKey = new Date().toISOString().slice(0, 10);
    const paymentNum = Number(payment) || 0;

    const clientNameNorm = normalizeText(clientName);
    const addressNorm = normalizeText(address);
    const phoneNorm = normalizePhone(phone);

    const filter = {
      techId: (user && (user._id || user.id)) ? String(user._id || user.id) : null,
      dayKey,
      clientNameNorm,
      addressNorm,
      phoneNorm,
      payment: paymentNum,
    };

    // saved stickers urls (public path)
    const savedStickers = req.files.map((f) => `/uploads/stickers/${path.basename(f.filename)}`);

    // prepare document to insert if new
    const docOnInsert = {
      techId: filter.techId,
      techUsername: user && user.username ? user.username : null,
      clientName: String(clientName).trim(),
      address: String(address).trim(),
      phone: String(phone).trim(),
      payment: paymentNum,
      status: String(status || "Pending"),
      signature: signature || null,
      stickers: savedStickers.slice(), // initial array
      clientNameNorm,
      addressNorm,
      phoneNorm,
      dayKey,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Try to upsert: if not exists create with stickers; if exists, append stickers (safe behavior)
    // First try findOne to detect existing doc
    const existing = await forms.findOne(filter);

    if (!existing) {
      // insert new
      const insertResult = await forms.insertOne(docOnInsert);
      // success
      return res.status(200).json({
        ok: true,
        id: String(insertResult.insertedId),
        message: "Service form submitted successfully.",
        stickers: savedStickers,
        totalBytes,
      });
    } else {
      // existing: append new stickers to existing doc rather than deleting uploaded files
      const updated = await forms.findOneAndUpdate(
        { _id: existing._id },
        {
          $push: { stickers: { $each: savedStickers } },
          $set: {
            // update signature if provided (overwrite), update status & updatedAt
            ...(signature ? { signature } : {}),
            status: String(status || existing.status || "Pending"),
            updatedAt: new Date(),
          },
        },
        { returnDocument: "after" }
      );

      const updatedDoc = updated.value;

      return res.status(200).json({
        ok: true,
        id: String(updatedDoc._id),
        message: "Existing form updated with new photos.",
        stickers: Array.isArray(updatedDoc.stickers) ? updatedDoc.stickers : savedStickers,
        totalBytes,
      });
    }
  } catch (error) {
    console.error("Service form error:", error);

    // cleanup on unexpected error
    if (req.files && req.files.length) {
      for (const f of req.files) {
        try { fs.unlinkSync(f.path); } catch (e) {}
      }
    }

    if (error?.code === 11000) {
      return res.status(409).json({ ok: false, message: "Duplicate form detected — already submitted." });
    }

    return res.status(500).json({ ok: false, message: "Failed to submit service form." });
  }
}

export default requireRole("technician")(handler);
