// /public/firebase-messaging-sw.js

importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

// Initialize Firebase
firebase.initializeApp({
  apiKey: "AIzaSyCf6VNLkMzTOV51FFqWHrxB-KBr5Vu_xtM",
  authDomain: "chimney-solutions-nt.firebaseapp.com",
  projectId: "chimney-solutions-nt",
  storageBucket: "chimney-solutions-nt.firebasestorage.app",
  messagingSenderId: "391952557503",
  appId: "1:391952557503:web:b2fefa69b6005c45dcad0a",
  measurementId: "G-2361S394R0"
});

// Retrieve Firebase Messaging instance
const messaging = firebase.messaging();

// ✅ Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Received background message ", payload);

  // Use safe defaults in case notification fields are missing
  const notificationTitle = payload?.notification?.title || "Chimney Solutions";
  const notificationOptions = {
    body: payload?.notification?.body || "You have a new update!",
    icon: "/logo.png", // put a valid public image path here
    badge: "/logo.png", // optional: badge for Android
    sound: "default",
    vibrate: [200, 100, 200],
    data: payload?.data || {}, // to handle click actions later
  };

  // ✅ Always show notification
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// ✅ Optional: handle notification click
self.addEventListener("notificationclick", function (event) {
  console.log("[firebase-messaging-sw.js] Notification click Received.", event);

  event.notification.close();

  // Open the app if it's not already open
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("/") && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow("/");
      }
    })
  );
});
