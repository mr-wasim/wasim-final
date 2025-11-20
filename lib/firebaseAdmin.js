import admin from "./firebaseAdmin.js";

export async function sendNotification(token, title, body, data = {}) {
  try {
    if (!token) {
      console.log("❌ No FCM token provided");
      return false;
    }

    const message = {
      token,
      notification: { title, body },
      data, // extra fields allowed
      webpush: {
        notification: {
          icon: "/icons/icon-192x192.png",
          badge: "/icons/icon-72x72.png",
        },
      },
    };

    await admin.messaging().send(message);

    console.log("✅ Notification sent:", title);
    return true;

  } catch (err) {
    console.error("❌ FCM Error:", err.message);
    return false;
  }
}
