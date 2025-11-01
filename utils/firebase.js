// utils/firebaseAdmin.js
import admin from "firebase-admin";

// ✅ Prevent re-initialization in serverless (Vercel/Next.js)
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        project_id: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_PRIVATE_KEY
          ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
          : undefined,
      }),
    });
    console.log("✅ Firebase Admin initialized");
  } catch (error) {
    console.error("🔥 Firebase Admin initialization error:", error);
  }
}

// ✅ Exports for backend use only
export const adminDB = admin.firestore();
export const adminAuth = admin.auth();
export default admin;
