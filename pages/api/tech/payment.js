import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";
import { sendNotification } from "../../../lib/sendNotification.js"; // ✅ Notification import

async function handler(req, res, user) {
  if (req.method !== "POST") return res.status(405).end();

  const { receiver, mode, onlineAmount = 0, cashAmount = 0, receiverSignature } = req.body || {};

  if (!receiver || !mode) {
    return res.status(400).json({ ok: false, message: "Missing required fields." });
  }

  const db = await getDb();
  const techId = ObjectId.isValid(user.id) ? new ObjectId(user.id) : user.id;

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingPayment = await db.collection("payments").findOne({
      techId,
      receiver,
      mode,
      onlineAmount: Number(onlineAmount) || 0,
      cashAmount: Number(cashAmount) || 0,
      createdAt: { $gte: today },
    });

    if (existingPayment) {
      return res.status(409).json({
        ok: false,
        message: "Duplicate payment detected — this payment already recorded today.",
      });
    }

    await db.collection("payments").insertOne({
      techId,
      techUsername: user.username,
      receiver,
      mode,
      onlineAmount: Number(onlineAmount) || 0,
      cashAmount: Number(cashAmount) || 0,
      receiverSignature,
      createdAt: new Date(),
    });

    // ✅ Send Notification to Admins
    const admins = await db.collection("admins").find({ fcmToken: { $exists: true } }).toArray();
    for (const admin of admins) {
      await sendNotification(
        admin.fcmToken,
        "Payment Received 💸",
        `${user.username} has submitted a payment successfully.`
      );
    }

    return res.status(200).json({ ok: true, message: "Payment recorded successfully." });
  } catch (error) {
    console.error("Payment error:", error);
    return res.status(500).json({ ok: false, message: "Payment already submitted" });
  }
}

export default requireRole("technician")(handler);
