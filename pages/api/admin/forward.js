// pages/api/admin/forward.js
import { getDb, requireRole } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";
import { sendNotification } from "../../../lib/sendNotification.js";

async function forwardHandler(req, res, user) {
  // ✅ Always explicitly allow only POST — prevents 405 issues on Vercel
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]); // <--- this line is key for Vercel
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

    // ✅ Fetch technician’s FCM token
    const fcmToken = await db
      .collection("fcm_tokens")
      .findOne({ userId: techId, role: "technician" });

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

// ✅ Final export (includes CORS + admin role protection)
export default async function handler(req, res) {
  // ✅ Allow preflight (CORS) requests
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", ["POST", "OPTIONS"]);
    return res.status(200).end();
  }

  // ✅ Wrap with admin role validation
  const wrapped = requireRole("admin")(forwardHandler);
  return wrapped(req, res);
}
