// ✅ /pages/api/save-fcm-token.js
import clientPromise from "../../lib/mongodb.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  try {
    const { token, userId, role = "technician" } = req.body || {};

    // ✅ Validate token
    if (!token) {
      return res.status(400).json({ ok: false, message: "FCM token is required" });
    }

    // ✅ Connect to DB
    const client = await clientPromise;
    const db = client.db();

    // ✅ Ensure collection exists
    const collection = db.collection("fcm_tokens");

    // ✅ Upsert (update if already exists)
    await collection.updateOne(
      { userId: userId || null, role },
      { $set: { token, updatedAt: new Date() } },
      { upsert: true }
    );

    console.log("✅ FCM Token saved to DB:", token);

    return res.status(200).json({ ok: true, message: "FCM token saved successfully." });
  } catch (error) {
    console.error("❌ FCM Token Save Error:", error);
    return res.status(500).json({ ok: false, message: "Server error while saving FCM token." });
  }
}
