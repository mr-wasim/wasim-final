import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const { token, title, body } = req.body;

    if (!token) return res.status(400).json({ error: "Missing token" });

    const message = {
      token,
      notification: { title, body },
      webpush: {
        notification: {
          icon: "/icons/icon-192x192.png",
          badge: "/icons/icon-72x72.png",
        },
      },
    };

    await admin.messaging().send(message);
    console.log("✅ Notification sent successfully:", title);

    return res.status(200).json({ success: true, message: "Notification sent" });
  } catch (err) {
    console.error("❌ Notification error:", err);
    return res.status(500).json({ error: err.message });
  }
}
