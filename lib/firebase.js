// lib/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCg33tgciPj2W1Hg94d39MweR6jF_tw7U",
  authDomain: "chimney-solution-crm.firebaseapp.com",
  projectId: "chimney-solution-crm",
  storageBucket: "chimney-solution-crm.firebasestorage.app",
  messagingSenderId: "572419962173",
  appId: "1:572419962173:web:4422abf72100c4a3878154",
  measurementId: "G-1EM3NFLDRV",
};

// Firebase app start
const app = initializeApp(firebaseConfig);

// Firestore database export
export const db = getFirestore(app);
