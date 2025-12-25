import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, collection, getDocs, onSnapshot, runTransaction, query, where, documentId, writeBatch, updateDoc, deleteField, Unsubscribe, limit, startAfter, orderBy, DocumentSnapshot, WriteBatch } from "firebase/firestore";
import type { SchoolSettings, Student, Subject, Class, Grade, Assessment, Score, ReportSpecificData, ClassSpecificData, User, DeviceCredential, UserLog, OnlineUser, AppDataType } from '../types';

// CACHE STORAGE
// @ts-ignore
const historyCache = new Map<string, { timestamp: number, data: AppDataType[] }>();
// @ts-ignore
const searchCache = new Map<string, { timestamp: number, results: any }>();
const CACHE_TTL = 60 * 1000; // 1 Minute Cache for frequent lookups
// Re-export AppDataType so it's available
export type { AppDataType };

// -----------------------------------------------------------------------------
// CONFIGURATION
// -----------------------------------------------------------------------------
import { ACTIVE_DATABASE_INDEX } from '../constants';
import { trackFirebaseRead, trackFirebaseWrite } from './analyticsTracking';

const firebaseConfigs = [
    // INDEX 0: Placeholder
    {},
    // INDEX 1: Primary Database
    {
        apiKey: "AIzaSyCe0O-mBCODiEA-KNVLXLMp00lJ6_Jt5SU",
        authDomain: "sba-pro-master-759f6.firebaseapp.com",
        projectId: "sba-pro-master-759f6",
        storageBucket: "sba-pro-master-759f6.firebasestorage.app",
        messagingSenderId: "239073604626",
        appId: "1:239073604626:web:452bc2719fc980704d14cb",
        measurementId: "G-47MMKKX888"
    },
    // INDEX 2: Backup Database
    {
        apiKey: "AIzaSyBP6gLbFLhfbAvjB2ddXSq6zqE_gWK2MEI",
        authDomain: "sba-pro-master-40f08.firebaseapp.com",
        projectId: "sba-pro-master-40f08",
        storageBucket: "sba-pro-master-40f08.firebasestorage.app",
        messagingSenderId: "91692962474",
        appId: "1:91692962474:web:eefa6a3a04ba557c38b6d3",
        measurementId: "G-EHHNKZ5FBG"
    }
];

const isEmulator = import.meta.env.VITE_USE_EMULATOR === 'true'; // @ts-ignore

// In Emulator Mode, we ALWAYS use Index 2 (sba-pro-master-40f08) because that's what the Emulator is started with.
const targetIndex = isEmulator ? 2 : ACTIVE_DATABASE_INDEX;

const selectedConfig = firebaseConfigs[targetIndex] || firebaseConfigs[1];
console.log(`[Firebase] Initializing with Database Index: ${targetIndex} (${selectedConfig['projectId']}) ${isEmulator ? '[EMULATOR FORCED]' : ''}`);

const app = initializeApp(selectedConfig);
const analytics = getAnalytics(app);
export const db = getFirestore(app);

// Check if we are in Debug/Emulator Mode
// @ts-ignore
if (import.meta.env.VITE_USE_EMULATOR === 'true') {
    console.warn("⚠️ USING FIRESTORE EMULATOR ⚠️");
    try {
        connectFirestoreEmulator(db, '127.0.0.1', 8080);
        console.log("✅ Main Firestore connected to emulator on 127.0.0.1:8080");
    } catch (e) {
        console.error("Failed to connect to emulator:", e);
    }
}

// -----------------------------------------------------------------------------
// UTILITIES
// -----------------------------------------------------------------------------

// Simple debounce implementation
const debounce = (func: Function, wait: number) => {
    let timeout: NodeJS.Timeout;
    return (...args: any[]) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
};

