import "../styles/globals.css";
import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { getToken, onMessage, getMessaging } from "firebase/messaging";
import { initializeApp, getApps, getApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyCf6VNLkMzTOV51FFqWHrxB-KBr5Vu_xtM",
  authDomain: "chimney-solutions-nt.firebaseapp.com",
  projectId: "chimney-solutions-nt",
  storageBucket: "chimney-solutions-nt.appspot.com",
  messagingSenderId: "391952557503",
  appId: "1:391952557503:web:b2fefa69b6005c45dcad0a",
  measurementId: "G-2361S394R0",
};

export default function MyApp({ Component, pageProps }) {
  const [token, setToken] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

    // ✅ Register Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/firebase-messaging-sw.js")
        .then((registration) => {
          console.log("✅ Service Worker registered:", registration);
        })
        .catch((error) => {
          console.error("❌ Service Worker registration failed:", error);
        });
    }

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

        const currentToken = await getToken(messaging, {
          vapidKey:
            "BNQGS7VCHzRbEZi5xMvzVFIlsGr6aFtkEtEbaK43x39Y8vLT-wexc738Y-AlycYmKBasGrxTcP6udOSymXUHZKg",
        });

        if (currentToken) {
          console.log("📱 FCM Token:", currentToken);
          setToken(currentToken);
          toast.success("Notifications enabled");

          // ✅ FIX: Add userId manually for testing
          // (Later replace this with login logic)
          const userId =
            localStorage.getItem("technicianId") ||
            localStorage.getItem("userId") ||
            "68f9dd15eecc8fd42548a6a8"; // Default for testing

          console.log("💾 Saving token for user:", userId);
          console.log("🚀 Sending token to /api/save-fcm-token...");

          const res = await fetch("/api/save-fcm-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: currentToken,
              userId,
              role: "technician",
            }),
          });

          const data = await res.json();
          console.log("📦 Token save response:", data);

          if (data.ok) toast.success("Token saved to DB!");
          else toast.error("Failed to save token");
        } else {
          console.warn("⚠️ No registration token available.");
        }

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

    setTimeout(initNotifications, 2000);
  }, []);

  return (
    <>
      <Toaster position="top-right" />
      <Component {...pageProps} />
    </>
  );
}
