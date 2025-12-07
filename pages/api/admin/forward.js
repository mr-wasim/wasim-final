export const runtime = "nodejs";

import fetch from "node-fetch"; // 👈 Required

export const config = {
  api: {
    bodyParser: true,
  },
};

import { getDb, requireRole } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";
import { sendNotification } from "../../../lib/sendNotification.js";


// ------------ WhatsApp Sender (FIXED) ------------
async function sendWhatsAppMessage(phone, clientName, serviceType) {
  phone = phone.startsWith("+91") ? phone : "+91" + phone;

  const apiKey =
    process.env.WAPPBIZ_KEY ||
    "28b55ddd7e798fc7b49725ecec55bfd25bcc605d2a2267536a2d39598b4f54b2";

  const formattedDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  // WappBiz required format
  const payload = {
    template_name: "service_registered",
    phone: phone,
    name: clientName,
    parameters: `${clientName}, ${serviceType}, ${formattedDate}`
  };

  const url = `https://api.wapp.biz/api/external/sendTemplate?apikey=${apiKey}`;

  console.log("📩 FINAL WS Payload:", payload);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    console.log("📨 WhatsApp API Result:", result);
    return result;
  } catch (err) {
    console.error("❌ WhatsApp Error:", err);
  }
}


// ------------ Core Logic ------------
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
      serviceType,
      service,
      category,
      jobType,
      timeZone,
      notes,
    } = req.body || {};

    const finalType =
      type ||
      serviceType ||
      service ||
      category ||
      jobType ||
      "Service";

    if (!clientName || !phone || !address || !techId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!ObjectId.isValid(techId)) {
      return res.status(400).json({ error: "Invalid technician ID" });
    }

    const techObjectId = new ObjectId(techId);
    const db = await getDb();

    const tech = await db.collection("technicians").findOne({ _id: techObjectId });
    if (!tech) return res.status(404).json({ error: "Technician not found" });

    const normalizedPhone = phone.startsWith("+91") ? phone : "+91" + phone;

    const insertDoc = {
      clientName,
      phone: normalizedPhone,
      address,
      price: Number(price) || 0,
      type: finalType,
      timeZone: timeZone || "",
      notes: notes || "",
      techId: tech._id,
      techName: tech.username,
      status: "Pending",
      createdAt: new Date(),
    };

    const result = await db.collection("forwarded_calls").insertOne(insertDoc);
    const insertedId = result.insertedId.toString();

    // ⭐ WhatsApp Notification (now working)
    await sendWhatsAppMessage(insertDoc.phone, clientName, finalType);

    // Push Notification to Technician (FCM)
    try {
      const fcmToken = await db.collection("fcm_tokens").findOne({
        userId: techId,
        role: "technician",
      });

      if (fcmToken?.token) {
        await sendNotification(
          fcmToken.token,
          "📞 New Call Assigned",
          `Client ${clientName} (${insertDoc.phone}) assigned to you.`,
          { forwardedCallId: insertedId }
        );
      }
    } catch (err) {
      console.log("⚠ FCM Error:", err);
    }

    return res.status(200).json({ ok: true, id: insertedId });
  } catch (err) {
    console.error("❌ Forward Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}


// ------------ Export ------------
export default async function handler(req, res) {
  console.log("📡 API Request → /api/admin/forward");
  const guarded = requireRole("admin")(forwardCore);
  return guarded(req, res);
}
