// pages/_app.js
import Head from "next/head";
import "../styles/globals.css";
import { useEffect, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";

/**
 * Optimized _app:
 * - dynamically imports firebase libs so initial bundle stays small
 * - registers service worker non-blocking
 * - initializes notifications on idle (or short timeout fallback)
 * - forces favicon in Head (cache-buster)
 */

export default function MyApp({ Component, pageProps }) {
  const [token, setToken] = useState(null);
  const initedRef = useRef(false);

  const firebaseConfig = {
    apiKey: "AIzaSyCf6VNLkMzTOV51FFqWHrxB-KBr5Vu_xtM",
    authDomain: "chimney-solutions-nt.firebaseapp.com",
    projectId: "chimney-solutions-nt",
    storageBucket: "chimney-solutions-nt.appspot.com",
    messagingSenderId: "391952557503",
    appId: "1:391952557503:web:b2fefa69b6005c45dcad0a",
    measurementId: "G-2361S394R0",
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (initedRef.current) return;
    initedRef.current = true;

    let cancelled = false;

    const fetchWithTimeout = async (url, opts = {}, timeout = 5000) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      try {
        const res = await fetch(url, {
          ...opts,
          signal: controller.signal,
          keepalive: opts.keepalive ?? true,
        });
        clearTimeout(id);
        return res;
      } catch (err) {
        clearTimeout(id);
        throw err;
      }
    };

    const registerAndInit = async () => {
      try {
        // dynamic imports to keep initial bundle small
        const firebaseAppMod = await import("firebase/app");
        const firebaseMessagingMod = await import("firebase/messaging");

        const { initializeApp, getApps, getApp } = firebaseAppMod;
        const { getMessaging, getToken, onMessage } = firebaseMessagingMod;

        const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

        // register service worker (non-blocking)
        if ("serviceWorker" in navigator) {
          navigator.serviceWorker
            .register("/firebase-messaging-sw.js")
            .then((registration) => {
              console.log("✅ Service Worker registered:", registration.scope);
            })
            .catch((err) =>
              console.warn("❌ Service Worker registration failed:", err)
            );
        }

        let messaging;
        try {
          messaging = getMessaging(app);
        } catch (err) {
          console.warn("⚠️ Messaging init failed:", err);
          return;
        }

        const doInitNotifications = async () => {
          if (cancelled) return;

          try {
            const permission = await Notification.requestPermission();
            if (permission !== "granted") {
              console.warn("🚫 Notification permission denied");
              return;
            }

            let currentToken = null;
            try {
              currentToken = await getToken(messaging, {
                vapidKey:
                  "BNQGS7VCHzRbEZi5xMvzVFIlsGr6aFtkEtEbaK43x39Y8vLT-wexc738Y-AlycYmKBasGrxTcP6udOSymXUHZKg",
              });
            } catch (err) {
              console.warn("⚠️ getToken error:", err);
            }

            if (currentToken) {
              if (cancelled) return;
              console.log("📱 FCM Token:", currentToken);
              setToken(currentToken);
              toast.success("Notifications enabled");

              const userId =
                localStorage.getItem("technicianId") ||
                localStorage.getItem("userId") ||
                "68f9dd15eecc8fd42548a6a8";

              try {
                const res = await fetchWithTimeout(
                  "/api/save-fcm-token",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      token: currentToken,
                      userId,
                      role: "technician",
                    }),
                    keepalive: true,
                  },
                  5000
                );
                const data = await res.json();
                console.log("📦 Token save response:", data);
                if (data.ok) toast.success("Token saved to DB!");
                else toast.error("Failed to save token");
              } catch (err) {
                console.warn("⚠️ Token save failed:", err);
              }
            } else {
              console.warn("⚠️ No registration token available.");
            }

            onMessage(messaging, (payload) => {
              console.log("📩 Foreground message:", payload);
              const { title, body } = payload.notification || {};
              if (title && body) {
                try {
                  new Notification(title, { body, icon: "/logo.png" });
                } catch (e) {
                  console.warn("Notification failed:", e);
                }
                toast(`${title}: ${body}`);
              }
            });
          } catch (err) {
            console.error("🔥 Error init notifications:", err);
          }
        };

        // run when idle, fallback to short timeout
        if ("requestIdleCallback" in window) {
          window.requestIdleCallback(
            () => {
              if (!cancelled) doInitNotifications();
            },
            { timeout: 1500 }
          );
        } else {
          setTimeout(() => {
            if (!cancelled) doInitNotifications();
          }, 800);
        }
      } catch (err) {
        console.error("🔥 registerAndInit error:", err);
      }
    };

    registerAndInit();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <Head>
        {/* FORCE favicon + preload */}
        <link rel="icon" href="/favicon.png?v=999" />
        <link rel="shortcut icon" href="/favicon.png?v=999" />
        <link rel="preload" as="image" href="/favicon.png?v=999" />
      </Head>

      <Toaster position="top-right" />
      <Component {...pageProps} />
    </>
  );
}
