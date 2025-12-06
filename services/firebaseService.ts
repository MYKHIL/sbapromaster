import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import type { SchoolSettings, Student, Subject, Class, Grade, Assessment, Score, ReportSpecificData, ClassSpecificData } from '../types';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyBP6gLbFLhfbAvjB2ddXSq6zqE_gWK2MEI",
    authDomain: "sba-pro-master-40f08.firebaseapp.com",
    projectId: "sba-pro-master-40f08",
    storageBucket: "sba-pro-master-40f08.firebasestorage.app",
    messagingSenderId: "91692962474",
    appId: "1:91692962474:web:eefa6a3a04ba557c38b6d3",
    measurementId: "G-EHHNKZ5FBG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Type for the full application data (matching DataContext)
export type AppDataType = {
    settings: SchoolSettings;
    students: Student[];
    subjects: Subject[];
    classes: Class[];
    grades: Grade[];
    assessments: Assessment[];
    scores: Score[];
    reportData: ReportSpecificData[];
    classData: ClassSpecificData[];
    // New fields for custom auth
    password?: string;
    Access?: boolean;
};

export type LoginResult =
    | { status: 'success'; data: AppDataType }
    | { status: 'access_denied' }
    | { status: 'wrong_password' }
    | { status: 'created_pending_access' }
    | { status: 'error'; message: string };

// Helper to sanitize school name for use as Firestore document ID
// Replaces spaces and special characters with underscores
const sanitizeSchoolName = (schoolName: string): string => {
    return schoolName.trim().replace(/[^a-zA-Z0-9]/g, '_');
};

// Helper to login or register a school
export const loginOrRegisterSchool = async (schoolName: string, password: string, initialData: AppDataType): Promise<LoginResult> => {
    try {
        const docId = sanitizeSchoolName(schoolName); // Sanitize school name for use as document ID
        const docRef = doc(db, "schools", docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data() as AppDataType;
            if (data.password === password) {
                if (data.Access === true) {
                    return { status: 'success', data };
                } else {
                    return { status: 'access_denied' };
                }
            } else {
                return { status: 'wrong_password' };
            }
        } else {
            // Create new school
            const newData: AppDataType = {
                ...initialData,
                password: password,
                Access: false // Default to false
            };
            await setDoc(docRef, newData);
            return { status: 'created_pending_access' };
        }
    } catch (e: any) {
        console.error("Login/Register error:", e);
        return { status: 'error', message: e.message || "Unknown error occurred" };
    }
};

// Helper to save/update the database
export const saveUserDatabase = async (schoolName: string, data: Partial<AppDataType>) => {
    const docId = sanitizeSchoolName(schoolName);
    const docRef = doc(db, "schools", docId);
    // We use setDoc with merge: true to avoid overwriting the entire document if we only want to update parts,
    // but here we likely want to save the whole state. However, we must preserve 'password' and 'Access' if they are not in 'data'.
    // The 'data' passed from DataContext might not have password/Access if we don't store them in state.
    // So we should use { merge: true } carefully.
    // Actually, if we pass the full AppDataType from DataContext, we need to make sure we don't accidentally overwrite password/Access with undefined if they are missing.
    // Best approach: merge: true
    await setDoc(docRef, data, { merge: true });
};

// Helper to subscribe to real-time updates
export const subscribeToSchoolData = (schoolName: string, callback: (data: AppDataType) => void) => {
    const docId = sanitizeSchoolName(schoolName);
    const docRef = doc(db, "schools", docId);

    return onSnapshot(docRef, (doc) => {
        if (doc.exists()) {
            callback(doc.data() as AppDataType);
        }
    });
};
