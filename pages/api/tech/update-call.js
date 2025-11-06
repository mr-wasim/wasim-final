// pages/api/forwarded-calls/update-status.js
import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";

// Optional: lock allowed statuses
const ALLOWED = new Set(["Pending", "Completed", "Closed"]);

async function handler(req, res, user) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { id, status } = req.body || {};

    // ---- validation ----
    if (!id || !status) {
      return res.status(400).json({ ok: false, message: "id and status are required." });
    }
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ ok: false, message: "Invalid id." });
    }
    if (!ALLOWED.has(String(status))) {
      return res.status(400).json({ ok: false, message: "Invalid status value." });
    }

    const _id = new ObjectId(id);

    // techId may be string or ObjectId in DB
    const techIdCandidates = [user.id];
    if (ObjectId.isValid(user.id)) techIdCandidates.push(new ObjectId(user.id));

    const db = await getDb();

    // ---- single round-trip update ----
    const result = await db.collection("forwarded_calls").updateOne(
      { _id, techId: { $in: techIdCandidates } },
      { $set: { status: String(status) } }
    );

    // Private write → no cache
    res.setHeader("Cache-Control", "private, no-store");

    if (result.matchedCount === 0) {
      return res.status(404).json({ ok: false, message: "Call not found for this technician." });
    }

    return res.status(200).json({ ok: true, modified: result.modifiedCount === 1 });
  } catch (e) {
    console.error("update-status error:", e);
    return res.status(500).json({ ok: false, message: "Internal Server Error" });
  }
}

export default requireRole("technician")(handler);

// 👍 Index (once):
// db.forwarded_calls.createIndex({ _id: 1, techId: 1 });
