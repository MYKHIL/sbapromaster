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
// Replaces spaces and special characters with underscores
// Helper to sanitize school name for use as Firestore document ID
// 1. Remove all spaces but maintain special characters (except '_', which is removed)
// 2. Join year and term with '_'
export const sanitizeSchoolName = (schoolName: string): string => {
    // Remove spaces and underscores
    return schoolName.trim().replace(/[\s_]/g, '');
};

// Helper to create the full document ID
export const createDocumentId = (schoolName: string, academicYear: string, academicTerm: string): string => {
    const sanitizedSchool = sanitizeSchoolName(schoolName);
    // Replace spaces in term with underscores
    const sanitizedTerm = academicTerm.trim().replace(/\s+/g, '_');
    const sanitizedYear = academicYear.trim().replace(/\s+/g, '_'); // Just in case year has spaces
    return `${sanitizedSchool}_${sanitizedYear}_${sanitizedTerm}`;
};

// Helper to search for schools and get available years
import { collection, getDocs, query, where } from "firebase/firestore";

export const searchSchools = async (partialName: string): Promise<{ schoolName: string, years: string[] } | null> => {
    if (!partialName || partialName.length < 3) return null;

    const sanitizedInput = sanitizeSchoolName(partialName);
    const schoolsRef = collection(db, "schools");

    // We can't do a direct "starts with" query on the document ID easily because IDs are keys.
    // However, we can fetch all IDs (or a reasonable subset if we had a separate index, but here we might have to scan or rely on client-side filtering if the list is small, 
    // OR we assume we can just try to construct the ID).
    // Given the requirement "start matching each character... following how we sanitize them",
    // we effectively need to scan the collection's document IDs.
    // Firestore doesn't support regex search on document IDs directly in a scalable way without a separate index field.
    // BUT, for this specific request, we can fetch all documents (if not too many) or use a "name" field if we had one.
    // Since we only have the document ID structure, we might need to list all documents and filter client-side.
    // WARNING: Listing all documents is not scalable for production with thousands of schools.
    // For now, assuming a smaller dataset or that we should add a 'searchName' field.
    // Let's try to fetch all and filter.

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
        // But wait, the school name itself might contain special characters, but NO underscores (we removed them).
        // So the first underscore is indeed the separator.

        // We need to find the "best" match or just the first one?
        // "if a school name is found, we populate the academic year combobox"
        // We should group by school name.

        // Let's take the first match's school name part.
        const firstMatchId = matches[0];
        const firstUnderscoreIndex = firstMatchId.indexOf('_');
        if (firstUnderscoreIndex === -1) return null; // Should not happen with our format

        const matchedSchoolNamePart = firstMatchId.substring(0, firstUnderscoreIndex);

        // Now find all years for this school
        const yearsSet = new Set<string>();
        matches.forEach(id => {
            if (id.startsWith(matchedSchoolNamePart + '_')) {
                const parts = id.split('_');
                // Format: School_Year_Term
                // But Year might be "2025and2026" (no underscores in year ideally, but user said "AyirebiD/A_2025and2026_First_Term")
                // So the parts are: [School, Year, TermPart1, TermPart2...]
                // Actually, "First_Term" has an underscore.
                // So splitting by underscore gives: [School, Year, First, Term]
                // The year is the second part (index 1).
                if (parts.length >= 2) {
                    yearsSet.add(parts[1]);
                }
            }
        });

        return {
            schoolName: matchedSchoolNamePart, // This is the sanitized name. We don't have the original display name unless we store it.
            years: Array.from(yearsSet)
        };
    }

    return null;
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
