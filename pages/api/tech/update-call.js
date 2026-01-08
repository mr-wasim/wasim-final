// pages/api/forwarded-calls/update-status.js
import fetch from "node-fetch";
import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";

export const config = {
  api: {
    bodyParser: true,
  },
};

// Allowed status (⚠️ Cancel को भी allow किया)
const ALLOWED = new Set(["Pending", "Completed", "Closed", "Canceled"]);

// -------- WhatsApp Completion Message --------
async function sendCompletionMessage(phone, clientName, serviceType, techName) {
  try {
    phone = String(phone || "");
    phone = phone.startsWith("+91") ? phone : "+91" + phone.replace(/^0+/, "");

    const apiKey =
      process.env.WAPPBIZ_KEY ||
      "28b55ddd7e798fc7b49725ecec55bfd25bcc605d2a2267536a2d39598b4f54b2";

    const payload = {
      template_name: "service_completed", // ensure this exists in WappBiz
      phone: phone,
      name: clientName,
      parameters: `${clientName}, ${serviceType}, ${techName}`,
    };

    const url = `https://api.wapp.biz/api/external/sendTemplate?apikey=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // no await for response body heavy parsing here in caller; keep simple
    });

    const result = await response.json().catch(() => ({ ok: false }));
    console.log("📨 WhatsApp Completion Result:", result);
    return result;
  } catch (err) {
    console.error("❌ WhatsApp Send Error:", err);
    throw err;
  }
}

// -------- Main Handler --------
async function handler(req, res, user) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

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

    // techIdCandidates ensures technicians can only update their own calls
    const techIdCandidates = [user.id];
    if (ObjectId.isValid(user.id)) techIdCandidates.push(new ObjectId(user.id));

    const db = await getDb();

    // find call before update (needed for WhatsApp variables and chooseCall)
    const callData = await db.collection("forwarded_calls").findOne({
      _id,
      techId: { $in: techIdCandidates },
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

    // Respond immediately (ULTRA FAST) before background work
    res.status(200).json({ ok: true, modified: result.modifiedCount === 1 });

    // ---------- Background tasks (non-blocking) ----------
    // Send WhatsApp only when:
    // 1) status === "Closed"
    // 2) callData.chooseCall === "CHIMNEY_SOLUTIONS"
    // otherwise skip WhatsApp.
    if (String(status) === "Closed") {
      const chosen = String(callData.chooseCall || "").toUpperCase();
      if (chosen === "CHIMNEY_SOLUTIONS" || chosen === "CHIMNEY_SOLUTIONS".replace(/_/g, " ")) {
        // small delay ensures response already flushed
        setTimeout(async () => {
          try {
            await sendCompletionMessage(
              callData.phone,
              callData.clientName,
              callData.type || "Service",
              callData.techName || "Technician"
            );
            console.log("🎉 WhatsApp completion message queued (CHIMNEY_SOLUTIONS).");
          } catch (waErr) {
            console.error("⚠ WA completion send error (background):", waErr);
          }
        }, 5); // tiny delay to keep main response immediate
      } else {
        console.log("ℹ️ Completion WA skipped — chooseCall is not CHIMNEY_SOLUTIONS:", callData.chooseCall);
      }
    } else {
      // status is not Closed — nothing to do for WA
      if (String(status) === "Canceled") {
        console.log("🚫 Call canceled — no WhatsApp message required.");
      } else {
        console.log("ℹ️ Status updated to", status, "- no completion WA required.");
      }
    }

    // ----------------------------------------------------------------

  } catch (e) {
    console.error("update-status error:", e);
    // If you already sent a response above, you can't send another — but here it's safe:
    return res.status(500).json({ ok: false, message: "Internal Server Error" });
  }
}

export default requireRole("technician")(handler);

// 👍 Index suggestion (run once in mongo shell / migration):
// db.forwarded_calls.createIndex({ _id: 1, techId: 1, chooseCall: 1 });