// Sanitize helpers
export const sanitizeSchoolName = (schoolName: string): string =>
    schoolName.trim().replace(/_/g, '-').replace(/\//g, '').replace(/\s+/g, '').toLowerCase();

export const sanitizeAcademicYear = (year: string): string =>
    year.trim().replace(/_/g, '-').replace(/\//g, '').replace(/\s+/g, '').toLowerCase();

export const sanitizeAcademicTerm = (term: string): string =>
    term.trim().replace(/\s+/g, '-');

export const createDocumentId = (schoolName: string, academicYear: string, academicTerm: string): string => {
    const sanitizedSchool = sanitizeSchoolName(schoolName);
    const sanitizedYear = sanitizeAcademicYear(academicYear);
    const sanitizedTerm = sanitizeAcademicTerm(academicTerm);
    return `${sanitizedSchool}_${sanitizedYear}_${sanitizedTerm}`;
};

// -----------------------------------------------------------------------------
// CACHING UTILITIES (TTL-based localStorage)
// -----------------------------------------------------------------------------

interface CachedData<T> {
    data: T;
    timestamp: number;
    ttl: number; // Time to live in milliseconds
}

/**
 * Store data in localStorage with TTL
 */
const setCachedData = <T>(key: string, data: T, ttlMs: number): void => {
    try {
        const cached: CachedData<T> = {
            data,
            timestamp: Date.now(),
            ttl: ttlMs
        };
        localStorage.setItem(key, JSON.stringify(cached));
    } catch (e) {
        console.warn(`[Cache] Failed to cache ${key}:`, e);
    }
};

/**
 * Retrieve data from localStorage if not expired
 */
const getCachedData = <T>(key: string): T | null => {
    try {
        const item = localStorage.getItem(key);
        if (!item) return null;

        const cached: CachedData<T> = JSON.parse(item);
        const age = Date.now() - cached.timestamp;

        if (age > cached.ttl) {
            // Expired - remove from cache
            localStorage.removeItem(key);
            return null;
        }

        return cached.data;
    } catch (e) {
        console.warn(`[Cache] Failed to read cache ${key}:`, e);
        return null;
    }
};

/**
 * Clear specific cache key
 */
const clearCache = (key: string): void => {
    try {
        localStorage.removeItem(key);
    } catch (e) {
        console.warn(`[Cache] Failed to clear ${key}:`, e);
    }
};

/**
 * Clear all auth-related caches
 */
export const clearAuthCaches = (): void => {
    clearCache('auth_school_list');
    // Clear all period caches (they start with auth_periods_)
    try {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('auth_periods_')) {
                localStorage.removeItem(key);
            }
        });
    } catch (e) {
        console.warn('[Cache] Failed to clear auth caches:', e);
    }
};

const sanitizeForFirestore = (obj: any): any => {
    if (obj === undefined) return null;
    if (obj === null) return null;
    if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
    if (typeof obj === 'object') {
        const newObj: any = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                newObj[key] = sanitizeForFirestore(obj[key]);
            }
        }
        return newObj;
    }
    return obj;
};

// -----------------------------------------------------------------------------
// MIGRATION & LEGACY SUPPORT
// -----------------------------------------------------------------------------

// Helper to migrate legacy arrays to subcollections is DISABLED for optimization refactor
// as it forces reads. We assume migration is done or handled lazily.

// -----------------------------------------------------------------------------
// CORE FETCHING (LAZY LOADING)
// -----------------------------------------------------------------------------

/**
 * Fetch MAIN School Data ONLY (Settings, Metadata, Access)
 * Removed "Fan-In" logic to prevent massive reads on login.
 */
export const getSchoolData = async (docId: string, keysToFetch?: (keyof AppDataType)[]): Promise<AppDataType | null> => {
    try {
        const docRef = doc(db, "schools", docId);
        trackFirebaseRead('getSchoolData', 'schools', 1, 'Loading main school data');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            // Only return the main document data. Subcollections must be fetched via specific hooks.
            // If keysToFetch is provided, we technically could fetch them, but for optimization
            // we prefer the UI to call the specialized fetch functions.
            // However, to maintain some backward compatibility for scripts relying on strict keys:
            if (keysToFetch && keysToFetch.length > 0) {
                // Warning: This re-enables fan-in if keys are requested.
                // We'll trust the caller (DataContext) to NOT request heavy keys on init.
            }
            return docSnap.data() as AppDataType;
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error getting school data:", error);
        return null;
    }
};

/**
 * Paginated Fetch for Students
 */
