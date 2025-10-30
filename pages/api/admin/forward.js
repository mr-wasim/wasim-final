// /pages/api/admin/forward.js

import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";
import { sendNotification } from "../../../lib/sendNotification.js";

async function handler(req, res, user) {
  // ✅ Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { clientName, phone, address, techId, price, type } = req.body || {};
  const db = await getDb();

  // 🔍 Check technician
  const tech = await db
    .collection("technicians")
    .findOne({ _id: new ObjectId(techId) });

  if (!tech) {
    return res.status(400).json({ error: "Technician not found" });
  }

  // 💾 Save forwarded call
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

  // 🔔 Get FCM token for technician
  const fcmTokenDoc = await db.collection("fcm_tokens").findOne({
    userId: techId,
    role: "technician",
  });

  // ✅ Send notification if token exists
  if (fcmTokenDoc?.token) {
    console.log("📲 Sending FCM notification to:", tech.username);

    await sendNotification(
      fcmTokenDoc.token,
      "📞 New Call Assigned",
      `Client: ${clientName} (${phone})\nTap to view details.`,
      {
        techId: techId.toString(),
        click_action: "FLUTTER_NOTIFICATION_CLICK",
      }
    );

    console.log("✅ Notification sent successfully to technician:", tech.username);
  } else {
    console.log("⚠️ No FCM token found for technician:", techId);
  }

  return res.json({ ok: true });
}

export default requireRole("admin")(handler);
