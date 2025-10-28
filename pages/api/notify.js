// /pages/api/notify.js
import admin from "firebase-admin";

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const { techId, title, body } = req.body;

    // 🔥 DB से technician का FCM token लो (मान लो user model में token है)
    const r = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/tech/${techId}`);
    const tech = await r.json();

    if (!tech.fcmToken) {
      return res.status(400).json({ error: "Technician has no FCM token" });
    }

    await admin.messaging().send({
      token: tech.fcmToken,
      notification: { title, body },
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Notification failed" });
  }
}
