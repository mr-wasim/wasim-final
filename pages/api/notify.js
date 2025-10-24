// pages/api/notify.js
import { db } from "../../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { to, message, type } = req.body; // "to" = jisko notification milega

    await addDoc(collection(db, "notifications"), {
      to,
      message,
      type,
      read: false,
      createdAt: serverTimestamp(),
    });

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
