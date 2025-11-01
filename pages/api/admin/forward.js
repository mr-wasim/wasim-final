// pages/api/admin/forward.js
import { getDb, requireRole } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";
import { sendNotification } from "../../../lib/sendNotification.js";

async function forwardHandler(req, res, user) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { clientName, phone, address, techId, price, type } = req.body || {};
    const db = await getDb();

    const tech = await db.collection("technicians").findOne({ _id: new ObjectId(techId) });
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

    // ✅ Technician FCM token fetch
    const fcmToken = await db.collection("fcm_tokens").findOne({ userId: techId, role: "technician" });

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

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("❌ Error in forward API:", err);
    return res.status(500).json({ error: err.message });
  }
}

// ✅ Fix: only wrap in requireRole on server-side
export default function handler(req, res) {
  if (req.method === "OPTIONS") {
    // allow CORS preflight
    return res.status(200).end();
  }

  // use dynamic import to avoid Next.js static analysis issue on Vercel
  const wrapped = requireRole("admin")(forwardHandler);
  return wrapped(req, res);
}