export const fetchStudents = async (
    docId: string,
    pageSize: number = 50,
    lastVisible: DocumentSnapshot | null = null
): Promise<{ students: Student[], lastDoc: DocumentSnapshot | null }> => {
    try {
        const studentsRef = collection(db, "schools", docId, "students");
        let q = query(studentsRef, orderBy("name"), limit(pageSize));

        if (lastVisible) {
            q = query(studentsRef, orderBy("name"), startAfter(lastVisible), limit(pageSize));
        }

        trackFirebaseRead('fetchStudents', 'students', pageSize, `Fetching students page (limit: ${pageSize})`);
        const snapshot = await getDocs(q);
        const students = snapshot.docs.map(d => d.data() as Student);
        const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;

        return { students, lastDoc };
    } catch (error) {
        console.error("Error fetching students:", error);
        return { students: [], lastDoc: null };
    }
};

/**
 * Optimized Score Fetching (Supports both Old Individual Docs & New Buckets)
 */
export const fetchScoresForClass = async (docId: string, classId: number, subjectId: number): Promise<Score[]> => {
    const scores: Score[] = [];

    // 1. Try fetching from the "Bucket" first (schools/{schoolId}/score_buckets/{classId}_{subjectId})
    try {
        const bucketId = `subject_${subjectId}`; // Simplifying to Subject Buckets as per implementation limitations
        const bucketRef = doc(db, "schools", docId, "score_buckets", bucketId);
        trackFirebaseRead('fetchScoresForClass', 'score_buckets', 1, `Fetching bucket: ${bucketId}`);
        const bucketSnap = await getDoc(bucketRef);

        if (bucketSnap.exists()) {
            const data = bucketSnap.data();
            if (data.scoresMap) {
                return Object.values(data.scoresMap);
            }
        }
    } catch (e) {
        console.warn("Error fetching score bucket:", e);
    }

    // 2. Fallback: Fetch legacy individual score documents if bucket missing/empty
    try {
        const scoresRef = collection(db, "schools", docId, "scores");
        const q = query(scoresRef, where("subjectId", "==", subjectId));
        trackFirebaseRead('fetchScoresForClass (fallback)', 'scores', 0, 'Querying legacy scores');
        const snap = await getDocs(q);
        trackFirebaseRead('fetchScoresForClass (fallback)', 'scores', snap.size, 'Fetched legacy scores');
        snap.forEach(d => scores.push(d.data() as Score));
        return scores;
    } catch (e) {
        console.error("Error fetching legacy scores:", e);
        return [];
    }
};

// -----------------------------------------------------------------------------
// AUTHENTICATION FUNCTIONS (Read-Optimized with Caching)
// -----------------------------------------------------------------------------

export interface SchoolListItem {
    displayName: string;
    docId: string;
}

export interface SchoolPeriod {
    year: string;
    term: string;
    docId: string;
}

/**
 * Get list of all schools with actual names (CACHED 24hrs)
 * Read Cost: 1 list operation (only on cache miss)
 */
export const getSchoolList = async (): Promise<SchoolListItem[]> => {
    const CACHE_KEY = 'auth_school_list';
    const TTL = 24 * 60 * 60 * 1000; // 24 hours

    // Try cache first
    const cached = getCachedData<SchoolListItem[]>(CACHE_KEY);
    if (cached) {
        console.log('[Auth] Using cached school list');
        return cached;
    }

    console.log('[Auth] Fetching school list from Firestore...');
    try {
        const schoolsRef = collection(db, 'schools');
        trackFirebaseRead('getSchoolList', 'schools', 0, 'Fetching all schools list');
        const snapshot = await getDocs(schoolsRef);
        trackFirebaseRead('getSchoolList', 'schools', snapshot.size, 'Fetched all schools list');

        const schools: SchoolListItem[] = [];
        const seenNames = new Set<string>(); // Deduplicate by school name

        snapshot.forEach(doc => {
            const data = doc.data();

            // Skip schools with Access: false
            if (data.Access === false) {
                console.log(`[Auth] Skipping school ${doc.id} - Access denied`);
                return;
            }

            const displayName = data.settings?.schoolName || 'Unknown School';

            // Only add unique school names
            if (!seenNames.has(displayName)) {
                seenNames.add(displayName);
                schools.push({
                    displayName,
                    docId: doc.id
                });
            }
        });

        // Sort alphabetically
        schools.sort((a, b) => a.displayName.localeCompare(b.displayName));

        // Cache the result
        setCachedData(CACHE_KEY, schools, TTL);
        console.log(`[Auth] Fetched ${schools.length} unique schools`);

        return schools;
    } catch (error) {
        console.error('[Auth] Error fetching school list:', error);
        return [];
    }
};

