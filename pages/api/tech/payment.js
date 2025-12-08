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
      calls = [],
    } = req.body || {};

    if (!receiver) return res.status(400).json({ ok: false, message: "Paying name required." });
    if (!mode) return res.status(400).json({ ok: false, message: "Mode required." });
    if (!Array.isArray(calls) || calls.length === 0)
      return res.status(400).json({ ok: false, message: "At least 1 call must be selected." });

    const db = await getDb();
    const payments = db.collection("payments");
    const forwardedCalls = db.collection("forwarded_calls");

    const techId = ObjectId.isValid(user.id) ? new ObjectId(user.id) : user.id;

    const numOnline = Number(onlineAmount) || 0;
    const numCash = Number(cashAmount) || 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayKey = today.toISOString().slice(0, 10);

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

    const fingerprint = {
      techId,
      receiver,
      dayKey,
      onlineAmount: numOnline,
      cashAmount: numCash,
      callsCount: callArray.length,
    };

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
      calls: callArray,
    };

    const result = await payments.updateOne(
      fingerprint,
      { $setOnInsert: paymentDoc },
      { upsert: true }
    );

    // ⭐ SUPER FAST PAYMENT STATUS UPDATE USING BULK WRITE ⭐
    if (result.upsertedCount === 1) {
      const bulkOps = callArray
        .filter((c) => c.callId)
        .map((c) => ({
          updateOne: {
            filter: { _id: c.callId },
            update: { $set: { paymentStatus: "Paid" } }
          }
        }));

      if (bulkOps.length > 0) {
        await forwardedCalls.bulkWrite(bulkOps, { ordered: false });
      }
    }

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
