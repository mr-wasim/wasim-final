import admin from "../../lib/firebaseAdmin";

export default async function handler(req, res) {
  try {
    const token = await admin.credential.applicationDefault().getAccessToken();
    console.log("✅ Firebase token fetched successfully");
    return res.status(200).json({ ok: true, token });
  } catch (err) {
    console.error("❌ Firebase init test error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