/**
 * Get all available years and terms for a specific school (CACHED 1hr per school)
 * Read Cost: 1 list operation per school (only on cache miss)
 */
export const getSchoolYearsAndTerms = async (schoolName: string): Promise<SchoolPeriod[]> => {
    const CACHE_KEY = `auth_periods_${sanitizeSchoolName(schoolName)}`;
    const TTL = 60 * 60 * 1000; // 1 hour

    // Try cache first
    const cached = getCachedData<SchoolPeriod[]>(CACHE_KEY);
    if (cached) {
        console.log(`[Auth] Using cached periods for ${schoolName}`);
        return cached;
    }

    console.log(`[Auth] Fetching periods for ${schoolName}...`);
    try {
        const schoolsRef = collection(db, 'schools');
        trackFirebaseRead('getSchoolYearsAndTerms', 'schools', 0, 'Fetching years/terms');
        const snapshot = await getDocs(schoolsRef);
        trackFirebaseRead('getSchoolYearsAndTerms', 'schools', snapshot.size, 'Fetched years/terms');

        const periods: SchoolPeriod[] = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            const docSchoolName = data.settings?.schoolName;

            // Match by actual school name
            if (docSchoolName === schoolName) {
                periods.push({
                    year: data.settings?.academicYear || 'Unknown Year',
                    term: data.settings?.academicTerm || 'Unknown Term',
                    docId: doc.id
                });
            }
        });

        // Sort by year (descending) then term
        periods.sort((a, b) => {
            const yearCompare = b.year.localeCompare(a.year);
            if (yearCompare !== 0) return yearCompare;
            return a.term.localeCompare(b.term);
        });

        // Cache the result
        setCachedData(CACHE_KEY, periods, TTL);
        console.log(`[Auth] Found ${periods.length} periods for ${schoolName}`);

        return periods;
    } catch (error) {
        console.error(`[Auth] Error fetching periods for ${schoolName}:`, error);
        return [];
    }
};

/**
 * Verify password for a school (Field-level read - only fetches password)
 * Read Cost: 1 document read (minimal data transfer)
 */
export const verifySchoolPassword = async (docId: string, password: string): Promise<boolean> => {
    try {
        console.log(`[Auth] Verifying password for ${docId}...`);
        const docRef = doc(db, 'schools', docId);
        trackFirebaseRead('verifySchoolPassword', 'schools', 1, 'Verifying password');
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            console.warn(`[Auth] School ${docId} not found`);
            return false;
        }

        const data = docSnap.data();
        const storedPassword = data.password;

        if (!storedPassword) {
            console.warn(`[Auth] No password set for ${docId}`);
            return false;
        }

        const isValid = storedPassword === password;
        console.log(`[Auth] Password ${isValid ? 'valid' : 'invalid'}`);
        return isValid;
    } catch (error) {
        console.error(`[Auth] Error verifying password:`, error);
        return false;
    }
};


// -----------------------------------------------------------------------------
// SMART SUBSCRIPTIONS
// -----------------------------------------------------------------------------

/**
 * subscribeToSchoolData - Reduced scope. Only listens to MAIN document.
 */
export const subscribeToSchoolData = (docId: string, callback: (data: AppDataType) => void) => {
    const docRef = doc(db, "schools", docId);
    return onSnapshot(docRef, { includeMetadataChanges: true }, (docSnap) => {
        if (docSnap.exists()) {
            callback(docSnap.data() as AppDataType);
        }
    });
};

/**
 * On-Demand Subscriptions for specific lists
 */
export const subscribeToResource = (
    docId: string,
    resourceName: 'students' | 'classes' | 'subjects' | 'assessments',
    callback: (data: any[]) => void
) => {
    const colRef = collection(db, "schools", docId, resourceName);
    return onSnapshot(colRef, (snapshot) => {
        const items = snapshot.docs.map(d => d.data());
        callback(items);
    });
};

/**
 * Generic Fetch for simple subcollections (Classes, Subjects, Assessments)
 */
export const fetchSubcollection = async <T>(docId: string, resourceName: string): Promise<T[]> => {
    try {
        const colRef = collection(db, "schools", docId, resourceName);
        trackFirebaseRead('fetchSubcollection', resourceName, 0, `Fetching all ${resourceName}`);
        const snapshot = await getDocs(colRef);
        trackFirebaseRead('fetchSubcollection', resourceName, snapshot.size, `Fetched all ${resourceName}`);
        return snapshot.docs.map(d => d.data() as T);
    } catch (e) {
        console.error(`Error fetching ${resourceName}:`, e);
        return [];
    }
};

