/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

// ✅ Your Firebase config (same as in lib/firebase.js)
firebase.initializeApp({
  apiKey: "AIzaSyCf6VNLkMzTOV51FFqWHrxB-KBr5Vu_xtM",
  authDomain: "chimney-solutions-nt.firebaseapp.com",
  projectId: "chimney-solutions-nt",
  storageBucket: "chimney-solutions-nt.appspot.com",
  messagingSenderId: "391952557503",
  appId: "1:391952557503:web:b2fefa69b6005c45dcad0a",
  measurementId: "G-2361S394R0"
});

// ✅ Initialize messaging
const messaging = firebase.messaging();

// ✅ Handle background messages
messaging.onBackgroundMessage(function (payload) {
  console.log("📩 Background Message received:", payload);

  const notificationTitle = payload.notification?.title || "🔔 New Alert";
  const notificationOptions = {
    body: payload.notification?.body || "You have a new message",
    icon: "/logo.png",
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
