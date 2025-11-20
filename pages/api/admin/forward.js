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

// ---- Core Logic ----
async function forwardCore(req, res, user) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const {
      clientName,
      phone,
      address,
      techId,
      price,
      type,

      // NEW FIELDS
      timeZone,
      notes,
    } = req.body || {};

    // ---- VALIDATION ----
    if (!clientName || !phone || !address || !techId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!ObjectId.isValid(techId)) {
      return res.status(400).json({ error: "Invalid technician ID" });
    }

    const techObjectId = new ObjectId(techId);
    const db = await getDb();

    // ---- Fetch Technician ----
    const tech = await db
      .collection("technicians")
      .findOne({ _id: techObjectId });

    if (!tech) {
      return res.status(404).json({ error: "Technician not found" });
    }

    // ---- Prepare Insert Document ----
    const insertDoc = {
      clientName,
      phone,
      address,
      price: Number(price) || 0,
      type: type || "general",
      timeZone: timeZone || "",
      notes: notes || "",
      techId: tech._id,
      techName: tech.username,
      status: "Pending",
      createdAt: new Date(),
    };

    // ---- Insert into DB ----
    const result = await db
      .collection("forwarded_calls")
      .insertOne(insertDoc);

    const insertedId = result.insertedId.toString();

    // ---- Notification (safe mode) ----
    try {
      const fcmToken = await db
        .collection("fcm_tokens")
        .findOne({ userId: techId, role: "technician" });

      if (fcmToken?.token) {
        await sendNotification(
          fcmToken.token,
          "📞 New Call Assigned",
          `Client ${clientName} (${phone}) assigned to you.`,
          {
            forwardedCallId: insertedId,
            techId,
            timeZone: timeZone || "",
            notes: notes || "",
          }
        );

        console.log("[forward] Notification sent →", tech.username);
      } else {
        console.log("[forward] No FCM token found for technician:", techId);
      }
    } catch (notifyErr) {
      console.warn("[forward] Notification failed:", notifyErr.message);
    }

    return res.status(200).json({ ok: true, id: insertedId });

  } catch (err) {
    console.error("[forward] API Main Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

// ---- Exported Handler (CORS + Role Guard) ----
export default async function handler(req, res) {
  console.log("[API] /api/admin/forward → method:", req.method);

  // ---- CORS ----
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.setHeader("Allow", ["POST", "OPTIONS"]);
    return res.status(200).end();
  }

  // ---- Admin Check ----
  const guarded = requireRole("admin")(forwardCore);
  return guarded(req, res);
}