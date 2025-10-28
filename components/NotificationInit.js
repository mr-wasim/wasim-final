// /components/NotificationInit.js
import { useEffect } from "react";
import { messaging, getToken, onMessage } from "@/lib/firebase";
import toast from "react-hot-toast";

export default function NotificationInit({ userId }) {
  useEffect(() => {
    if (!messaging) return;

    Notification.requestPermission().then(async (permission) => {
      if (permission === "granted") {
        const token = await getToken(messaging, {
          vapidKey: "BNQGS7VCHzRbEZi5xMvzVFIlsGr6aFtkEtEbaK43x39Y8vLT-wexc738Y-AlycYmKBasGrxTcP6udOSymXUHZKg"
        });

        if (token) {
          console.log("FCM Token:", token);

          // Save token in DB for user
          await fetch("/api/save-fcm-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, token }),
          });
        }
      }
    });

    onMessage(messaging, (payload) => {
      console.log("Message received:", payload);
      toast.success(payload.notification.title + " - " + payload.notification.body);
    });
  }, [userId]);

  return null;
}
