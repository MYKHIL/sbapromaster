import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
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
// 1. Remove all spaces but maintain special characters (except '_', which is replaced with '-')
export const sanitizeSchoolName = (schoolName: string): string => {
    // Replace underscores with hyphens first, then remove spaces
    return schoolName.trim().replace(/_/g, '-').replace(/\s+/g, '');
};

// Helper to sanitize academic year
// 1. Remove all spaces
// 2. Replace underscores with hyphens
export const sanitizeAcademicYear = (year: string): string => {
    return year.trim().replace(/_/g, '-').replace(/\s+/g, '');
};

// Helper to sanitize academic term
// 1. Replace all spaces with hyphens
export const sanitizeAcademicTerm = (term: string): string => {
    return term.trim().replace(/\s+/g, '-');
};

// Helper to create the full document ID
export const createDocumentId = (schoolName: string, academicYear: string, academicTerm: string): string => {
    const sanitizedSchool = sanitizeSchoolName(schoolName);
    const sanitizedYear = sanitizeAcademicYear(academicYear);
    const sanitizedTerm = sanitizeAcademicTerm(academicTerm);
    return `${sanitizedSchool}_${sanitizedYear}_${sanitizedTerm}`;
};

// Helper to search for schools and get available years
import { collection, getDocs } from "firebase/firestore";

export const searchSchools = async (partialName: string): Promise<{ schoolName: string, years: string[] } | null> => {
    if (!partialName || partialName.length < 3) return null;

    const sanitizedInput = sanitizeSchoolName(partialName);
    const schoolsRef = collection(db, "schools");

    // Fetch all documents to filter client-side (assuming dataset size allows)
    const querySnapshot = await getDocs(schoolsRef);
    const matches: string[] = [];

    querySnapshot.forEach((doc) => {
        if (doc.id.startsWith(sanitizedInput)) {
            matches.push(doc.id);
        }
    });

    if (matches.length > 0) {
        // Extract the school name part (everything before the first underscore)
        // The ID format is: SchoolName_Year_Term
        const firstMatchId = matches[0];
        const firstUnderscoreIndex = firstMatchId.indexOf('_');
        if (firstUnderscoreIndex === -1) return null;

        const matchedSchoolNamePart = firstMatchId.substring(0, firstUnderscoreIndex);

        // Now find all years for this school
        const yearsSet = new Set<string>();
        matches.forEach(id => {
            if (id.startsWith(matchedSchoolNamePart + '_')) {
                const parts = id.split('_');
                // Format: School_Year_Term
                // parts[0] = School
                // parts[1] = Year (sanitized)
                // parts[2] = Term (sanitized)

                if (parts.length >= 2) {
                    // We want to return the year. Ideally we return the sanitized year found in the ID.
                    // The UI can then display it.
                    yearsSet.add(parts[1]);
                }
            }
        });

        return {
            schoolName: matchedSchoolNamePart,
            years: Array.from(yearsSet)
        };
    }

    return null;
};

// Helper to login or register a school
export const loginOrRegisterSchool = async (docId: string, password: string, initialData: AppDataType): Promise<LoginResult> => {
    try {
        // docId is already constructed by the caller using createDocumentId
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
export const saveUserDatabase = async (docId: string, data: Partial<AppDataType>) => {
    // docId is expected to be the full document ID (sanitized)
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
import { onSnapshot } from "firebase/firestore";

export const subscribeToSchoolData = (docId: string, callback: (data: AppDataType) => void) => {
    const docRef = doc(db, "schools", docId);

    return onSnapshot(docRef, (doc) => {
        if (doc.exists()) {
            callback(doc.data() as AppDataType);
        }
    }, (error) => {
        console.error("Real-time sync error:", error);
    });
};
