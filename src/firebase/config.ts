import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
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

// Use modern persistent cache with multi-tab support
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export const storage = getStorage(app);

export default app;
