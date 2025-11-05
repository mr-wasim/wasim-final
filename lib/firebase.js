// lib/firebaseClient.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";

// ONLY NEXT_PUBLIC vars on client
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// app init (safe for SSR)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Get Firebase Messaging instance safely (client-only).
 * Returns `null` on SSR or if browser doesn't support it.
 */
export async function getClientMessaging() {
  if (typeof window === "undefined") return null; // SSR/Node
  try {
    const supported = await isSupported();
    if (!supported) return null;
    const m = getMessaging(app);
    // optional: debug/global
    // window.firebaseMessaging = m;
    return m;
  } catch (err) {
    console.warn("[firebaseClient] messaging init failed:", err?.message || err);
    return null;
  }
}

export { app, db };
