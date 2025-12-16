// pages/api/tech/submit-form.js
import fs from "fs";
import path from "path";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { requireRole, getDb } from "../../../lib/api-helpers.js";

/*
  POST /api/tech/submit-form
  - multipart/form-data
  - field "stickers" => image files (multiple)
  - field "signature" => optional data URL string (base64)
  - returns { ok: true, id, stickers: [url,...] }
  Designed for VPS (writes files to public/uploads/stickers)
*/

export const config = {
  api: {
    bodyParser: false, // multer handles parsing
  },
};

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "stickers");
const MAX_FILES = 100;
const MAX_TOTAL_BYTES = 5 * 1024 * 1024; // 5 MB total
const PER_FILE_LIMIT = 2 * 1024 * 1024; // 2 MB per file

// ensure folder exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  // best-effort permissions
  try { fs.chmodSync(UPLOAD_DIR, 0o755); } catch (e) {}
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
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
  if (req.method !== "POST") return res.status(405).json({ ok: false, message: "Method not allowed" });

  // parse multipart
  try {
    await runMiddleware(req, res, upload.array("stickers", MAX_FILES));
  } catch (err) {
    console.error("Multer parse error:", err && err.message ? err.message : err);
    const msg = err && err.message ? err.message : "File upload error";
    return res.status(400).json({ ok: false, message: msg });
  }

  // now handle form
  try {
    const { clientName, address, payment = 0, phone, status = "Pending", signature } = req.body || {};

    // validation
    if (!clientName || !address || !phone) {
      // cleanup any uploaded files (safety)
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

    // check combined size
    const totalBytes = req.files.reduce((acc, f) => acc + (f.size || 0), 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      // delete files
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

    const techId = user && (user._id || user.id) ? String(user._id || user.id) : null;

    const filter = {
      techId,
      dayKey,
      clientNameNorm,
      addressNorm,
      phoneNorm,
      payment: paymentNum,
    };

    // Build public URLs for saved files
    const savedStickers = req.files.map((f) => `/uploads/stickers/${path.basename(f.filename)}`);

    // document to insert if new
    const docOnInsert = {
      techId,
      techUsername: user && user.username ? user.username : null,
      clientName: String(clientName).trim(),
      address: String(address).trim(),
      phone: String(phone).trim(),
      payment: paymentNum,
      status: String(status || "Pending"),
      signature: signature || null,
      stickers: savedStickers.slice(),
      clientNameNorm,
      addressNorm,
      phoneNorm,
      dayKey,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Try find existing (duplicate detection)
    const existing = await forms.findOne(filter);

    if (!existing) {
      // Insert new document
      const insertResult = await forms.insertOne(docOnInsert);
      return res.status(200).json({
        ok: true,
        id: String(insertResult.insertedId),
        message: "Service form submitted successfully.",
        stickers: savedStickers,
        totalBytes,
      });
    } else {
      // Append new stickers to existing document
      const updated = await forms.findOneAndUpdate(
        { _id: existing._id },
        {
          $push: { stickers: { $each: savedStickers } },
          $set: {
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
