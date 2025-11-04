// pages/api/admin/forward.js
import { getDb, requireRole } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";
import { sendNotification } from "../../../lib/sendNotification.js";

// ✅ Wrapper function — no need to call extra wrapper at the end
export default async function handler(req, res) {
  // ✅ Allow only POST + handle preflight CORS
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(200).end();
  }

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
      console.log("✅ Notification sent:", tech.username);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("❌ Error in forward API:", err);
    return res.status(500).json({ error: err.message });
  }
}
