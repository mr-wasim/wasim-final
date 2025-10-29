import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";
import { sendNotification } from "../../../lib/sendNotification.js"; // ✅ Notification import

async function handler(req, res, user) {
  if (req.method !== "POST") return res.status(405).end();

  const { clientName, phone, address, techId, price, type } = req.body || {};

  const db = await getDb();
  const tech = await db.collection("technicians").findOne({ _id: new ObjectId(techId) });
  if (!tech) return res.status(400).json({ error: "Technician not found" });

  // ✅ Save forwarded call to DB (no change)
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

  // ✅ Notification logic (new)
  try {
    // technician ke tokens find karo
    const tokens = await db
      .collection("fcm_tokens")
      .find({ userId: tech._id.toString() })
      .toArray();

    if (tokens.length > 0) {
      const tokenList = tokens.map((t) => t.token);
      const title = "📞 New Call Assigned";
      const body = `${clientName} (${phone}) - ${address}`;
      const data = { type: "call_forwarded", techId: tech._id.toString() };

      for (const token of tokenList) {
        await sendNotification(token, title, body, data);
      }
      console.log("✅ Notification sent to technician:", tech.username);
    } else {
      console.warn("⚠️ Technician has no FCM token:", tech.username);
    }
  } catch (error) {
    console.error("❌ Error sending notification:", error);
  }

  res.json({ ok: true });
}

export default requireRole("admin")(handler);