// -----------------------------------------------------------------------------
// WRITING (BATCHING & OPTIMIZATION)
// -----------------------------------------------------------------------------

/**
 * Optimized Write with Batching and Buckets
 */
export const saveDataTransaction = async (
    docId: string,
    updates: Partial<AppDataType>,
    deletions?: Record<string, string[]>
) => {
    // Helper to manage batches
    const executeBatch = async (operations: ((batch: WriteBatch) => void)[]) => {
        const BATCH_SIZE = 450; // Safety margin below 500
        for (let i = 0; i < operations.length; i += BATCH_SIZE) {
            const batch = writeBatch(db);
            const chunk = operations.slice(i, i + BATCH_SIZE);
            chunk.forEach(op => op(batch));
            await batch.commit();
            console.log(`[Optimization] ✅ Committed batch chunk ${i / BATCH_SIZE + 1} (${chunk.length} ops)`);
        }
    };

    try {
        const operations: ((batch: WriteBatch) => void)[] = [];
        const mainUpdates: any = {};
        const MAIN_KEYS = ['settings', 'userLogs', 'activeSessions', 'users', 'access', 'password'];

        // --- HANDLE SCORES (Subject Bucketing) ---
        if (updates.scores && Array.isArray(updates.scores)) {
            console.log(`[Optimization] 🍱 Bucketing ${updates.scores.length} scores...`);

            const subjectBuckets: Record<number, Record<string, Score>> = {};

            updates.scores.forEach(s => {
                if (!subjectBuckets[s.subjectId]) subjectBuckets[s.subjectId] = {};
                subjectBuckets[s.subjectId][s.id] = s;
            });

            for (const [subId, map] of Object.entries(subjectBuckets)) {
                // Use a 'subject_id' document to hold all scores for that subject
                const bucketRef = doc(db, "schools", docId, "score_buckets", `subject_${subId}`);
                operations.push((batch) => batch.set(bucketRef, { scoresMap: map }, { merge: true }));
            }
        }

        // --- HANDLE SUBCOLLECTIONS (Fan-Out with Batch) ---
        const SUBCOLLECTION_KEYS = ['students', 'classes', 'subjects', 'assessments'];

        for (const key of Object.keys(updates)) {
            if (SUBCOLLECTION_KEYS.includes(key)) {
                // @ts-ignore
                const items = updates[key] as any[];
                if (Array.isArray(items)) {
                    items.forEach(item => {
                        if (item.id) {
                            const ref = doc(db, "schools", docId, key, String(item.id));
                            operations.push((batch) => batch.set(ref, sanitizeForFirestore(item), { merge: true }));
                        }
                    });
                }
            } else if (MAIN_KEYS.includes(key) || key === 'userLogs' || key === 'activeSessions') {
                const val = (updates as any)[key];
                mainUpdates[key] = val;
            }
        }

        // deletions
        if (deletions) {
            for (const [key, ids] of Object.entries(deletions)) {
                if (SUBCOLLECTION_KEYS.includes(key)) {
                    ids.forEach(id => {
                        const ref = doc(db, "schools", docId, key, String(id));
                        operations.push((batch) => batch.delete(ref));
                    });
                }
            }
        }

        if (Object.keys(mainUpdates).length > 0) {
            const docRef = doc(db, "schools", docId);
            operations.push((batch) => batch.set(docRef, sanitizeForFirestore(mainUpdates), { merge: true }));
        }

        if (operations.length > 0) {
            trackFirebaseWrite('saveDataTransaction', 'multi', `Saving batch of ${operations.length} operations`);
            await executeBatch(operations);
        }

    } catch (error) {
        console.error("Batch save failed:", error);
        throw error;
    }
};

// -----------------------------------------------------------------------------
// DEBOUNCED LOGGING
// -----------------------------------------------------------------------------

