import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";
import { sendNotification } from "../../../lib/sendNotification.js"; // ✅ Notification import

async function handler(req, res, user) {
  if (req.method !== "POST") return res.status(405).end();

  const { clientName, phone, address, techId, price, type } = req.body || {};
  const db = await getDb();

  const tech = await db.collection("technicians").findOne({ _id: new ObjectId(techId) });
  if (!tech) return res.status(400).json({ error: "Technician not found" });

  // ✅ Forwarded call insert
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

  // ✅ Send Notification to Technician (if FCM token exists)
  try {
    if (tech.fcmToken) {
      await sendNotification(
        tech.fcmToken,
        "New Call Assigned 📞",
        `Hey ${tech.username}, you have a new call from ${clientName}.`
      );
    }
  } catch (err) {
    console.error("❌ Notification error:", err);
  }

  res.json({ ok: true });
}

export default requireRole("admin")(handler);
