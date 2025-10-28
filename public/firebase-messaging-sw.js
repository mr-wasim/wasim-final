// /public/firebase-messaging-sw.js
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCf6VNLkMzTOV51FFqWHrxB-KBr5Vu_xtM",
  authDomain: "chimney-solutions-nt.firebaseapp.com",
  projectId: "chimney-solutions-nt",
  storageBucket: "chimney-solutions-nt.firebasestorage.app",
  messagingSenderId: "391952557503",
  appId: "1:391952557503:web:b2fefa69b6005c45dcad0a",
  measurementId: "G-2361S394R0"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Received background message ", payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: "/logo.png", // optional icon
    sound: "default",
    vibrate: [200, 100, 200],
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
