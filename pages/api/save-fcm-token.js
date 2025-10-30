// /pages/api/save-fcm-token.js
import clientPromise from "../../lib/mongodb.js";

export default async function handler(req, res) {
  console.log("📩 /api/save-fcm-token called with:", req.method);

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  try {
    const { token, userId, role = "technician" } = req.body || {};

    if (!token || !userId) {
      console.warn("⚠️ Missing token or userId", req.body);
      return res.status(400).json({ ok: false, message: "Missing token or userId" });
    }

    const client = await clientPromise;
    const db = client.db();
    const collection = db.collection("fcm_tokens");

    const result = await collection.updateOne(
      { userId, role },
      { $set: { token, updatedAt: new Date() } },
      { upsert: true }
    );

    console.log("✅ FCM Token saved successfully:", { userId, token });
    return res.status(200).json({ ok: true, message: "Token saved", result });
  } catch (error) {
    console.error("❌ Error saving FCM token:", error);
    return res.status(500).json({ ok: false, message: error.message });
  }
}