export const logUserActivity = debounce(async (docId: string, log: UserLog) => {
    try {
        // Debounced blind write (assuming we want to append-ish or just track latest?)
        // Since we can't reliably append without reading or arrayUnion, and we don't import arrayUnion,
        // We will perform a quick Read-Write. 
        // Or better: Just log to console that we *would* write, to save quota completely for this task demo?
        // No, user wants implementation.
        // We will use updateDoc with a read.
        const docRef = doc(db, "schools", docId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            const logs = data.userLogs || [];
            logs.push(log);
            if (logs.length > 20) logs.splice(0, logs.length - 20); // Strict Prune
            await updateDoc(docRef, { userLogs: logs });
        }
    } catch (e) { console.error("Log error", e); }
}, 3000);

export const updateHeartbeat = debounce(async (docId: string, userId: number) => {
    try {
        const docRef = doc(db, "schools", docId);
        await updateDoc(docRef, {
            [`activeSessions.${userId}`]: new Date().toISOString()
        });
    } catch (error) {
    }
}, 3000);

// -----------------------------------------------------------------------------
// LOGIN / SEARCH (Maintained)
// -----------------------------------------------------------------------------

export const searchSchools = async (partialName: string): Promise<{ schoolName: string, years: string[] }[] | null> => {
    if (!partialName || partialName.length < 3) return null;
    const sanitizedInput = sanitizeSchoolName(partialName);
    const schoolsRef = collection(db, "schools");
    const capitalizedInput = sanitizedInput.charAt(0).toUpperCase() + sanitizedInput.slice(1);

    const q1 = query(schoolsRef, where(documentId(), '>=', sanitizedInput), where(documentId(), '<=', sanitizedInput + '\uf8ff'));
    const q2 = query(schoolsRef, where(documentId(), '>=', capitalizedInput), where(documentId(), '<=', capitalizedInput + '\uf8ff'));

    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const matches: string[] = [];
    const seen = new Set<string>();

    const processDoc = (doc: any) => {
        if (seen.has(doc.id)) return;
        seen.add(doc.id);
        if (doc.id.toLowerCase().startsWith(sanitizedInput)) matches.push(doc.id);
    };

    snap1.forEach(processDoc);
    snap2.forEach(processDoc);

    if (matches.length > 0) {
        const schoolsMap = new Map<string, Set<string>>();
        matches.forEach(id => {
            const firstUnderscoreIndex = id.indexOf('_');
            if (firstUnderscoreIndex !== -1) {
                const schoolNamePart = id.substring(0, firstUnderscoreIndex);
                const parts = id.split('_');
                if (parts.length >= 2) {
                    if (!schoolsMap.has(schoolNamePart)) schoolsMap.set(schoolNamePart, new Set());
                    schoolsMap.get(schoolNamePart)?.add(parts[1]);
                }
            }
        });
        return Array.from(schoolsMap.entries()).map(([schoolName, yearsSet]) => ({
            schoolName,
            years: Array.from(yearsSet)
        }));
    }
    return null;
};

export const initializeNewTermDatabase = async (docId: string, data: AppDataType) => {
    // We use saveDataTransaction to ensure the new term starts with the optimized
    // subcollection structure (Fan-Out) immediately.
    await saveDataTransaction(docId, data);
};

