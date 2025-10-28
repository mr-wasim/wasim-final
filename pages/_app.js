import "../styles/globals.css";
import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { messaging } from "../lib/firebase";
import { getToken, onMessage } from "firebase/messaging";

export default function MyApp({ Component, pageProps }) {
  const [token, setToken] = useState(null);

  useEffect(() => {
    const initNotifications = async () => {
      if (!messaging) {
        console.warn("⚠️ Messaging not initialized yet");
        return;
      }

      try {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          console.log("✅ Notification permission granted");

          const currentToken = await getToken(messaging, {
            vapidKey: "BNQGS7VCHzRbEZi5xMvzVFIlsGr6aFtkEtEbaK43x39Y8vLT-wexc738Y-AlycYmKBasGrxTcP6udOSymXUHZKg", // 🔑 Replace with your real public VAPID key
          });

          if (currentToken) {
            setToken(currentToken);
            console.log("📱 FCM Token:", currentToken);
            toast.success("Notifications enabled");
          } else {
            console.warn("⚠️ No registration token available.");
          }

          // Listen for foreground messages
          onMessage(messaging, (payload) => {
            console.log("📩 Foreground message received:", payload);
            const { title, body } = payload.notification || {};
            if (title && body) {
              new Notification(title, { body, icon: "/logo.png" });
              toast(`${title}: ${body}`);
            }
          });
        } else {
          console.warn("🚫 Notification permission denied");
        }
      } catch (error) {
        console.error("🔥 Error initializing notifications:", error);
      }
    };

    // Small delay so messaging initializes
    setTimeout(initNotifications, 1000);
  }, []);

  return (
    <>
      <Toaster position="top-right" />
      <Component {...pageProps} />
    </>
  );
}
