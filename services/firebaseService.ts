import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, onSnapshot } from "firebase/firestore";
import type { SchoolSettings, Student, Subject, Class, Grade, Assessment, Score, ReportSpecificData, ClassSpecificData, User, DeviceCredential, UserLog, OnlineUser } from '../types';

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
    // Multi-user authentication fields
    users?: User[];
    deviceCredentials?: DeviceCredential[];
    userLogs?: UserLog[];
    activeSessions?: Record<string, string>; // userId -> ISO timestamp
    // School-level auth (legacy/initial setup)
    password?: string;
    Access?: boolean;
};

export type LoginResult =
    | { status: 'success'; data: AppDataType; docId: string }
    | { status: 'access_denied' }
    | { status: 'wrong_password' }
    | { status: 'created_pending_access' }
    | { status: 'not_found' }
    | { status: 'error'; message: string };

// Helper to sanitize school name for use as Firestore document ID
// 1. Remove all spaces but maintain special characters (except '_', which is replaced with '-')
// 2. Remove slashes '/'
// 3. Convert to lowercase for case-insensitive matching
export const sanitizeSchoolName = (schoolName: string): string => {
    // Replace underscores with hyphens first, remove slashes, then remove spaces, then lowercase
    return schoolName.trim().replace(/_/g, '-').replace(/\//g, '').replace(/\s+/g, '').toLowerCase();
};

// Helper to sanitize academic year
// 1. Remove all spaces
// 2. Replace underscores with hyphens
// 3. Remove slashes '/'
// 4. Convert to lowercase
export const sanitizeAcademicYear = (year: string): string => {
    return year.trim().replace(/_/g, '-').replace(/\//g, '').replace(/\s+/g, '').toLowerCase();
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
export const searchSchools = async (partialName: string): Promise<{ schoolName: string, years: string[] }[] | null> => {
    if (!partialName || partialName.length < 3) return null;

    const sanitizedInput = sanitizeSchoolName(partialName);
    const schoolsRef = collection(db, "schools");

    // Fetch all documents to filter client-side (assuming dataset size allows)
    const querySnapshot = await getDocs(schoolsRef);
    const matches: string[] = [];

    querySnapshot.forEach((doc) => {
        // Since IDs are now lowercased by createDocumentId, we can just check startsWith
        // But for backward compatibility or if sanitizedInput is just a prefix, this works.
        // sanitizedInput is already lowercased by sanitizeSchoolName.
        if (doc.id.toLowerCase().startsWith(sanitizedInput)) {
            matches.push(doc.id);
        }
    });

    if (matches.length > 0) {
        // Group matches by school name
        const schoolsMap = new Map<string, Set<string>>();

        matches.forEach(id => {
            const firstUnderscoreIndex = id.indexOf('_');
            if (firstUnderscoreIndex !== -1) {
                const schoolNamePart = id.substring(0, firstUnderscoreIndex);
                const parts = id.split('_');
                // Format: School_Year_Term
                // parts[0] = School
                // parts[1] = Year (sanitized)

                if (parts.length >= 2) {
                    // We want to display the "original" looking name if possible, but we only have the ID.
                    // Ideally we would store the display name in the document, but for now we just use the ID part.
                    // Since we can't easily reverse the sanitization (spaces lost), we just use the ID part.
                    // However, to make it look slightly better, we could capitalize the first letter?
                    // For now, let's just use the ID part as is (which is lowercase).
                    if (!schoolsMap.has(schoolNamePart)) {
                        schoolsMap.set(schoolNamePart, new Set());
                    }
                    schoolsMap.get(schoolNamePart)?.add(parts[1]);
                }
            }
        });

        // Convert map to array of objects
        const results = Array.from(schoolsMap.entries()).map(([schoolName, yearsSet]) => ({
            schoolName,
            years: Array.from(yearsSet)
        }));

        return results;
    }

    return null;
};

// Helper to login or register a school
export const loginOrRegisterSchool = async (docId: string, password: string, initialData: AppDataType, createIfMissing: boolean = false): Promise<LoginResult> => {
    try {
        // docId is already constructed by the caller using createDocumentId (and is lowercase)
        let targetDocId = docId;
        let docRef = doc(db, "schools", targetDocId);
        let docSnap = await getDoc(docRef);

        // If direct match fails, try to find a case-insensitive match
        if (!docSnap.exists()) {
            const schoolsRef = collection(db, "schools");
            // This pulls all docs, which is heavy but necessary for client-side case-insensitive ID matching
            // given Firestore's limitations and the current architecture.
            const querySnapshot = await getDocs(schoolsRef);

            const match = querySnapshot.docs.find(d => d.id.toLowerCase() === docId.toLowerCase());

            if (match) {
                targetDocId = match.id;
                docRef = doc(db, "schools", targetDocId);
                docSnap = match; // Use the found snapshot
            }
        }

        if (docSnap.exists()) {
            const data = docSnap.data() as AppDataType;
            if (data.password === password) {
                if (data.Access === true) {
                    return { status: 'success', data, docId: targetDocId };
                } else {
                    return { status: 'access_denied' };
                }
            } else {
                return { status: 'wrong_password' };
            }
        } else {
            if (!createIfMissing) {
                return { status: 'not_found' };
            }
            // Create new school with the sanitized (lowercase) ID
            const newData: AppDataType = {
                ...initialData,
                password: password,
                Access: false // Default to false
            };
            // Reset docRef to the original sanitized ID for creation
            docRef = doc(db, "schools", docId);
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

// User Management Functions

/**
 * Update the users array in the school database
 */
export const updateUsers = async (docId: string, users: User[]) => {
    const docRef = doc(db, "schools", docId);
    await setDoc(docRef, { users }, { merge: true });
};

/**
 * Get a specific user by ID
 */
export const getUserById = async (docId: string, userId: number): Promise<User | null> => {
    const docRef = doc(db, "schools", docId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const data = docSnap.data() as AppDataType;
        const user = data.users?.find(u => u.id === userId);
        return user || null;
    }

    return null;
};

/**
 * Update device credentials in the database
 */
export const updateDeviceCredentials = async (docId: string, deviceCredentials: DeviceCredential[]) => {
    const docRef = doc(db, "schools", docId);
    await setDoc(docRef, { deviceCredentials }, { merge: true });
};

/**
 * Log a user activity
 */
export const logUserActivity = async (docId: string, log: UserLog) => {
    const docRef = doc(db, "schools", docId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return;

    const data = docSnap.data() as AppDataType;
    const logs = data.userLogs || [];

    // Optional: limit logs
    if (logs.length > 500) logs.shift(); // Keep last 500

    logs.push(log);

    await setDoc(docRef, { userLogs: logs }, { merge: true });
};

/**
 * Update user heartbeat
 */
export const updateHeartbeat = async (docId: string, userId: number) => {
    // We can't use simple dot notation for dynamic keys in setDoc with merge efficiently without a map
    // So we read-update-write activeSessions map
    const docRef = doc(db, "schools", docId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return;

    const data = docSnap.data() as AppDataType;
    const activeSessions = data.activeSessions || {};
    activeSessions[userId.toString()] = new Date().toISOString();

    await setDoc(docRef, { activeSessions }, { merge: true });
};

/**
 * Fetch the full school data document
 */
export const getSchoolData = async (docId: string): Promise<AppDataType | null> => {
    try {
        const docRef = doc(db, "schools", docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data() as AppDataType;
        }
        return null;
    } catch (e) {
        console.error("Error fetching school data:", e);
        throw e;
    }
};
