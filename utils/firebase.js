// utils/firebaseAdmin.js
import admin from "firebase-admin";

// ✅ Prevent duplicate admin initialization
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      // Important: Replace escaped newlines
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

// ✅ Exports for backend use
export const adminDB = admin.firestore();
export const adminAuth = admin.auth();
