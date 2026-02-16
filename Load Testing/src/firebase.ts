import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Using the Primary database config from constants.ts
export const firebaseConfig = {
    apiKey: process.env.LOAD_TEST_API_KEY || "",
    authDomain: process.env.LOAD_TEST_AUTH_DOMAIN || "",
    projectId: process.env.LOAD_TEST_PROJECT_ID || "",
    storageBucket: process.env.LOAD_TEST_STORAGE_BUCKET || "",
    messagingSenderId: process.env.LOAD_TEST_MESSAGING_SENDER_ID || "",
    appId: process.env.LOAD_TEST_APP_ID || "",
    measurementId: process.env.LOAD_TEST_MEASUREMENT_ID || ""
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
