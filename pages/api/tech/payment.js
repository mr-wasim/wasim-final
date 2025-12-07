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
      receiverSignature,
      calls = [], // 🔥 MULTI CALLS
    } = req.body || {};

    // ---------------- VALIDATION ----------------
    if (!receiver) {
      return res.status(400).json({ ok: false, message: "Paying name required." });
    }
    if (!mode) {
      return res.status(400).json({ ok: false, message: "Mode required." });
    }
    if (!Array.isArray(calls) || calls.length === 0) {
      return res.status(400).json({
        ok: false,
        message: "At least 1 call must be selected.",
      });
    }

    const db = await getDb();
    const payments = db.collection("payments");

    const techId = ObjectId.isValid(user.id) ? new ObjectId(user.id) : user.id;

    const numOnline = Number(onlineAmount) || 0;
    const numCash = Number(cashAmount) || 0;

    // ---------------- DAY KEY ----------------
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayKey = today.toISOString().slice(0, 10);

    // ---------------- PREP CALLS ARRAY ----------------
    const callArray = calls.map((c) => ({
      callId: c.callId ? (ObjectId.isValid(c.callId) ? new ObjectId(c.callId) : c.callId) : null,
      clientName: c.clientName || "",
      phone: c.phone || "",
      address: c.address || "",
      type: c.type || "",
      price: Number(c.price) || 0,
      onlineAmount: Number(c.onlineAmount) || 0,
      cashAmount: Number(c.cashAmount) || 0,
    }));

    // ---------------- UNIQUE FINGERPRINT (STRONGER) ----------------
    const fingerprint = {
      techId,
      receiver,
      dayKey,
      onlineAmount: numOnline,
      cashAmount: numCash,
      callsCount: callArray.length,       // 🔥 अब calls भी uniqueness में शामिल
    };

    // ---------------- PAYMENT DOC ----------------
    const paymentDoc = {
      techId,
      techUsername: user.username,
      receiver,
      mode,
      onlineAmount: numOnline,
      cashAmount: numCash,
      receiverSignature: receiverSignature || null,
      dayKey,
      createdAt: new Date(),
      calls: callArray,   // 🔥 FULL CALL BREAKDOWN SAVED HERE
    };

    // ---------------- UPSERT ----------------
    const result = await payments.updateOne(
      fingerprint,
      { $setOnInsert: paymentDoc },
      { upsert: true }
    );

    res.setHeader("Cache-Control", "private, no-store");

    if (result.upsertedCount === 1) {
      return res.status(200).json({
        ok: true,
        message: "Payment saved successfully.",
        id: String(result.upsertedId._id || result.upsertedId),
      });
    }

    return res.status(409).json({
      ok: false,
      message: "Payment already submitted today.",
    });

  } catch (error) {
    console.error("🔥 Payment Error:", error);

    return res.status(500).json({
      ok: false,
      message: "Server error: Unable to save payment",
    });
  }
}

export default requireRole("technician")(handler);

/*
============================================================
🔥 REQUIRED INDEXES (RUN ONCE IN MONGO)
============================================================

// Calls-count based fingerprint → safe & unique
db.payments.createIndex(
  { techId: 1, receiver: 1, dayKey: 1, onlineAmount: 1, cashAmount: 1, callsCount: 1 },
  { unique: true, name: "unique_payment_fingerprint" }
);

// Date speed index
db.payments.createIndex({ techId: 1, createdAt: -1 });

// Fast call lookup
db.payments.createIndex({ "calls.callId": 1 });
*/
