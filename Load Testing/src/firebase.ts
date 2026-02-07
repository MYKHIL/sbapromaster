import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Using the Primary database config from constants.ts
export const firebaseConfig = {
    apiKey: "AIzaSyCe0O-mBCODiEA-KNVLXLMp00lJ6_Jt5SU",
    authDomain: "sba-pro-master-759f6.firebaseapp.com",
    projectId: "sba-pro-master-759f6",
    storageBucket: "sba-pro-master-759f6.firebasestorage.app",
    messagingSenderId: "239073604626",
    appId: "1:239073604626:web:452bc2719fc980704d14cb",
    measurementId: "G-47MMKKX888"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
