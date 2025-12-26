// pages/api/service-forms/create.js
import { requireRole, getDb } from "../../../lib/api-helpers.js";

/**
 * Normalizes phone: keep digits only, cap length for safety.
 * Returns empty string on null/undefined.
 */
function normalizePhone(p) {
  if (p == null) return "";
  const onlyDigits = String(p).replace(/\D+/g, "");
  // keep last 15 digits at most (handles country codes)
  return onlyDigits.slice(-15);
}

/**
 * Normalize text for duplicate detection: trim, collapse whitespace, lowercase.
 * Returns empty string on null/undefined.
 */
function normalizeText(s) {
  if (s == null) return "";
  return String(s).trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Lightweight URL validation for public sticker URL returned by server.
 */
function looksLikePublicUrl(u) {
  if (!u || typeof u !== "string") return false;
  // allow relative (e.g. /uploads/stickers/...) or absolute http(s)
  return /^(\/uploads\/|https?:\/\/)/i.test(u);
}

/**
 * Validate DataURL signature shape (data:image/...;base64,...)
 */
function looksLikeDataUrl(d) {
  if (!d || typeof d !== "string") return false;
  return /^data:image\/(png|jpeg|jpg|webp);base64,/.test(d);
}

async function handler(req, res, user) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    // parse body (Next.js already gives parsed JSON)
    const {
      clientName,
      address,
      payment = 0,
      phone,
      status = "Pending",
      signature = null,
      stickerUrl = null,
    } = req.body || {};

    // ---- required fields ----
    if (!clientName || !address || !phone) {
      return res.status(400).json({
        ok: false,
        message: "clientName, address and phone are required.",
      });
    }

    // ---- basic sanitization & normalization ----
    const clientNameStr = String(clientName).trim().slice(0, 200); // cap length
    const addressStr = String(address).trim().slice(0, 1000); // cap length
    const phoneNorm = normalizePhone(phone);
    const paymentNum = Number(payment) || 0;
    const statusStr = String(status || "Pending").slice(0, 80);

    // optional: validate signature shape (if provided)
    let signatureToStore = null;
    if (signature) {
      // accept data URLs up to a reasonable length (e.g., 200KB)
      if (!looksLikeDataUrl(signature)) {
        // if caller sent a short id or url, allow but don't store raw unvalidated content
        if (typeof signature === "string" && looksLikePublicUrl(signature)) {
          signatureToStore = signature;
        } else {
          return res.status(400).json({
            ok: false,
            message: "Invalid signature format. Expect data:image/... or public URL.",
          });
        }
      } else {
        // limit size (measured by base64 length)
        const sizeApprox = Math.ceil((signature.length - signature.indexOf(",") - 1) * 3 / 4);
        if (sizeApprox > 200 * 1024) {
          return res.status(400).json({
            ok: false,
            message: "Signature image too large (max ~200KB).",
          });
        }
        signatureToStore = signature;
      }
    }

    // optional: stickerUrl should be a public path returned by our upload endpoint
    let stickerUrlToStore = null;
    if (stickerUrl) {
      if (!looksLikePublicUrl(stickerUrl)) {
        return res.status(400).json({
          ok: false,
          message: "Invalid stickerUrl format.",
        });
      }
      stickerUrlToStore = String(stickerUrl).trim().slice(0, 1000);
    }

    // ---- prepare duplicate-detection fingerprint (per-day) ----
    const clientNameNorm = normalizeText(clientNameStr);
    const addressNorm = normalizeText(addressStr);
    const dayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // ---- DB: insert only if not exists (single atomic op) ----
    const db = await getDb();
    const forms = db.collection("service_forms");

    const filter = {
      techId: user.id,
      dayKey,
      clientNameNorm,
      addressNorm,
      phoneNorm,
      payment: paymentNum,
    };

    const docOnInsert = {
      techId: user.id,
      techUsername: user.username || null,
      clientName: clientNameStr,
      address: addressStr,
      phone: String(phone).trim(),
      payment: paymentNum,
      status: statusStr,
      signature: signatureToStore,
      stickerUrl: stickerUrlToStore,
      clientNameNorm,
      addressNorm,
      phoneNorm,
      dayKey,
      createdAt: new Date(),
      userAgent: req.headers["user-agent"] || null,
      ip: req.headers["x-forwarded-for"] || req.connection?.remoteAddress || null,
    };

    // use $setOnInsert so existing documents are left untouched
    const result = await forms.updateOne(
      filter,
      { $setOnInsert: docOnInsert },
      { upsert: true }
    );

    // Ensure no caching of personal submissions
    res.setHeader("Cache-Control", "private, no-store");

    // Detect insertion robustly:
    // result may contain upsertedId (object) or upsertedCount depending on driver
    const wasInserted =
      (result?.upsertedId && (result.upsertedId._id || result.upsertedId)) ||
      result?.upsertedCount === 1;

    if (wasInserted) {
      // compute id string
      let insertedId = null;
      if (result.upsertedId) {
        // result.upsertedId can be {_id: ObjectId} or ObjectId
        if (typeof result.upsertedId === "object" && result.upsertedId._id) {
          insertedId = String(result.upsertedId._id);
        } else {
          insertedId = String(result.upsertedId);
        }
      } else if (result.upsertedCount === 1 && result.upsertedId) {
        // rare other shapes
        insertedId = String(result.upsertedId?._id || result.upsertedId);
      }

      return res.status(201).json({
        ok: true,
        id: insertedId || "",
        message: "Service form submitted successfully.",
      });
    }

    // If nothing was upserted, an existing matching doc was present -> duplicate
    return res.status(409).json({
      ok: false,
      message: "Duplicate form detected — this form is already submitted today.",
    });
  } catch (error) {
    // handle unique index duplicate error if thrown by DB
    if (error?.code === 11000) {
      return res.status(409).json({
        ok: false,
        message: "Duplicate form detected — this form is already submitted today.",
      });
    }

    console.error("Service form create error:", error);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to submit service form." });
  }
}

export default requireRole("technician")(handler);

/*
⚡ Recommended Mongo indexes (run once via migration or mongo shell):

db.service_forms.createIndex(
  { techId: 1, dayKey: 1, phoneNorm: 1, clientNameNorm: 1, addressNorm: 1, payment: 1 },
  { unique: true, name: "uniq_service_form_per_day_norm" }
);

db.service_forms.createIndex({ techId: 1, dayKey: 1, createdAt: -1 });
db.service_forms.createIndex({ techId: 1, status: 1, createdAt: -1 });
*/
