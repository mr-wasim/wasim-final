// pages/api/payments/create.js
import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";

async function handler(req, res, user) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const {
      receiver,
      mode,
      onlineAmount = 0,
      cashAmount = 0,
      receiverSignature, // optional (e.g., base64)
    } = req.body || {};

    // ---- validation (tight & cheap) ----
    if (!receiver || !mode) {
      return res.status(400).json({ ok: false, message: "Missing required fields." });
    }

    const db = await getDb();
    const payments = db.collection("payments");

    // tech id may be ObjectId or string in DB
    const techId = ObjectId.isValid(user.id) ? new ObjectId(user.id) : user.id;

    // ---- normalize inputs ----
    const numOnline = Number(onlineAmount) || 0;
    const numCash = Number(cashAmount) || 0;

    // ISO day key -> avoids range scans on createdAt >= today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayKey = today.toISOString().slice(0, 10); // "YYYY-MM-DD"

    // Uniqueness fingerprint for "same payment today"
    const filter = {
      techId,
      receiver,
      mode,
      onlineAmount: numOnline,
      cashAmount: numCash,
      dayKey,
    };

    const docOnInsert = {
      techId,
      techUsername: user.username,
      receiver,
      mode,
      onlineAmount: numOnline,
      cashAmount: numCash,
      receiverSignature,
      dayKey,
      createdAt: new Date(),
    };

    // ---- single round-trip (no findOne) ----
    const result = await payments.updateOne(filter, { $setOnInsert: docOnInsert }, { upsert: true });

    // private write -> no cache
    res.setHeader("Cache-Control", "private, no-store");

    if (result.upsertedCount === 1) {
      // inserted new document
      const insertedId = result.upsertedId?._id || result.upsertedId;
      return res.status(200).json({
        ok: true,
        message: "Payment recorded successfully.",
        id: String(insertedId || ""),
      });
    }

    // matched existing -> duplicate
    return res.status(409).json({
      ok: false,
      message: "Duplicate payment detected — this payment already recorded today.",
    });
  } catch (error) {
    // duplicate key safety (if unique index is present)
    if (error?.code === 11000) {
      return res.status(409).json({
        ok: false,
        message: "Duplicate payment detected — this payment already recorded today.",
      });
    }
    console.error("Payment error:", error);
    return res.status(500).json({ ok: false, message: "Payment All ready submited" });
  }
}

export default requireRole("technician")(handler);

/*
⚡ Indexes (run once in Mongo shell / migration) — massive speed-up + true uniqueness:

// Exact uniqueness for "same payment today"
db.payments.createIndex(
  { techId: 1, receiver: 1, mode: 1, onlineAmount: 1, cashAmount: 1, dayKey: 1 },
  { unique: true, name: "uniq_payment_per_day_per_combo" }
);

// Fast lookups by day/user if you show daily reports
db.payments.createIndex({ techId: 1, dayKey: 1, createdAt: -1 });
*/
