// utils/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";
import admin from "firebase-admin";

// ✅ Firebase config (Environment variables se lo)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// ✅ Prevent duplicate initialization
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// ✅ Firestore initialize
export const db = getFirestore(app);

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


// ✅ Messaging initialize (only if supported)
export const messaging = (await isSupported()) ? getMessaging(app) : null;

export const adminDB = admin.firestore();
export const adminAuth = admin.auth();

export default app;
