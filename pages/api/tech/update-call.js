import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";
import { sendNotification } from "../../../lib/sendNotification.js"; // ✅ Notification import

async function handler(req, res, user) {
  if (req.method !== "POST") return res.status(405).end();

  const { id, status } = req.body || {};
  const db = await getDb();

  await db
    .collection("forwarded_calls")
    .updateOne(
      { _id: new ObjectId(id), techId: { $in: [user.id, new ObjectId(user.id)] } },
      { $set: { status } }
    );

  // ✅ Notify Admins when call closed
  if (status === "Closed" || status === "Completed") {
    try {
      const admins = await db.collection("admins").find({ fcmToken: { $exists: true } }).toArray();
      for (const admin of admins) {
        await sendNotification(
          admin.fcmToken,
          "Call Closed ✅",
          `${user.username} has closed a service call successfully.`
        );
      }
    } catch (err) {
      console.error("❌ Notification error:", err);
    }
  }

  res.json({ ok: true });
}

export default requireRole("technician")(handler);
