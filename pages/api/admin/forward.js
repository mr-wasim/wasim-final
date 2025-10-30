import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";
import { sendNotification } from "../../../lib/sendNotification.js";

async function handler(req, res, user) {
  if (req.method !== "POST") return res.status(405).end();

  const { clientName, phone, address, techId, price, type } = req.body || {};
  const db = await getDb();

  // 🔍 Technician fetch
  const tech = await db.collection("technicians").findOne({ _id: new ObjectId(techId) });
  if (!tech) return res.status(400).json({ error: "Technician not found" });

  // 🗃️ Save forwarded call
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

  // 🔔 Fetch FCM token
  const fcmTokenDoc = await db.collection("fcm_tokens").findOne({
    userId: techId,
    role: "technician",
  });

  if (fcmTokenDoc?.token) {
    // ✅ Notification send (main step)
    const payload = {
      notification: {
        title: "📞 New Call Assigned",
        body: `Client: ${clientName} (${phone})\nTap to view details.`,
        sound: "default", // sound enable
      },
      data: {
        techId: techId.toString(),
        click_action: "FLUTTER_NOTIFICATION_CLICK", // universal click support
      },
    };

    await sendNotification(fcmTokenDoc.token, payload);
    console.log("✅ Notification sent to technician:", tech.username);
  } else {
    console.log("⚠️ No FCM token found for technician:", techId);
  }

  res.json({ ok: true });
}

export default requireRole("admin")(handler);