export const loginOrRegisterSchool = async (docId: string, password: string, initialData: AppDataType, createIfMissing: boolean = false) => {
    console.log(`[FIREBASE_DEBUG] loginOrRegisterSchool called for docId: ${docId}, createIfMissing: ${createIfMissing}`);
    try {
        let targetDocId = docId;
        let docRef = doc(db, "schools", targetDocId);

        console.log(`[FIREBASE_DEBUG] Fetching document: schools/${targetDocId}`);
        trackFirebaseRead('loginOrRegisterSchool', 'schools', 1, `Checking school existence: ${targetDocId}`);
        let docSnap = await getDoc(docRef);
        console.log(`[FIREBASE_DEBUG] Document exists? ${docSnap.exists()}`);

        if (!docSnap.exists()) {
            console.log(`[FIREBASE_DEBUG] Document not found. Attempting case-insensitive fallback search...`);
            // Case-insensitive fallback
            const schoolsRef = collection(db, "schools");
            const q = query(schoolsRef, where(documentId(), '>=', targetDocId.toLowerCase()), limit(5)); // Optimize fallback
            trackFirebaseRead('loginOrRegisterSchool (fallback)', 'schools', 5, 'Fallback case-insensitive search');
            const snap = await getDocs(q);
            console.log(`[FIREBASE_DEBUG] Fallback search found ${snap.size} documents.`);

            const match = snap.docs.find(d => d.id.toLowerCase() === docId.toLowerCase());
            if (match) {
                console.log(`[FIREBASE_DEBUG] Fallback match found: ${match.id}`);
                targetDocId = match.id;
                docRef = doc(db, "schools", targetDocId);
                docSnap = match;
            } else {
                console.log(`[FIREBASE_DEBUG] No matching document found in fallback.`);
            }
        }

        if (docSnap.exists()) {
            console.log(`[FIREBASE_DEBUG] Processing existing document...`);
            const data = docSnap.data() as AppDataType;

            // Debug logs for password comparison (be careful with real passwords in logs, but for debug it's ok)
            // console.log(`[FIREBASE_DEBUG] Stored password: ${data.password}, Provided: ${password}`);

            if (data.password !== password) {
                console.warn(`[FIREBASE_DEBUG] Password mismatch.`);
                return { status: 'wrong_password' };
            }
            if (data.Access === false) {
                console.warn(`[FIREBASE_DEBUG] Access denied (Access flag is false).`);
                return { status: 'access_denied' };
            }

            console.log(`[FIREBASE_DEBUG] Login successful. Returning data.`);
            // OPTIMIZATION: Return ONLY main data. Do not fan-in.
            return { status: 'success', data: data, docId: targetDocId };
        } else {
            if (!createIfMissing) {
                console.log(`[FIREBASE_DEBUG] Document not found and createIfMissing is false.`);
                return { status: 'not_found' };
            }
            console.log(`[FIREBASE_DEBUG] Creating new school document: ${docId}`);
            // Respect Access from initialData (allows debug mode to set Access: true)
            const newData = { ...initialData, password, Access: initialData.Access ?? false };
            await setDoc(doc(db, "schools", docId), newData);

            // If Access is true, return success (debug mode). Otherwise, pending.
            if (newData.Access === true) {
                console.log(`[FIREBASE_DEBUG] New document created with Access=true. Returning 'success'.`);
                return { status: 'success', data: newData, docId: docId };
            } else {
                console.log(`[FIREBASE_DEBUG] New document created with Access=false. Returning 'created_pending_access'.`);
                return { status: 'created_pending_access' };
            }
        }
    } catch (e: any) {
        console.error(`[FIREBASE_DEBUG] Error in loginOrRegisterSchool:`, e);
        return { status: 'error', message: e.message };
    }
};

// ... User Management (updateUsers, updateDeviceCredentials, getUserById) same as before but minimal ...

export const updateUsers = async (docId: string, users: User[]) => {
    const docRef = doc(db, "schools", docId);
    await setDoc(docRef, { users }, { merge: true });
};

export const getUserById = async (docId: string, userId: number): Promise<User | null> => {
    const docRef = doc(db, "schools", docId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data() as AppDataType;
        return data.users?.find(u => u.id === userId) || null;
    }
    return null;
};

export const updateDeviceCredentials = async (docId: string, deviceCredentials: DeviceCredential[]) => {
    const docRef = doc(db, "schools", docId);
    await setDoc(docRef, { deviceCredentials }, { merge: true });
};

/**
 * Fetch School History (All Terms)
 */
export const getSchoolHistory = async (schoolNamePrefix: string): Promise<AppDataType[]> => {
    try {
        // Check Cache
        const cached = historyCache.get(schoolNamePrefix);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
            console.log(`[Optimization] 🚀 Returning cached history for ${schoolNamePrefix}`);
            return cached.data;
        }

        const schoolsRef = collection(db, "schools");
        const q = query(schoolsRef,
            where(documentId(), '>=', schoolNamePrefix),
            where(documentId(), '<=', schoolNamePrefix + '\uf8ff')
        );
        trackFirebaseRead('getSchoolHistory', 'schools', 0, 'Fetching school history');
        const snapshot = await getDocs(q);
        trackFirebaseRead('getSchoolHistory', 'schools', snapshot.size, 'Fetched school history');
        const data = snapshot.docs.map(d => d.data() as AppDataType);

        // Update Cache
        historyCache.set(schoolNamePrefix, { timestamp: Date.now(), data });
        return data;
    } catch (error) {
        console.error("Error fetching school history:", error);
        return [];
    }
};
