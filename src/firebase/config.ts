import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBgLGLuQEog9uJ1BF-4aKR0WEiZHPSO46M",
  authDomain: "myweb-7ecb4.firebaseapp.com",
  projectId: "myweb-7ecb4",
  storageBucket: "myweb-7ecb4.firebasestorage.app",
  messagingSenderId: "1027238820127",
  appId: "1:1027238820127:web:7b3d49b74d8151ec53582a",
  measurementId: "G-81JY5FKV0E"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Offline persistence can only be enabled in one tab at a time.');
  } else if (err.code === 'unimplemented') {
    console.warn('Offline persistence is not available in this browser.');
  }
});

export default app;
