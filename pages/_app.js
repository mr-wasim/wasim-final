import "../styles/globals.css";
import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { getToken, onMessage, getMessaging } from "firebase/messaging";
import { initializeApp, getApps, getApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_FIREBASE_AUTH_DOMAIN",
  projectId: "YOUR_FIREBASE_PROJECT_ID",
  storageBucket: "YOUR_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "YOUR_FIREBASE_SENDER_ID",
  appId: "YOUR_FIREBASE_APP_ID",
};

export default function MyApp({ Component, pageProps }) {
  const [token, setToken] = useState(null);

  useEffect(() => {
    // ✅ Run only in browser
    if (typeof window === "undefined") return;

    // ✅ Initialize Firebase safely
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

    let messaging;
    try {
      messaging = getMessaging(app);
    } catch (err) {
      console.warn("⚠️ Messaging could not be initialized:", err);
      return;
    }

    const initNotifications = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          console.warn("🚫 Notification permission denied");
          return;
        }

        console.log("✅ Notification permission granted");

        // ✅ Get FCM Token
        const currentToken = await getToken(messaging, {
          vapidKey:
            "BNQGS7VCHzRbEZi5xMvzVFIlsGr6aFtkEtEbaK43x39Y8vLT-wexc738Y-AlycYmKBasGrxTcP6udOSymXUHZKg",
        });

        if (currentToken) {
          console.log("📱 FCM Token:", currentToken);
          setToken(currentToken);
          toast.success("Notifications enabled");
        } else {
          console.warn("⚠️ No registration token available.");
        }

        // ✅ Handle foreground messages safely
        onMessage(messaging, (payload) => {
          console.log("📩 Foreground message received:", payload);
          const { title, body } = payload.notification || {};
          if (title && body) {
            new Notification(title, { body, icon: "/logo.png" });
            toast(`${title}: ${body}`);
          }
        });
      } catch (error) {
        console.error("🔥 Error initializing notifications:", error);
      }
    };

    // Add a delay to ensure everything is initialized
    setTimeout(initNotifications, 1000);
  }, []);

  return (
    <>
      <Toaster position="top-right" />
      <Component {...pageProps} />
    </>
  );
}
