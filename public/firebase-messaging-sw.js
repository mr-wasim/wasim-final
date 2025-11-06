/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

// ✅ Firebase config (same as your web app)
firebase.initializeApp({
  apiKey: "AIzaSyCf6VNLkMzTOV51FFqWHrxB-KBr5Vu_xtM",
  authDomain: "chimney-solutions-nt.firebaseapp.com",
  projectId: "chimney-solutions-nt",
  storageBucket: "chimney-solutions-nt.appspot.com",
  messagingSenderId: "391952557503",
  appId: "1:391952557503:web:b2fefa69b6005c45dcad0a",
  measurementId: "G-2361S394R0",
});

const messaging = firebase.messaging();

// ✅ Handle background messages safely
messaging.onBackgroundMessage((payload) => {
  console.log("📩 Received background message:", payload);

  // Defensive fallback (sometimes payload.notification missing)
  const title =
    payload?.notification?.title || "📞 New Call Assigned";
  const body =
    payload?.notification?.body ||
    "A new client has been assigned to you.";
  const data = payload?.data || {};

  const notificationOptions = {
    body,
    icon: "/firebase-logo.png",
    badge: "/firebase-logo.png",
    data,
    requireInteraction: true, // keeps notification visible until user interacts
    vibrate: [200, 100, 200],
    actions: [
      {
        action: "open_app",
        title: "Open My Calls",
      },
    ],
  };

  // ✅ Display the notification
  self.registration.showNotification(title, notificationOptions);
});

// ✅ Handle notification click (redirect user)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Redirect technician to their call list
  const targetUrl =
    event.notification?.data?.url ||
    "https://wasim-final.vercel.app/tech/my-calls";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
