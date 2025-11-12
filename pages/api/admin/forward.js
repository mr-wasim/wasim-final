// ✅ Force Node.js runtime (important for Vercel)
export const runtime = "nodejs";

// ✅ Ensure body parsing works properly
export const config = {
  api: {
    bodyParser: true,
  },
};

import { getDb, requireRole } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";
import { sendNotification } from "../../../lib/sendNotification.js";

// ---- helper: core logic ----
async function forwardCore(req, res, user) {
  // allow only POST
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { clientName, phone, address, techId, price, type } = req.body || {};

    // basic payload validate
    if (!clientName || !phone || !address || !techId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // validate ObjectId
    if (!ObjectId.isValid(techId)) {
      return res.status(400).json({ error: "Invalid technician id" });
    }
    const techObjectId = new ObjectId(techId);

    const db = await getDb();

    const tech = await db
      .collection("technicians")
      .findOne({ _id: techObjectId });

    if (!tech) {
      return res.status(404).json({ error: "Technician not found" });
    }

    const insertDoc = {
      clientName,
      phone,
      address,
      price: typeof price === "number" ? price : Number(price) || 0,
      type: type || "general",
      techId: tech._id,
      techName: tech.username,
      status: "Pending",
      createdAt: new Date(),
    };

    const { insertedId } = await db
      .collection("forwarded_calls")
      .insertOne(insertDoc);

    // FCM notification (best-effort)
    try {
      const fcmToken = await db
        .collection("fcm_tokens")
        .findOne({ userId: techId, role: "technician" });

      if (fcmToken?.token) {
        await sendNotification(
          fcmToken.token,
          "📞 New Call Assigned",
          `New client ${clientName} (${phone}) assigned to you.`,
          { techId, forwardedCallId: String(insertedId) }
        );
        console.log("[forward] Notification sent →", tech.username);
      } else {
        console.log("[forward] No FCM token for tech:", techId);
      }
    } catch (notifErr) {
      console.warn("[forward] FCM notify failed:", notifErr?.message);
    }

    return res.status(200).json({ ok: true, id: String(insertedId) });
  } catch (err) {
    console.error("[forward] API error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

// ---- exported handler (adds CORS + role) ----
export default async function handler(req, res) {
  // ✅ Debug log for Vercel (to confirm route is executing)
  console.log("[API] /api/admin/forward called with method:", req.method);

  // ✅ CORS setup
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  // ✅ Preflight support
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", ["POST", "OPTIONS"]);
    return res.status(200).end();
  }

  // ✅ Role check (admin only)
  const guarded = requireRole("admin")(forwardCore);
  return guarded(req, res);
}


