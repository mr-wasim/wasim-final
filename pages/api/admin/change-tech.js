import { ObjectId } from "mongodb";
import { getDb, requireRole } from "../../../lib/api-helpers.js";

function safeParseBody(body) {
  try { return typeof body === "string" ? JSON.parse(body) : body; } catch { return body; }
}

export default requireRole("admin")(async (req, res) => {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const db = await getDb();
    const { callId, newTech } = safeParseBody(req.body) || {};

    if (!callId || !newTech)
      return res.status(400).json({ error: "Missing required fields" });

    const callObjId = new ObjectId(callId);

    // ⭐ Fetch existing call
    const call = await db.collection("forwarded_calls").findOne({ _id: callObjId });
    if (!call)
      return res.status(404).json({ error: "Call not found in forwarded_calls" });

    const oldTechId = call.techId || call.technicianId || null;

    // ⭐ Fetch new technician data (IMPORTANT)
    const newTechData = await db
      .collection("technicians")
      .findOne({ _id: new ObjectId(newTech) });

    if (!newTechData)
      return res.status(404).json({ error: "Technician not found" });

    const newTechName =
      newTechData.username ||
      newTechData.name ||
      newTechData.fullName ||
      newTechData.techName ||
      "Unknown Technician";

    // ⭐ Update call with new technician + name (UI FIX)
    await db.collection("forwarded_calls").updateOne(
      { _id: callObjId },
      {
        $set: {
          techId: new ObjectId(newTech),
          technicianId: new ObjectId(newTech),
          techName: newTechName          // ✔ THIS FIXES THE UI
        }
      }
    );

    // ⭐ Remove from old technician
    if (oldTechId) {
      await db.collection("technicians").updateOne(
        { _id: new ObjectId(oldTechId) },
        { $pull: { assignedCalls: callId } }
      );
    }

    // ⭐ Add to new technician
    await db.collection("technicians").updateOne(
      { _id: new ObjectId(newTech) },
      { $addToSet: { assignedCalls: callId } }
    );

    return res.status(200).json({
      success: true,
      message: "Technician updated successfully",
      techName: newTechName
    });

  } catch (err) {
    console.error("CHANGE TECH ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});
