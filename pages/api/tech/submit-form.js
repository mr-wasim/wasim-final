// pages/api/service-forms/create.js
import { requireRole, getDb } from "../../../lib/api-helpers.js";

function normalizePhone(p) {
  if (p == null) return "";
  // keep digits only (e.g., "+91 98-76" -> "919876")
  return String(p).replace(/\D+/g, "").slice(-15); // cap length safety
}

function normalizeText(s) {
  if (s == null) return "";
  return String(s).trim().toLowerCase().replace(/\s+/g, " "); // collapse spaces
}

async function handler(req, res, user) {
  if (req.method !== "POST") return res.status(405).end();

  try {
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
      return res.status(400).json({
        ok: false,
        message: "clientName, address and phone are required.",
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

    // यह filter uniquely define करता है "same submission today"
    const filter = {
      techId: user.id,      // तुम्हारे सिस्टम में techId string है; वही रखें
      dayKey,
      clientNameNorm,
      addressNorm,
      phoneNorm,
      payment: paymentNum,
    };

    const docOnInsert = {
      // original fields (as-is for display)
      techId: user.id,
      techUsername: user.username,
      clientName: String(clientName).trim(),
      address: String(address).trim(),
      phone: String(phone).trim(),
      payment: paymentNum,
      status: String(status || "Pending"),
      signature: signature || null,

      // normalized fields (index + duplicate guard)
      clientNameNorm,
      addressNorm,
      phoneNorm,
      dayKey,

      createdAt: new Date(),
    };

    // ---- single round-trip: insert only if not exists ----
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
      });
    }

    // Matched an existing doc => duplicate
    return res.status(409).json({
      ok: false,
      message: "Duplicate form detected — this form is already submitted today.",
    });
  } catch (error) {
    // unique index duplicate safety
    if (error?.code === 11000) {
      return res.status(409).json({
        ok: false,
        message: "Duplicate form detected — this form is already submitted today.",
      });
    }
    console.error("Service form error:", error);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to submit service form." });
  }
}

export default requireRole("technician")(handler);

/*
⚡ Run these indexes once (Mongo shell / migration) for true uniqueness + speed:

// Exact uniqueness per day per technician on normalized fields
db.service_forms.createIndex(
  { techId: 1, dayKey: 1, phoneNorm: 1, clientNameNorm: 1, addressNorm: 1, payment: 1 },
  { unique: true, name: "uniq_service_form_per_day_norm" }
);

// Fast daily queries for a technician
db.service_forms.createIndex({ techId: 1, dayKey: 1, createdAt: -1 });

// If you'll filter by status often
db.service_forms.createIndex({ techId: 1, status: 1, createdAt: -1 });
*/
