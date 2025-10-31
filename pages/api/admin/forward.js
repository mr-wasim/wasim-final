import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";
import { sendNotification } from "../../../lib/sendNotification.js";

async function handler(req, res, user) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { clientName, phone, address, techId, price, type } = req.body || {};
    const db = await getDb();
    const tech = await db.collection('technicians').findOne({ _id: new ObjectId(techId) });
    if (!tech) return res.status(400).json({ error: 'Technician not found' });

    await db.collection('forwarded_calls').insertOne({
      clientName,
      phone,
      address,
      price,
      type,
      techId: tech._id,
      techName: tech.username,
      status: 'Pending',
      createdAt: new Date(),
    });

    const fcmToken = await db.collection('fcm_tokens').findOne({ userId: techId, role: 'technician' });

    if (fcmToken?.token) {
      await sendNotification(
        fcmToken.token,
        "📞 New Call Assigned",
        `New client ${clientName} (${phone}) assigned to you. Click to view.`,
        { techId }
      );
      console.log("✅ Notification sent to technician:", tech.username);
    } else {
      console.log("⚠️ No FCM token found for technician:", techId);
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Error forwarding call:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export default requireRole('admin')(handler);
