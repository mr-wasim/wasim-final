// utils/firebase.js
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";
import { getAnalytics, isSupported as analyticsSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// ✅ Properly get Firestore instance
const db = getFirestore(app);

// ✅ Optional: Safe messaging
let messaging = null;
if (typeof window !== "undefined") {
  isSupported()
    .then((ok) => {
      if (ok) {
        messaging = getMessaging(app);
      } else {
        console.warn("⚠️ Firebase messaging not supported");
      }
    })
    .catch(console.error);
}

// ✅ Optional: Safe analytics
let analytics = null;
if (typeof window !== "undefined") {
  analyticsSupported()
    .then((ok) => {
      if (ok) analytics = getAnalytics(app);
    })
    .catch(console.error);
}

export { app, db, messaging, analytics };
