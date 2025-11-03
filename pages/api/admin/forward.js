import { getDb, requireRole } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";
import { sendNotification } from "../../../lib/sendNotification.js";

export default async function handler(req, res) {
  // ✅ Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // ✅ Handle preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // ✅ Block anything except POST
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { clientName, phone, address, techId, price, type } = req.body || {};
    const db = await getDb();

    const tech = await db
      .collection("technicians")
      .findOne({ _id: new ObjectId(techId) });

    if (!tech) {
      return res.status(400).json({ error: "Technician not found" });
    }

    await db.collection("forwarded_calls").insertOne({
      clientName,
      phone,
      address,
      price,
      type,
      techId: tech._id,
      techName: tech.username,
      status: "Pending",
      createdAt: new Date(),
    });

    const fcmToken = await db
      .collection("fcm_tokens")
      .findOne({ userId: techId, role: "technician" });

    if (fcmToken?.token) {
      await sendNotification(
        fcmToken.token,
        "📞 New Call Assigned",
        `New client ${clientName} (${phone}) assigned to you.`,
        { techId }
      );
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("❌ Error in forward API:", err);
    return res.status(500).json({ error: err.message });
  }
}
