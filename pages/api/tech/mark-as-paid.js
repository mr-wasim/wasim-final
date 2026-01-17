// pages/api/tech/mark-as-paid.js
import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";

/**
 * POST /api/tech/mark-as-paid
 * Body: { callId: string }
 *
 * Behavior:
 * - Requires technician role (requireRole)
 * - Validates callId
 * - Updates forwarded_calls document:
 *    - sets paymentStatus = "Paid"
 *    - sets paymentAt = now
 *    - sets paymentRef = "manual-mark:<timestamp>:<techId>"
 *    - pushes small payments history entry with flag manualMark: true
 * - Does NOT insert into global payments collection (as requested)
 */

async function handler(req, res, user) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  try {
    const { callId } = req.body || {};
    if (!callId) return res.status(400).json({ success: false, error: "callId required" });

    const db = await getDb();
    const callsColl = db.collection("forwarded_calls");

    // build filter by ObjectId if possible, otherwise by string id
    let filter;
    if (ObjectId.isValid(callId)) filter = { _id: new ObjectId(callId) };
    else filter = { _id: callId };

    // Only update if not already paid
    filter.$or = [{ paymentStatus: { $exists: false } }, { paymentStatus: { $ne: "Paid" } }];

    const now = new Date();
    const techUsername = user.username || user.email || user.name || String(user.id || "");
    const paymentRef = `manual-mark:${now.getTime()}:${String(user.id || "unknown")}`;

    const update = {
      $set: {
        paymentStatus: "Paid",
        paymentAt: now,
        paymentRef,
      },
      $push: {
        // small internal note so admin can see manual marks (optional)
        payments: {
          paymentId: null,
          onlineAmount: 0,
          cashAmount: 0,
          createdAt: now,
          recordedBy: techUsername,
          manualMark: true,
        },
      },
    };

    const result = await callsColl.updateOne(filter, update);

    if (result.matchedCount === 0) {
      // Either not found or already paid
      // Check if doc exists but already paid
      let exists = null;
      try {
        const check = await callsColl.findOne(
          ObjectId.isValid(callId) ? { _id: new ObjectId(callId) } : { _id: callId },
          { projection: { paymentStatus: 1 } }
        );
        if (check) exists = check;
      } catch (e) {
        // ignore
      }

      if (exists && exists.paymentStatus === "Paid") {
        return res.status(409).json({ success: false, error: "Call already marked as Paid" });
      }
      return res.status(404).json({ success: false, error: "Call not found or cannot be updated" });
    }

    return res.status(200).json({ success: true, message: "Call marked as Paid (visual)", callId, paymentRef });
  } catch (err) {
    console.error("mark-as-paid error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
}

export default requireRole("technician")(handler);
