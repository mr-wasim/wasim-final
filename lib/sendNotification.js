// /lib/sendNotification.js
import admin from "firebase-admin";

// Initialize Firebase Admin only once
if (!admin.apps.length) {
  const serviceAccount = {
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const fcm = admin.messaging();

/**
 * Send push notification to user via FCM token
 * @param {string} token - The FCM token of the target device
 * @param {string} title - Notification title
 * @param {string} body - Notification body text
 * @param {object} [data] - Optional extra data
 */
export async function sendNotification(token, title, body, data = {}) {
  try {
    const message = {
      token,
      notification: {
        title,
        body,
      },
      android: {
        notification: {
          sound: "default",
          priority: "high",
          channelId: "high_importance_channel",
          vibrateTimingsMillis: [200, 100, 200],
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
          },
        },
      },
      data,
    };

    const response = await fcm.send(message);
    console.log("✅ Notification sent:", response);
    return response;
  } catch (error) {
    console.error("❌ Error sending notification:", error);
  }
}
