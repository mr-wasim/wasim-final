import admin from "firebase-admin";

if (!admin.apps.length) {
  try {
    // Fix: Handle both escaped (\n) and real newlines
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/gm, "\n").replace(/\r/g, "")
      : undefined;

    if (!privateKey) throw new Error("Missing FIREBASE_PRIVATE_KEY");

    admin.initializeApp({
      credential: admin.credential.cert({
        project_id: process.env.FIREBASE_PROJECT_ID,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: privateKey,
      }),
    });

    console.log("✅ Firebase Admin initialized successfully");
  } catch (err) {
    console.error("❌ Firebase Admin init failed:", err.message);
  }
}

export default admin;
