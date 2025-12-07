// pages/api/forwarded-calls/update-status.js
import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";

// Allowed status (⚠️ Cancel को भी allow किया)
const ALLOWED = new Set(["Pending", "Completed", "Closed", "Canceled"]);

// -------- WhatsApp Completion Message --------
async function sendCompletionMessage(phone, clientName, serviceType, techName) {
  phone = phone.startsWith("+91") ? phone : "+91" + phone;

  const apiKey = "28b55ddd7e798fc7b49725ecec55bfd25bcc605d2a2267536a2d39598b4f54b2"; // static key

  const payload = {
    template_name: "service_completed",   // your template in WappBiz
    phone: phone,
    name: clientName,
    parameters: `${clientName}, ${serviceType}, ${techName}`
  };

  const url = `https://api.wapp.biz/api/external/sendTemplate?apikey=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    console.log("📨 WhatsApp Completion Result:", result);
  } catch (err) {
    console.error("❌ WhatsApp Send Error:", err);
  }
}


// -------- Main Handler --------
async function handler(req, res, user) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { id, status } = req.body || {};

    if (!id || !status) {
      return res.status(400).json({ ok: false, message: "id and status are required." });
    }
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ ok: false, message: "Invalid id." });
    }
    if (!ALLOWED.has(String(status))) {
      return res.status(400).json({ ok: false, message: "Invalid status value." });
    }

    const _id = new ObjectId(id);

    const techIdCandidates = [user.id];
    if (ObjectId.isValid(user.id)) techIdCandidates.push(new ObjectId(user.id));

    const db = await getDb();

    // find call before update (needed for WhatsApp variables)
    const callData = await db.collection("forwarded_calls").findOne({
      _id,
      techId: { $in: techIdCandidates }
    });

    if (!callData) {
      return res.status(404).json({ ok: false, message: "Call not found for this technician." });
    }

    // update status in DB
    const result = await db.collection("forwarded_calls").updateOne(
      { _id, techId: { $in: techIdCandidates } },
      { $set: { status: String(status) } }
    );

    res.setHeader("Cache-Control", "private, no-store");

    if (result.matchedCount === 0) {
      return res.status(404).json({ ok: false, message: "Call not found." });
    }

    // 🚀 Send WhatsApp only when technician CLOSES the call
    if (status === "Closed") {
      await sendCompletionMessage(
        callData.phone,
        callData.clientName,
        callData.type || "Service",
        callData.techName || "Technician"
      );
      console.log("🎉 WhatsApp completion message sent on call close!");
    }

    // ❌ Cancel होने पर कुछ extra काम नहीं — सिर्फ update
    if (status === "Canceled") {
      console.log("🚫 Call canceled — no WhatsApp message required.");
    }

    return res.status(200).json({ ok: true, modified: result.modifiedCount === 1 });

  } catch (e) {
    console.error("update-status error:", e);
    return res.status(500).json({ ok: false, message: "Internal Server Error" });
  }
}

export default requireRole("technician")(handler);

// 👍 Index (once):
// db.forwarded_calls.createIndex({ _id: 1, techId: 1 });
