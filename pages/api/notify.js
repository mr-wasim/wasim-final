// pages/api/notify.js
import admin from "firebase-admin";

// 🧩 Ensure Firebase Admin is initialized once
if (!admin.apps.length) {
  try {
    const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!rawKey) {
      throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_KEY in environment.");
    }

    // 🔒 Parse safely (supports both stringified JSON or base64)
    const serviceAccount = (() => {
      try {
        return JSON.parse(rawKey);
      } catch {
        // base64 encoded case (common on Vercel)
        const decoded = Buffer.from(rawKey, "base64").toString("utf-8");
        return JSON.parse(decoded);
      }
    })();

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log("✅ Firebase Admin initialized");
  } catch (err) {
    console.error("❌ Firebase Admin init error:", err);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const { techId, title, body } = req.body || {};

    // --- Input validation ---
    if (!techId || !title || !body) {
      return res.status(400).json({
        error: "techId, title, and body are required.",
      });
    }

    const baseURL = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "");
    if (!baseURL) {
      return res.status(500).json({ error: "Base URL not configured" });
    }

    // --- Fetch technician info ---
    const response = await fetch(`${baseURL}/api/tech/${techId}`, {
      headers: { "Cache-Control": "no-store" },
    });

    if (!response.ok) {
      return res
        .status(404)
        .json({ error: `Technician ${techId} not found (${response.status})` });
    }

    const tech = await response.json();

    if (!tech?.fcmToken) {
      return res
        .status(400)
        .json({ error: "Technician has no FCM token registered." });
    }

    // --- Send notification ---
    const message = {
      token: tech.fcmToken,
      notification: {
        title: String(title),
        body: String(body),
      },
    };

    const sendResult = await admin.messaging().send(message);

    console.log(`✅ Notification sent to ${techId}:`, sendResult);

    res.status(200).json({ success: true, messageId: sendResult });
  } catch (err) {
    console.error("❌ Notification error:", err);
    res.status(500).json({
      error: "Notification failed",
      detail: err.message || err.toString(),
    });
  }
}
