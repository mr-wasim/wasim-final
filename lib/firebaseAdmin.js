// ✅ Firebase Admin (server-side only)
import admin from "firebase-admin";

if (!admin.apps.length) {
  try {
    const serviceAccount = {
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    };

    if (!serviceAccount.project_id) {
      throw new Error("Missing FIREBASE_PROJECT_ID in environment variables");
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log("✅ Firebase Admin initialized successfully");
  } catch (error) {
    console.error("❌ Firebase Admin initialization failed:", error.message);
  }
}

export default admin;
