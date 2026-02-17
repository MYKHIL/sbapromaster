import { initializeApp, deleteApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, signInAnonymously, connectAuthEmulator } from "firebase/auth";
import {
    getFirestore,
    connectFirestoreEmulator,
    doc,
    getDoc,
    setDoc,
    collection,
    getDocs,
    onSnapshot,
    runTransaction,
    query,
    where,
    documentId,
    writeBatch,
    updateDoc,
    deleteField,
    Unsubscribe,
    limit,
    startAfter,
    orderBy,
    DocumentSnapshot,
    WriteBatch,
    serverTimestamp,
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
    Timestamp
} from "firebase/firestore";
import type { SchoolSettings, Student, Subject, Class, Grade, Assessment, Score, ReportSpecificData, ClassSpecificData, User, DeviceCredential, UserLog, OnlineUser, AppDataType } from '../types';

// CACHE STORAGE
// @ts-ignore
const historyCache = new Map<string, { timestamp: number, data: AppDataType[] }>();
// @ts-ignore
const searchCache = new Map<string, { timestamp: number, results: any }>();
const inflightSchoolListPromises = new Map<string, Promise<SchoolListItem[]>>(); // CLEANUP: Prevent duplicate requests
const inflightSchoolPromises = new Map<string, Promise<AppDataType | null>>();
const inflightLoginPromises = new Map<string, Promise<any>>(); // NEW: Dedupe login calls
const inflightStudentPromises = new Map<string, Promise<{ students: Student[], lastDoc: DocumentSnapshot | null }>>(); // NEW: Dedupe student fetches
const inflightPeriodPromises = new Map<string, Promise<SchoolPeriod[]>>();
const CACHE_TTL = 60 * 1000; // 1 Minute Cache for frequent lookups
// Re-export AppDataType so it's available
export type { AppDataType };

// -----------------------------------------------------------------------------
// CONFIGURATION
// -----------------------------------------------------------------------------
import { ACTIVE_DATABASE_INDEX, FIREBASE_CONFIGS } from '../constants';
import { trackFirebaseRead, trackFirebaseWrite } from './analyticsTracking';

// @ts-ignore
const isEmulator = (import.meta as any).env.VITE_USE_EMULATOR === 'true';

// @ts-ignore
const isEmulator = (import.meta as any).env.VITE_USE_EMULATOR === 'true';

// In Emulator Mode, we ALWAYS use Index 2 (sba-pro-master-40f08) because that's what the Emulator is started with.
const targetIndex = isEmulator ? 2 : ACTIVE_DATABASE_INDEX;

const selectedConfig = FIREBASE_CONFIGS[targetIndex] || FIREBASE_CONFIGS[1];
console.log(`[Firebase] Initializing with Database Index: ${targetIndex} (${selectedConfig['projectId']}) ${isEmulator ? '[EMULATOR FORCED]' : ''}`);

const app = initializeApp(selectedConfig);
export const auth = getAuth(app);
const analytics = getAnalytics(app);

// ENABLE OFFLINE PERSISTENCE (The #1 Fix)
// We use initializeFirestore instead of getFirestore to pass settings
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});

export { analytics };

// Check if we are in Debug/Emulator Mode
// @ts-ignore
if ((import.meta as any).env.VITE_USE_EMULATOR === 'true') {
    console.warn("⚠️ USING FIRESTORE EMULATOR ⚠️");
    try {
        connectFirestoreEmulator(db, '127.0.0.1', 8080);
        connectAuthEmulator(auth, "http://127.0.0.1:9099");
        console.log("✅ Main Firestore & Auth connected to emulator");
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
// READ/WRITE LOGGING HELPERS
// -----------------------------------------------------------------------------
import { isLoggingEnabled } from './loggingControl';

export const loggedGetDoc = async (ref: any, label: string) => {
    try {
        if (isLoggingEnabled()) console.log(`[Firestore Read] ${label} -> ${ref.path}`);
        const snap = await getDoc(ref);
        if (isLoggingEnabled()) console.log(`[Firestore Read] ${label} -> exists=${snap.exists()}`);
        return snap;
    } catch (e) {
        console.error(`[Firestore Read] ${label} ERROR -> ${ref?.path || '<unknown>'}:`, e);
        throw e;
    }
};

export const loggedGetDocs = async (refOrQuery: any, label: string) => {
    try {
        if (isLoggingEnabled()) console.log(`[Firestore Read] ${label} -> fetching`);
        const snap = await getDocs(refOrQuery);
        if (isLoggingEnabled()) console.log(`[Firestore Read] ${label} -> docs=${snap.size}`);
        return snap;
    } catch (e) {
        console.error(`[Firestore Read] ${label} ERROR:`, e);
        throw e;
    }
};

export const loggedUpdateDoc = async (docRef: any, data: any, label: string) => {
    try {
        if (isLoggingEnabled()) console.log(`[Firestore Write] ${label} -> ${docRef.path}`, data);
        await updateDoc(docRef, data);
        if (isLoggingEnabled()) console.log(`[Firestore Write] ${label} -> completed ${docRef.path}`);
    } catch (e) {
        console.error(`[Firestore Write] ${label} ERROR -> ${docRef?.path || '<unknown>'}:`, e);
        throw e;
    }
};

export const loggedSetDoc = async (docRef: any, data: any, options: any = undefined, label: string) => {
    try {
        if (isLoggingEnabled()) console.log(`[Firestore Write] ${label} -> ${docRef.path}`);
        if (options) {
            await setDoc(docRef, data, options);
        } else {
            await setDoc(docRef, data);
        }
        if (isLoggingEnabled()) console.log(`[Firestore Write] ${label} -> completed ${docRef.path}`);
    } catch (e) {
        console.error(`[Firestore Write] ${label} ERROR -> ${docRef?.path || '<unknown>'}:`, e);
        throw e;
    }
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




// -----------------------------------------------------------------------------
// AUTHENTICATION & SCHOOL DISCOVERY
// -----------------------------------------------------------------------------




/*
    // 1. Check Cache
    const cached = getCachedData<SchoolListItem[]>('cached_school_list');
    if (cached) {
        console.log('[Firebase] Returning cached school list');
        return cached;
    }

    console.log('[Firebase] Fetching global school list from all databases...');
    trackFirebaseRead('global_discovery');

    const allSchools: SchoolListItem[] = [];

    // 2. Iterate all configs
    const promises = Object.entries(FIREBASE_CONFIGS).map(async ([indexStr, config]) => {
        const index = Number(indexStr);
        const appName = `temp_discovery_${index}_${Date.now()}`;

        let tempApp: any = null;
        try {
            // Initialize temporary app
            tempApp = initializeApp(config, appName);
            const tempDb = getFirestore(tempApp);

            // Query schools collection
            // We assume a 'schools' collection or similar exists. 
            // Based on previous code, getSchoolList queried 'schools'.
            const schoolsRef = collection(tempDb, 'schools');
            // Optimization: Limit purely to get names/IDs?
            // For now, just get all docs to display them. 
            // Note: If 'schools' collection is huge, this is expensive. 
            // Assuming 'schools' collection contains documents where ID is the school ID.
            // Or is it querying the ROOT documents?
            // The previous implementation (which I need to verify) likely queried a specific collection.
            // Wait, the previous implementation of getSchoolList just queried `collection(db, 'schools')`?
            // I need to be careful. The app structure seems to put school data in root docs or a collection.
            // Let's assume there is a 'schools' collection that indexes them, OR we query based on a pattern.
            // Actually, looking at `createDocumentId`, it seems schools are root documents? 
            // "sba-pro-master-..."
            // But `getSchoolList` usually implies a registry.
            // Let's assume there IS a 'schools' collection for discovery, as is common.
            // If not, and it was querying root, that's harder.
            // I will assume `collection(tempDb, 'schools')` is correct based on function name.

            // Actually, let's look at the previous implementation of `getSchoolList` I am replacing.
            // I need to check what `getSchoolList` did before. 
            // Usage of `getDocs` in previous code is key.

            // RE-VERIFICATION: I'll stick to `collection(tempDb, 'schools')` IF that's what was there.
            // If I made a mistake assumption, I'll fix it. 
            // Wait, I didn't see the body of `getSchoolList` in the `view_file` (it started at line 1, showed top 150).
            // I should verify `getSchoolList` implementation first to be safe.

            // FOR NOW, I will implement a safe version that assumes 'schools' collection.
            // If the user's DB relies on root docs, `getSchoolList` would have been doing `collectionGroup` or something else? 
            // Let's pause the replace and VIEW the file first to be sure.
            return [];
        } catch (e) {
            console.error(`[Firebase] Failed to query database ${index}:`, e);
            return [];
        } finally {
            if (tempApp) await deleteApp(tempApp).catch(() => { });
        }
    });

    return []; // Placeholder to stop the tool from writing potentially wrong code.

*/

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

    // Improved clearing: Loop through all keys to find all school list and period variants
    try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('auth_periods_') || key.startsWith('cached_school_list'))) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach(key => {
            console.log(`[Cache] Clearing auth cache key: ${key}`);
            localStorage.removeItem(key);
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
    // 1. Check inflight (Clean Up: Prevent dual fetching)
    if (inflightSchoolPromises.has(docId)) {
        console.log(`[Firebase] Returning inflight promise for school data: ${docId}`);
        return inflightSchoolPromises.get(docId)!;
    }

    const fetchPromise = (async () => {
        try {
            const docRef = doc(db, "schools", docId);
            trackFirebaseRead('getSchoolData', 'schools', 1, 'Loading main school data');
            const docSnap = await loggedGetDoc(docRef, `getSchoolData/${docId}`);

            if (docSnap.exists()) {
                const data = docSnap.data() as AppDataType;

                // ---------------------------------------------------------
                // OPTIMIZATION: STRIP LEGACY DATA TO ENFORCE BUCKET USAGE
                // ---------------------------------------------------------
                // We explicitly remove these heavy arrays so DataContext sees them as empty.
                // This forces the 'lazy load' logic to trigger, which will then use
                // the optimized 'fetchStudents' (bucket) and 'fetchMetadata' (bundle) paths.
                if (data.students) delete data.students;
                if (data.scores) delete data.scores;
                if (data.classes) delete data.classes;
                if (data.subjects) delete data.subjects;
                if (data.assessments) delete data.assessments;

                return data;
            } else {
                return null;
            }
        } catch (error) {
            console.error("Error getting school data:", error);
            return null;
        } finally {
            inflightSchoolPromises.delete(docId);
        }
    })();

    inflightSchoolPromises.set(docId, fetchPromise);
    return fetchPromise;
};

/**
 * Optimized Student Fetching (Supports both Bucket & Legacy Subcollection)
 * 
 * Composite Strategy: Tries to fetch all students from a single bucket document first
 * (1 read for all students), then falls back to individual subcollection reads if needed.
 */
export const fetchStudents = async (
    docId: string,
    pageSize: number = 50,
    lastVisible: DocumentSnapshot | null = null
): Promise<{ students: Student[], lastDoc: DocumentSnapshot | null }> => {
    // 1. OPTIMIZATION: Dedupe simultaneous requests
    // Only dedupe initial loads (no cursor) to simplify key generation.
    // Paginated requests are usually triggered by user action and less likely to race.
    const cacheKey = `${docId}_${pageSize}_${lastVisible ? 'cursor' : 'initial'}`;

    if (inflightStudentPromises.has(cacheKey)) {
        console.log(`[Firebase] 🛡️ Returning inflight promise for fetchStudents: ${cacheKey}`);
        return inflightStudentPromises.get(cacheKey)!;
    }

    const fetchPromise = (async () => {
        // 1. Try fetching from the "Bucket" first (schools/{schoolId}/config/student_bucket_manifest)
        try {
            const manifestRef = doc(db, "schools", docId, "config", "student_bucket_manifest");
            trackFirebaseRead('fetchStudents', 'config', 1, 'Checking student bucket manifest');
            const manifestSnap = await loggedGetDoc(manifestRef, `fetchStudents/manifest/${docId}`);

            let allStudents: Student[] = [];

            if (manifestSnap.exists()) {
                // CHUNKED STRATEGY
                const manifest = manifestSnap.data() as any;
                const totalChunks = manifest?.totalChunks || 0;
                console.log(`[Firebase] 📦 Found student manifest with ${totalChunks} chunks.`);

                // Fetch all chunks in parallel
                const chunkPromises = [];
                for (let i = 0; i < totalChunks; i++) {
                    const chunkRef = doc(db, "schools", docId, "config", `student_bucket_${i}`);
                    chunkPromises.push(loggedGetDoc(chunkRef, `fetchStudents/chunk_${i}/${docId}`));
                }

                trackFirebaseRead('fetchStudents', 'config', totalChunks, `Fetching ${totalChunks} student chunks`);
                const chunkSnaps = await Promise.all(chunkPromises);

                chunkSnaps.forEach(snap => {
                    if (snap.exists()) {
                        const data = snap.data();
                        if (data?.students) {
                            allStudents = allStudents.concat(data.students as Student[]);
                        }
                    }
                });

                console.log(`[Firebase] ✅ Reassembled ${allStudents.length} students from chunks.`);

            } else {
                // BACKWARD COMPATIBILITY: Check for old single bucket
                const oldBucketRef = doc(db, "schools", docId, "config", "student_bucket");
                const oldBucketSnap = await loggedGetDoc(oldBucketRef, `fetchStudents/oldBucket/${docId}`);
                if (oldBucketSnap.exists()) {
                    const data = oldBucketSnap.data() as any;
                    if (data.studentsMap) {
                        allStudents = Object.values(data.studentsMap) as Student[];
                        console.log(`[Firebase] ⚠️ Found legacy single student bucket (${allStudents.length} students). Consider migrating.`);
                    }
                }
            }

            if (allStudents.length > 0) {
                // If pagination requested, apply it in-memory
                if (pageSize && pageSize > 0) {
                    const startIdx = lastVisible ? allStudents.findIndex(s => s.id === (lastVisible as any).id) + 1 : 0;
                    const page = allStudents.slice(startIdx, startIdx + pageSize);
                    const lastDoc = page.length > 0 ? page[page.length - 1] : null;
                    return { students: page, lastDoc: lastDoc as any };
                }
                return { students: allStudents, lastDoc: null };
            }

        } catch (e) {
            console.warn("Error fetching student bucket:", e);
        }


        // 2. Fallback: Fetch legacy individual student documents if bucket missing/empty
        try {
            const studentsRef = collection(db, "schools", docId, "students");
            let q = query(studentsRef, orderBy("name"), limit(pageSize));

            if (lastVisible) {
                q = query(studentsRef, orderBy("name"), startAfter(lastVisible), limit(pageSize));
            }

            trackFirebaseRead('fetchStudents (fallback)', 'students', 0, 'Student bucket missing, reading subcollection');
            const snapshot = await loggedGetDocs(q, `fetchStudents/fallback/${docId}`);
            trackFirebaseRead('fetchStudents (fallback)', 'students', snapshot.size, `Fallback fetched ${snapshot.size} students`);
            const students = snapshot.docs.map(d => d.data() as Student);
            const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;

            // -----------------------------------------------------------------
            // CRITICAL OPTIMIZATION: Auto-Migrate to Bucket
            // -----------------------------------------------------------------
            // If we had to read X documents, we MUST save them to the bucket 
            // so next time we only read 1 document.
            if (students.length > 0 && !lastVisible) { // Only migrate on initial load (full page 1)
                console.log(`[Firebase] ⚠️ Fallback triggered. Auto-creating 'student_bucket' with ${students.length} students to fix leak.`);

                // We fire and forget this promise so we don't block the UI
                updateStudentBucket(docId, students).catch(e => {
                    console.error('[Firebase] Failed to auto-migrate student bucket:', e);
                });
            }

            return { students, lastDoc };
        } catch (error) {
            console.error("Error fetching students:", error);
            return { students: [], lastDoc: null };
        }
    })();

    inflightStudentPromises.set(cacheKey, fetchPromise);
    try {
        return await fetchPromise;
    } finally {
        inflightStudentPromises.delete(cacheKey);
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
        const bucketSnap = await loggedGetDoc(bucketRef, `fetchScoresForClass/bucket_subject_${subjectId}`);

        if (bucketSnap.exists()) {
            const data = bucketSnap.data() as any;
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
        const snap = await loggedGetDocs(q, `fetchScoresForClass/fallback/${subjectId}`);
        trackFirebaseRead('fetchScoresForClass (fallback)', 'scores', snap.size, 'Fetched legacy scores');

        if (snap.size > 0) {
            console.warn(`[Firebase] ⚠️ PERF LEAK: Fetched ${snap.size} legacy scores for Subject ${subjectId}. These should be in a bucket!`);
        } else {
            console.log(`[Firebase] No legacy scores found for Subject ${subjectId} (Clean)`);
        }

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

// -----------------------------------------------------------------------------
// AUTHENTICATION & SCHOOL DISCOVERY
// -----------------------------------------------------------------------------

export interface SchoolListItem {
    docId: string;
    displayName: string;
    settings?: SchoolSettings;
    _databaseIndex?: number;
    access?: boolean; // Added to track lock status
}

export interface SchoolPeriod {
    year: string;
    term: string;
    docId: string;
}

/**
 * Fetches the list of all registered schools across ALL configured databases.
 * @param prefix Optional search prefix
 * @param includeLocked If true, includes schools with Access: false (default: false)
 */
export const getSchoolList = async (prefix?: string, includeLocked: boolean = false): Promise<SchoolListItem[]> => {
    const CACHE_KEY = prefix
        ? `cached_school_list_${prefix.toLowerCase()}_${includeLocked}`
        : `cached_school_list_${includeLocked}`;

    // 1. Try Memory Cache
    const cached = getCachedData<SchoolListItem[]>(CACHE_KEY);
    if (cached) {
        console.log(`[Firebase] Returning cached school list${prefix ? ` for "${prefix}"` : ''} (Locked: ${includeLocked})`);
        return cached;
    }

    // 2. Check for inflight promise (Clean Up: Prevent dual fetching)
    if (inflightSchoolListPromises.has(CACHE_KEY)) {
        console.log(`[Firebase] Returning inflight promise for school list: ${CACHE_KEY}`);
        return inflightSchoolListPromises.get(CACHE_KEY)!;
    }

    const fetchPromise = (async () => {
        try {
            console.log(`[Firebase] Fetching global school list from all databases${prefix ? ` (prefix: ${prefix})` : ''} (Locked: ${includeLocked})...`);
            trackFirebaseRead('global_discovery', 'schools', 0, prefix ? `Searching schools by prefix: ${prefix}` : 'General discovery');

            const allSchools: SchoolListItem[] = [];

            // EMULATOR OVERRIDE: Single Database Only
            if (isEmulator) {
                console.log('[Firebase] Emulator detected - Querying ONLY the current emulator instance.');
                const schoolsRef = collection(db, 'schools');
                const snapshot = await loggedGetDocs(schoolsRef, 'getSchoolList/emulator');
                const list = snapshot.docs
                    .map(doc => {
                        const data = doc.data() as any;
                        if (!includeLocked && data.Access === false) return null;
                        return {
                            docId: doc.id,
                            displayName: data.settings?.schoolName || data.schoolName || doc.id,
                            settings: data.settings,
                            _databaseIndex: 2,
                            access: data.Access // Capture access status
                        } as SchoolListItem;
                    })
                    // Filter nulls if any
                    .filter((s): s is SchoolListItem => s !== null)
                    .sort((a, b) => a.displayName.localeCompare(b.displayName));

                setCachedData(CACHE_KEY, list, 5 * 60 * 1000); // 5 min cache for discovery
                return list;
            }

            const promises = Object.entries(FIREBASE_CONFIGS).map(async ([indexStr, config]) => {
                const index = Number(indexStr);
                const appName = `temp_discovery_${index}_${Date.now()}`;

                let tempApp: any = null;
                try {
                    tempApp = initializeApp(config, appName);
                    const tempDb = getFirestore(tempApp);
                    const schoolsRef = collection(tempDb, 'schools');

                    let q;
                    if (prefix) {
                        // CRITICAL: Sanitize the search prefix to match documentId structure
                        const queryPrefix = sanitizeSchoolName(prefix);
                        q = query(schoolsRef, where(documentId(), '>=', queryPrefix), where(documentId(), '<=', queryPrefix + '\uf8ff'), limit(20));
                    } else {
                        q = query(schoolsRef, limit(500));
                    }

                    const snapshot = await loggedGetDocs(q, `getSchoolList/db${index}`);
                    const localList: SchoolListItem[] = [];
                    snapshot.forEach(doc => {
                        const data = doc.data() as any;
                        if (!includeLocked && data.Access === false) return; // Skip locked schools unless requested

                        localList.push({
                            docId: doc.id,
                            displayName: data.settings?.schoolName || data.schoolName || doc.id,
                            settings: data.settings,
                            _databaseIndex: index,
                            access: data.Access // Capture access status
                        });
                    });
                    return localList;
                } catch (e) {
                    console.warn(`[Firebase Discovery] Failed to query database ${index}:`, e);
                    return [];
                } finally {
                    if (tempApp) deleteApp(tempApp).catch(() => { });
                }
            });

            const results = await Promise.all(promises);
            results.forEach(list => allSchools.push(...list));

            // DEDUPLICATION & RESERVED FILTERING
            const schoolGroups = new Map<string, SchoolListItem[]>();
            const { SCHOOL_DATABASE_MAPPING } = await import('../constants');

            allSchools.forEach(item => {
                const normalizedName = item.displayName.trim().toLowerCase();
                if (!schoolGroups.has(normalizedName)) schoolGroups.set(normalizedName, []);
                schoolGroups.get(normalizedName)?.push(item);
            });

            const finalSchools: SchoolListItem[] = [];
            schoolGroups.forEach((items) => {
                if (items.length === 0) return;
                const referenceItem = items[0];
                const prefixStr = referenceItem.docId.split('_')[0].toLowerCase();
                const reservedIndex = SCHOOL_DATABASE_MAPPING[prefixStr];

                if (reservedIndex !== undefined) {
                    const validItem = items.find(i => i._databaseIndex === reservedIndex);
                    if (validItem) finalSchools.push(validItem);
                } else {
                    finalSchools.push(items[0]);
                }
            });

            finalSchools.sort((a, b) => a.displayName.localeCompare(b.displayName));
            setCachedData(CACHE_KEY, finalSchools, 5 * 60 * 1000);
            return finalSchools;
        } catch (e) {
            console.error("[Firebase] Global discovery failed:", e);
            return [];
        } finally {
            inflightSchoolListPromises.delete(CACHE_KEY);
        }
    })();

    inflightSchoolListPromises.set(CACHE_KEY, fetchPromise);
    return fetchPromise;
};

/**
 * Client-Side Subscription Activation
 * Performs writes directly to the target database without a service account.
 */
export const activateSchoolSubscriptionLocally = async (
    reference: string,
    schoolDetails: { id: string, name: string, dbIndex: number },
    tier: any
): Promise<any> => {
    const { id: schoolId, dbIndex } = schoolDetails;
    const baseName = schoolId.split('_')[0];

    // Determine target DB
    let targetDb = db;
    let tempApp: any = null;

    try {
        const { ACTIVE_DATABASE_INDEX } = await import('../constants');
        if (dbIndex !== ACTIVE_DATABASE_INDEX) {
            const config = FIREBASE_CONFIGS[dbIndex];
            if (!config) throw new Error(`Invalid database index: ${dbIndex}`);

            const appName = `temp_activate_${dbIndex}_${Date.now()}`;
            tempApp = initializeApp(config, appName);

            // AUTHENTICATION: Must be signed in to write to target DB
            const tempAuth = getAuth(tempApp);
            console.log(`[Activation] Signing into Database ${dbIndex} anonymously...`);
            await signInAnonymously(tempAuth);

            targetDb = getFirestore(tempApp);
            console.log(`[Activation] Switched to target Database ${dbIndex} (and authenticated).`);
        }

        // 1. Trial Eligibility Check
        const isTrial = reference.startsWith('FREE_');
        const subDocRef = doc(targetDb, 'subscriptions', baseName);
        const existingSub = await getDoc(subDocRef);

        if (isTrial && existingSub.exists()) {
            throw new Error('Trial Unavailable: A trial or subscription has already been activated for this school.');
        }

        // 2. Calculate Expiry
        const now = new Date();
        const expiryDate = new Date();
        const durationStr = (tier.duration || '1 Year').toLowerCase();

        if (durationStr.includes('week')) {
            const weeks = parseInt(durationStr) || 1;
            expiryDate.setDate(now.getDate() + (weeks * 7));
        } else if (durationStr.includes('month')) {
            const months = parseInt(durationStr) || 12;
            expiryDate.setMonth(now.getMonth() + months);
        } else if (durationStr.includes('year')) {
            const years = parseInt(durationStr) || 1;
            expiryDate.setFullYear(now.getFullYear() + years);
        } else {
            expiryDate.setFullYear(now.getFullYear() + 1);
        }

        // 3. Prepare Subscription
        const subscriptionData = {
            maxStudents: parseInt(tier.maxStudents),
            maxClass: parseInt(tier.maxClass),
            expiryDate: Timestamp.fromDate(expiryDate),
            lastActivated: Timestamp.now(),
            activationHash: isTrial ? 'TRIAL_ACTIVATION' : 'ONLINE_PAYMENT',
            planName: tier.name,
            paymentReference: reference
        };

        // 4. Batch Updates
        const batch = writeBatch(targetDb);

        // Write subscription
        batch.set(subDocRef, subscriptionData, { merge: true });

        // Update Access for all variants
        console.log(`[Activation] Searching for variants of ${baseName}...`);
        const schoolsRef = collection(targetDb, 'schools');
        // Range query to catch all variants (e.g. scol, scol_2024, scol_2025)
        const q = query(schoolsRef, where(documentId(), '>=', baseName), where(documentId(), '<=', baseName + '\uf8ff'));
        const snapshot = await getDocs(q);

        let variantsCount = 0;
        snapshot.forEach(d => {
            // Precise check: must match exactly or start with prefix + underscore
            if (d.id === baseName || d.id.startsWith(baseName + '_')) {
                batch.update(d.ref, { Access: true });
                variantsCount++;
            }
        });

        if (variantsCount === 0) {
            // Fallback: If no variants found (e.g. manual rename), update the specific schoolId provided
            batch.set(doc(targetDb, 'schools', schoolId), { Access: true }, { merge: true });
            variantsCount = 1;
        }

        await batch.commit();
        console.log(`[Activation] Success! ${baseName} activated on DB ${isEmulator ? 2 : dbIndex}. Variants: ${variantsCount}`);

        return {
            success: true,
            message: `Subscription successfully activated for ${baseName}.`,
            expiryDate,
            variantsActivated: variantsCount
        };

    } catch (error: any) {
        console.error('[Activation Local Error] Details:', {
            message: error.message,
            code: error.code,
            baseName,
            dbIndex,
            error
        });
        throw error;
    } finally {
        if (tempApp) {
            // Short delay to ensure batch commit propagates before deleting app
            setTimeout(() => deleteApp(tempApp).catch(() => { }), 2000);
        }
    }
};

/**
 * Get all available years and terms for a specific school (CACHED 1hr per school)
         * Read Cost: 1 list operation per school (only on cache miss)
         */
export const getSchoolYearsAndTerms = async (schoolName: string, databaseIndex?: number, docIdPrefix?: string): Promise<SchoolPeriod[]> => {
    // Include database index in cache key to prevent cross-database collisions
    const dbSuffix = databaseIndex !== undefined ? `_db${databaseIndex}` : '';
    const CACHE_KEY = `auth_periods_${sanitizeSchoolName(schoolName)}${dbSuffix}`;
    const TTL = 60 * 60 * 1000; // 1 hour

    // Try cache first
    const cached = getCachedData<SchoolPeriod[]>(CACHE_KEY);
    if (cached) {
        console.log(`[Auth] Using cached periods for ${schoolName}`);
        return cached;
    }

    // Check inflight (Clean Up: Prevent dual fetching)
    if (inflightPeriodPromises.has(CACHE_KEY)) {
        console.log(`[Auth] Returning inflight promise for periods: ${schoolName}`);
        return inflightPeriodPromises.get(CACHE_KEY)!;
    }

    const fetchPromise = (async () => {
        console.log(`[Auth] Fetching periods for ${schoolName}${databaseIndex !== undefined ? ` from DB ${databaseIndex}` : ''}...`);

        try {
            // Determine which database to query
            let targetDb = db;
            let tempApp: any = null;

            // If a specific database index is provided and it differs from active
            if (databaseIndex !== undefined && !isEmulator) { // Disable cross-db query in Emulator
                const { ACTIVE_DATABASE_INDEX } = await import('../constants');
                if (databaseIndex !== ACTIVE_DATABASE_INDEX) {
                    // Use temporary app to query different database
                    const config = FIREBASE_CONFIGS[databaseIndex];
                    if (!config) {
                        console.error(`[Auth] Invalid database index: ${databaseIndex}`);
                        return [];
                    }

                    const appName = `temp_periods_${databaseIndex}_${Date.now()}`;
                    tempApp = initializeApp(config, appName);
                    targetDb = getFirestore(tempApp);
                    console.log(`[Auth] Querying periods from Database ${databaseIndex} (temp app)`);
                }
            }

            const schoolsRef = collection(targetDb, 'schools');
            const sanitizedSchool = docIdPrefix || sanitizeSchoolName(schoolName);
            const q = query(schoolsRef, where(documentId(), '>=', sanitizedSchool), where(documentId(), '<=', sanitizedSchool + '\uf8ff'));

            trackFirebaseRead('getSchoolYearsAndTerms', 'schools', 0, `Fetching years/terms for pattern: ${sanitizedSchool}`);
            const snapshot = await loggedGetDocs(q, `getSchoolYearsAndTerms/${sanitizedSchool}`);
            trackFirebaseRead('getSchoolYearsAndTerms', 'schools', snapshot.size, `Fetched ${snapshot.size} potential term matches`);

            const periods: SchoolPeriod[] = [];

            snapshot.forEach(doc => {
                const data = doc.data() as any;
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

            // Clean up temp app if used
            if (tempApp) {
                await deleteApp(tempApp).catch(() => { });
            }

            // Sort by year (descending) then term
            periods.sort((a, b) => {
                const yearCompare = b.year.localeCompare(a.year);
                if (yearCompare !== 0) return yearCompare;
                return a.term.localeCompare(b.term);
            });

            setCachedData(CACHE_KEY, periods, TTL);
            console.log(`[Auth] Found ${periods.length} periods for ${schoolName}`);

            return periods;
        } catch (error) {
            console.error(`[Auth] Error fetching periods for ${schoolName}:`, error);
            return [];
        } finally {
            inflightPeriodPromises.delete(CACHE_KEY);
        }
    })();

    inflightPeriodPromises.set(CACHE_KEY, fetchPromise);
    return fetchPromise;
};

/**
 * Verify password for a school (Field-level read - only fetches password)
 * Also checks if the license is expired.
 * Read Cost: 2 document reads (school doc + subscription doc)
 */
export const verifySchoolPassword = async (docId: string, password: string): Promise<{ isValid: boolean, isExpired: boolean }> => {
    try {
        console.log(`[Auth] Verifying password and license for ${docId}...`);
        const docRef = doc(db, 'schools', docId);
        trackFirebaseRead('verifySchoolPassword', 'schools', 1, 'Verifying password');
        const docSnap = await loggedGetDoc(docRef, `verifySchoolPassword/${docId}`);

        if (!docSnap.exists()) {
            console.warn(`[Auth] School ${docId} not found`);
            return { isValid: false, isExpired: false };
        }

        const data = docSnap.data() as any;
        const storedPassword = data.password;

        if (!storedPassword) {
            console.warn(`[Auth] No password set for ${docId}`);
            return { isValid: false, isExpired: false };
        }

        const isValid = storedPassword === password;
        if (!isValid) {
            console.log(`[Auth] Password invalid`);
            return { isValid: false, isExpired: false };
        }

        // Password is valid, now check license
        const baseName = docId.split('_')[0].toLowerCase();
        const sanitizedBotId = 'sbaacademylive';

        if (isEmulator || baseName === sanitizedBotId) {
            console.log(`[Auth] Bypass detected (${isEmulator ? 'Emulator' : 'Bot School'}) - Bypassing license check for ${baseName}`);
            return { isValid: true, isExpired: false };
        }

        const subRef = doc(db, 'subscriptions', baseName);
        trackFirebaseRead('checkLicense', 'subscriptions', 1, 'Checking license status');
        const subSnap = await loggedGetDoc(subRef, `checkLicense/${baseName}`);

        if (!subSnap.exists()) {
            console.warn(`[Auth] License not found for ${baseName}`);
            return { isValid: true, isExpired: true }; // Missing license counts as expired/inactive
        }

        const subData = subSnap.data() as any;
        const expiryDate = subData.expiryDate?.toDate();
        const isExpired = !expiryDate || new Date() > expiryDate;

        console.log(`[Auth] License status for ${baseName}: ${isExpired ? 'EXPIRED' : 'ACTIVE'}`);

        return { isValid: true, isExpired };

    } catch (error) {
        console.error(`[Auth] Error verifying password/license:`, error);
        return { isValid: false, isExpired: false };
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
    callback: (data: any[]) => void,
    limitCount?: number
): Unsubscribe => {
    const colRef = collection(db, "schools", docId, resourceName);
    const q = limitCount ? query(colRef, limit(limitCount)) : colRef;

    return onSnapshot(q, (snapshot) => {
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
        const snapshot = await loggedGetDocs(colRef, `fetchSubcollection/${docId}/${resourceName}`);
        trackFirebaseRead('fetchSubcollection', resourceName, snapshot.size, `Fetched all ${resourceName}`);
        return snapshot.docs.map(d => d.data() as T);
    } catch (e) {
        console.error(`Error fetching ${resourceName}:`, e);
        return [];
    }
};

/**
 * Composite Storage Strategy: Metadata Bundling
 * 
 * Implements "Write-Double, Read-Smart" for metadata optimization.
 * - Tries to fetch a single metadata_bundle first (1 read for Classes, Subjects, Assessments)
 * - Falls back to individual reads if bundle doesn't exist (backward compatibility)
 * - Gracefully handles schools created before this optimization
 */
export const fetchMetadataBundle = async (schoolId: string) => {
    try {
        const bundleRef = doc(db, "schools", schoolId, "config", "metadata_bundle");
        trackFirebaseRead('fetchMetadataBundle', 'config', 0, 'Attempting bundle read');
        const bundleSnap = await loggedGetDoc(bundleRef, `fetchMetadataBundle/${schoolId}`);

        if (bundleSnap.exists()) {
            const bundleData = bundleSnap.data() as any;
            trackFirebaseRead('fetchMetadataBundle', 'config', 1, 'Loaded metadata via Composite Bundle (1 Read)');
            console.log("[Firebase] 📦 Loaded metadata via Composite Bundle (1 Read)");

            return {
                classes: (bundleData.classes || []) as Class[],
                subjects: (bundleData.subjects || []) as Subject[],
                assessments: (bundleData.assessments || []) as Assessment[]
            };
        }

        // Fallback: Perform the 3 separate reads if bundle is missing
        console.log("[Firebase] ⚠️ Bundle missing, falling back to individual reads");
        trackFirebaseRead('fetchMetadataBundle_fallback', 'classes', 0, 'Bundle missing - fetching classes');
        trackFirebaseRead('fetchMetadataBundle_fallback', 'subjects', 0, 'Bundle missing - fetching subjects');
        trackFirebaseRead('fetchMetadataBundle_fallback', 'assessments', 0, 'Bundle missing - fetching assessments');

        const [classes, subjects, assessments] = await Promise.all([
            fetchSubcollection<Class>(schoolId, "classes"),
            fetchSubcollection<Subject>(schoolId, "subjects"),
            fetchSubcollection<Assessment>(schoolId, "assessments")
        ]);

        trackFirebaseRead('fetchMetadataBundle_fallback', 'classes', classes.length, `Fallback fetched ${classes.length} classes`);
        trackFirebaseRead('fetchMetadataBundle_fallback', 'subjects', subjects.length, `Fallback fetched ${subjects.length} subjects`);
        trackFirebaseRead('fetchMetadataBundle_fallback', 'assessments', assessments.length, `Fallback fetched ${assessments.length} assessments`);

        return { classes, subjects, assessments };
    } catch (error) {
        console.error("[Firebase] Error fetching metadata bundle:", error);
        return { classes: [], subjects: [], assessments: [] };
    }
};

/**
 * Ensure metadata bundle exists/updated by aggregating classes/subjects/assessments
 * If arrays are provided in `options`, they are used; otherwise subcollections are read.
 */
export const updateMetadataBundle = async (schoolId: string, options?: { classes?: Class[]; subjects?: Subject[]; assessments?: Assessment[] }) => {
    try {
        const bundleRef = doc(db, "schools", schoolId, "config", "metadata_bundle");
        const bundleData: any = { lastUpdated: serverTimestamp() };

        if (options?.classes) {
            bundleData.classes = options.classes;
        } else {
            bundleData.classes = await fetchSubcollection<Class>(schoolId, 'classes');
        }

        if (options?.subjects) {
            bundleData.subjects = options.subjects;
        } else {
            bundleData.subjects = await fetchSubcollection<Subject>(schoolId, 'subjects');
        }

        if (options?.assessments) {
            bundleData.assessments = options.assessments;
        } else {
            bundleData.assessments = await fetchSubcollection<Assessment>(schoolId, 'assessments');
        }

        trackFirebaseWrite('updateMetadataBundle', 'config', `Writing metadata_bundle for ${schoolId}`);
        await loggedSetDoc(bundleRef, bundleData, { merge: true }, `updateMetadataBundle/${schoolId}`);
        console.log(`[Firebase] 📦 metadata_bundle updated for ${schoolId}`);
    } catch (error) {
        console.error('[Firebase] Failed to update metadata bundle:', error);
        throw error;
    }
};

/**
 * Update student bucket with current students array
 * If students array is provided, use it; otherwise fetch from subcollection.
 */
/**
 * Update student bucket with current students array (CHUNKED with RECURSIVE BACKOFF)
 * Splits students into multiple documents to avoid 1MB limit.
 * If a chunk is too large, it automatically splits smaller until Firestore accepts it.
 */
export const updateStudentBucket = async (schoolId: string, students?: Student[], initialChunkSize: number = 10000) => {
    try {
        const studentsToStore = students || (await fetchSubcollection<Student>(schoolId, 'students'));

        // Recursive helper function to write chunks with automatic backoff
        const writeChunksWithBackoff = async (
            studentsData: Student[],
            chunkSize: number,
            attempt: number = 1
        ): Promise<void> => {
            const totalChunks = Math.ceil(studentsData.length / chunkSize);

            console.log(`[Firebase] 🎓 Attempt ${attempt}: Bucketing ${studentsData.length} students into ${totalChunks} chunks (size: ${chunkSize})...`);

            const batch = writeBatch(db);

            // 1. Write Manifest
            const manifestRef = doc(db, "schools", schoolId, "config", "student_bucket_manifest");
            batch.set(manifestRef, {
                totalChunks,
                totalStudents: studentsData.length,
                lastUpdated: serverTimestamp(),
                chunkSize // Track the actual chunk size used
            });

            // 2. Write Chunks
            for (let i = 0; i < totalChunks; i++) {
                const chunk = studentsData.slice(i * chunkSize, (i + 1) * chunkSize);
                const chunkRef = doc(db, "schools", schoolId, "config", `student_bucket_${i}`);
                batch.set(chunkRef, { students: chunk });
            }

            try {
                trackFirebaseWrite('updateStudentBucket', 'config', `Writing ${totalChunks} student chunks for ${schoolId}`);
                await batch.commit();
                console.log(`[Firebase] ✅ Student bucket updated (${totalChunks} chunks, size: ${chunkSize})`);
            } catch (error: any) {
                // Check if error is due to document size
                const isSizeError = error?.message?.includes('size') &&
                    error?.message?.includes('exceeds the maximum allowed size');

                if (isSizeError && chunkSize > 1) {
                    // RECURSIVE BACKOFF: Split chunks in half and retry
                    const newChunkSize = Math.max(1, Math.floor(chunkSize / 2));
                    console.warn(`[Firebase] ⚠️ Chunk size ${chunkSize} too large. Retrying with size ${newChunkSize}...`);

                    // Recursively retry with smaller chunks
                    return writeChunksWithBackoff(studentsData, newChunkSize, attempt + 1);
                } else if (chunkSize === 1) {
                    // If we're down to 1 student per chunk and still failing, 
                    // we have a fundamental issue with individual student data
                    console.error(`[Firebase] ❌ CRITICAL: Even single-student chunks are too large. Individual student data exceeds 1MB.`);
                    throw new Error('Individual student record exceeds 1MB. Please compress student images further.');
                } else {
                    // Different error, rethrow
                    throw error;
                }
            }
        };

        // Start the recursive write process
        await writeChunksWithBackoff(studentsToStore, initialChunkSize);

    } catch (error) {
        console.error('[Firebase] Failed to update student bucket:', error);
        throw error;
    }
};

/**
 * Check if student bucket exists; if not but students do, create it
 * Called during login to catch schools that have students but no bucket yet
 */
export const ensureStudentBucketExists = async (schoolId: string, preloadedStudents?: Student[]) => {
    try {
        // Note: Bucket cleanup and image repair are now manual operations
        // accessible via the Firebase Analytics page

        // Check MANIFEST first (new strategy)
        const manifestRef = doc(db, "schools", schoolId, "config", "student_bucket_manifest");
        const manifestSnap = await loggedGetDoc(manifestRef, `ensureStudentBucketExists/${schoolId}`);

        if (!manifestSnap.exists()) {
            // Backward compatibility: Check if old single bucket exists, if so, we can consider it "exists" 
            // but strictly we should probably migrate it. For now, let's treat "missing manifest" as "needs migration".
            console.warn(`[Firebase] ⚠️ Student bucket manifest missing for ${schoolId}. Initiating auto-migration to chunks...`);



            let studentsToSave: Student[] = [];

            if (preloadedStudents && preloadedStudents.length > 0) {
                console.log(`[Firebase] 🚀 Using preloaded students for migration (${preloadedStudents.length} records).`);
                studentsToSave = preloadedStudents;
            } else {
                // Fallback: Fetch from subcollection (Costly but necessary for repair)
                console.log(`[Firebase] 🐢 Fetching students from subcollection for migration...`);
                const fetched = await fetchSubcollection<Student>(schoolId, 'students');
                if (fetched) studentsToSave = fetched;
            }

            if (studentsToSave.length > 0) {
                console.log(`[Firebase] 💾 Writing ${studentsToSave.length} students to new bucket...`);
                await updateStudentBucket(schoolId, studentsToSave);
                console.log(`[Firebase] ✅ Auto-migration complete. Student bucket created.`);
            }
        }
    } catch (error) {
        console.error('[Firebase] Error ensuring student bucket exists:', error);
        // Don't throw - this is a non-critical optimization
    }
};

/**
 * ONE-TIME REPAIR: Compress all student images for a school
 * This function fetches all students, compresses their images, and saves them back
 * Used to fix existing oversized images that cause document size errors
 */
export const repairDatabaseImages = async (schoolId: string): Promise<void> => {
    try {
        console.log(`[Image Repair] 🔧 Starting comprehensive image repair (ImgBB Migration) for ${schoolId}...`);

        // Dynamically import the upload utility
        const { uploadToImgBB, getBase64Size, formatBytes } = await import('../utils/imageUtils');

        const batch = writeBatch(db);
        let uploadedCount = 0;

        // 1. Repair Settings (Logo, Signatures)
        const settingsRef = doc(db, "schools", schoolId);
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
            const data = settingsSnap.data() as AppDataType;
            const settings = data.settings || {} as SchoolSettings;
            let settingsModified = false;

            // Check Logo
            if (settings.logo && settings.logo.startsWith('data:image')) {
                console.log(`[Image Repair] 📤 Uploading School Logo...`);
                const url = await uploadToImgBB(settings.logo);
                if (url) { settings.logo = url; settingsModified = true; uploadedCount++; }
            }
            // Check Headmaster Signature
            if (settings.headmasterSignature && settings.headmasterSignature.startsWith('data:image')) {
                console.log(`[Image Repair] 📤 Uploading Headmaster Signature...`);
                const url = await uploadToImgBB(settings.headmasterSignature);
                if (url) { settings.headmasterSignature = url; settingsModified = true; uploadedCount++; }
            }

            if (settingsModified) {
                batch.update(settingsRef, { settings: settings });
                console.log(`[Image Repair] ✅ Settings images queued for update.`);
            }
        }

        // 2. Repair Subjects (Signatures)
        const subjects = await fetchSubcollection<Subject>(schoolId, 'subjects');
        for (const subject of subjects) {
            if (subject.signature && subject.signature.startsWith('data:image')) {
                console.log(`[Image Repair] 📤 Uploading signature for Subject ${subject.subject}...`);
                const url = await uploadToImgBB(subject.signature);
                if (url) {
                    const ref = doc(db, "schools", schoolId, "subjects", String(subject.id));
                    batch.update(ref, { signature: url });
                    uploadedCount++;
                }
            }
        }

        // 3. Repair Classes (Teacher Signatures)
        const classes = await fetchSubcollection<Class>(schoolId, 'classes');
        for (const cls of classes) {
            if (cls.teacherSignature && cls.teacherSignature.startsWith('data:image')) {
                console.log(`[Image Repair] 📤 Uploading signature for Class ${cls.name}...`);
                const url = await uploadToImgBB(cls.teacherSignature);
                if (url) {
                    const ref = doc(db, "schools", schoolId, "classes", String(cls.id));
                    batch.update(ref, { teacherSignature: url });
                    uploadedCount++;
                }
            }
        }

        // 4. Repair Students (Photos, Images, Pictures)
        const students = await fetchSubcollection<Student>(schoolId, 'students');
        let studentsModified = false;
        let totalSize = 0;

        for (const student of students) {
            let modified = false;
            const studentCopy = { ...student };
            const studentSize = JSON.stringify(student).length;
            totalSize += studentSize;

            if (studentSize > 5000) {
                console.log(`[Image Repair] ⚠️ Large student record found: ${student.name} (${(studentSize / 1024).toFixed(2)} KB)`);
            }

            // Check aliases
            const fields = ['photo', 'image', 'picture'];
            for (const field of fields) {
                // @ts-ignore
                const val = student[field];

                // Check for base64 (starts with data:image OR is just a long string not starting with http)
                const isBase64 = val && typeof val === 'string' && (
                    val.startsWith('data:image') ||
                    (val.length > 500 && !val.startsWith('http'))
                );

                if (isBase64) {
                    // If it's raw base64 without prefix, we might need to add it for uploadToImgBB to work?
                    // But uploadToImgBB might handle it. Let's check. 
                    // Actually, let's just try to upload it.

                    console.log(`[Image Repair] 📤 Uploading student ${field} for ${student.name}...`);
                    const url = await uploadToImgBB(val);
                    if (url) {
                        // @ts-ignore
                        studentCopy[field] = url;
                        modified = true;
                        uploadedCount++;
                    } else {
                        console.error(`[Image Repair] ❌ Failed to upload ${field} for ${student.name}`);
                    }
                }
            }

            if (modified) {
                const ref = doc(db, "schools", schoolId, "students", String(student.id));
                batch.set(ref, sanitizeForFirestore(studentCopy), { merge: true });

                // Update local array for bucketing
                const idx = students.findIndex(s => s.id === student.id);
                if (idx !== -1) students[idx] = studentCopy;
                studentsModified = true;
            }
        }

        console.log(`[Image Repair] 📊 Total Students Size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`[Image Repair] 📊 Avg Student Size: ${(totalSize / students.length / 1024).toFixed(2)} KB`);

        if (uploadedCount > 0) {
            console.log(`[Image Repair] 💾 Committing ${uploadedCount} image migrations...`);
            trackFirebaseWrite('repairDatabaseImages', 'multi', `Migrated ${uploadedCount} images to ImgBB`);
            await batch.commit();
            console.log(`[Image Repair] ✅ Migration complete.`);
        } else {
            console.log(`[Image Repair] ✅ No images needing migration found.`);
        }

        // Always ensure bucket is healthy with chunk size 10000
        console.log(`[Image Repair] 🔄 Rebuilding student buckets with chunk size 10000...`);
        await updateStudentBucket(schoolId, students, 10000);

        // 5. Repair Metadata Bundle (Classes, Subjects, Assessments cached copy)
        console.log(`[Image Repair] 📦 Repairing metadata_bundle...`);
        const bundleRef = doc(db, "schools", schoolId, "config", "metadata_bundle");
        const bundleSnap = await getDoc(bundleRef);

        if (bundleSnap.exists()) {
            const bundleData = bundleSnap.data() as any;
            let bundleModified = false;

            // Process subjects in bundle
            if (bundleData.subjects && Array.isArray(bundleData.subjects)) {
                for (const subject of bundleData.subjects) {
                    if (subject.signature && subject.signature.startsWith('data:image')) {
                        console.log(`[Image Repair] 📤 Uploading bundle subject signature for ${subject.subject}...`);
                        const url = await uploadToImgBB(subject.signature);
                        if (url) {
                            subject.signature = url;
                            bundleModified = true;
                        }
                    }
                }
            }

            // Process classes in bundle
            if (bundleData.classes && Array.isArray(bundleData.classes)) {
                for (const cls of bundleData.classes) {
                    if (cls.teacherSignature && cls.teacherSignature.startsWith('data:image')) {
                        console.log(`[Image Repair] 📤 Uploading bundle class signature for ${cls.name}...`);
                        const url = await uploadToImgBB(cls.teacherSignature);
                        if (url) {
                            cls.teacherSignature = url;
                            bundleModified = true;
                        }
                    }
                }
            }

            if (bundleModified) {
                await loggedUpdateDoc(bundleRef, bundleData, 'repairDatabaseImages/metadata_bundle');
                console.log(`[Image Repair] ✅ Metadata bundle repaired.`);
            } else {
                console.log(`[Image Repair] ✅ Metadata bundle already clean.`);
            }
        }

        // 6. Repair Score Buckets (Migrate Legacy Scores)
        console.log(`[Image Repair] 🍱 Checking for legacy scores to bucket...`);
        let bucketsCreated = 0;

        for (const subject of subjects) {
            // Check if bucket already exists
            const bucketRef = doc(db, "schools", schoolId, "score_buckets", `subject_${subject.id}`);
            const bucketSnap = await loggedGetDoc(bucketRef, `repairScores/${subject.id}`);

            if (!bucketSnap.exists()) {
                // Query legacy scores
                const scoresRef = collection(db, "schools", schoolId, "scores");
                const q = query(scoresRef, where("subjectId", "==", subject.id));
                const snap = await loggedGetDocs(q, `repairScores/legacy/${subject.id}`);

                if (snap.size > 0) {
                    console.log(`[Image Repair] ⚠️ Found ${snap.size} legacy scores for ${subject.subject}. Creating bucket...`);
                    const scoresMap: Record<string, any> = {};
                    snap.forEach(d => {
                        scoresMap[d.id] = d.data();
                    });

                    await loggedSetDoc(bucketRef, { scoresMap }, { merge: true }, `repairScores/createBucket/${subject.id}`);
                    bucketsCreated++;
                    console.log(`[Image Repair] ✅ Created bucket for Subject ${subject.id}`);
                }
            }
        }

        if (bucketsCreated > 0) {
            console.log(`[Image Repair] ✅ Created ${bucketsCreated} score buckets from legacy data.`);
        } else {
            console.log(`[Image Repair] ✅ Score buckets are up to date.`);
        }

    } catch (error) {
        console.error('[Image Repair] ❌ Error:', error);
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
    // -------------------------------------------------------------------------
    // AUTO-UPLOAD INTERCEPTOR (ImgBB)
    // -------------------------------------------------------------------------
    // Check for base64 images in updates and upload them to ImgBB before saving
    try {
        const { uploadToImgBB } = await import('../utils/imageUtils');

        const processFields = async (obj: any, fields: string[]) => {
            if (!obj) return;
            for (const field of fields) {
                if (obj[field] && typeof obj[field] === 'string' && obj[field].startsWith('data:image')) {
                    console.log(`[Auto-Upload] 📤 Intercepted base64 for ${field}. Uploading to ImgBB...`);
                    const url = await uploadToImgBB(obj[field]);
                    if (url) {
                        obj[field] = url;
                        console.log(`[Auto-Upload] ✅ Replaced ${field} with URL.`);
                    }
                }
            }
        };

        // 1. Settings (Logo, Signature)
        if (updates.settings) {
            await processFields(updates.settings, ['logo', 'headmasterSignature']);
        }

        // 2. Subjects (Signature)
        if (updates.subjects && Array.isArray(updates.subjects)) {
            for (const subject of updates.subjects) {
                await processFields(subject, ['signature']);
            }
        }

        // 3. Classes (Teacher Signature)
        if (updates.classes && Array.isArray(updates.classes)) {
            for (const cls of updates.classes) {
                await processFields(cls, ['teacherSignature']);
            }
        }

        // 4. Students (Photos, Images)
        if (updates.students && Array.isArray(updates.students)) {
            for (const student of updates.students) {
                await processFields(student, ['photo', 'image', 'picture']);
            }
        }

    } catch (err) {
        console.error('[Auto-Upload] ⚠️ Failed to auto-upload images in transaction (proceeding with base64):', err);
    }

    // Helper to manage batches
    const executeBatch = async (operations: ((batch: WriteBatch) => void)[]) => {
        const BATCH_SIZE = 450; // Safety margin below 500

        // DEBUG: Check auth state before batch
        const currentUser = auth.currentUser;
        console.log(`[Firebase] Batch Save Starting. Auth UID: ${currentUser?.uid || 'NONE (Unauthenticated)'}`);

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
        const MAIN_KEYS = ['settings', 'userLogs', 'activeSessions', 'access', 'password', 'users'];

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
        const hasStudentUpdates = updates.students && Array.isArray(updates.students) && updates.students.length > 0;

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

        // --- COMPOSITE STORAGE: Write Metadata Bundle (if metadata updated) ---
        // This implements "Write-Double" strategy: Update both individual collections AND the bundle
        const METADATA_KEYS = ['classes', 'subjects', 'assessments'];
        const hasMetadataUpdates = Object.keys(updates).some(key => METADATA_KEYS.includes(key));

        if (hasMetadataUpdates) {
            // ... (Metadata bundle logic remains)
            console.log(`[Optimization] 📦 Updating metadata bundle for composite storage...`);

            // Collect current/updated metadata
            const bundleData: any = {
                lastUpdated: serverTimestamp()
            };

            // Only include in bundle if actually being updated
            if (updates.classes) {
                bundleData.classes = updates.classes;
            }
            if (updates.subjects) {
                bundleData.subjects = updates.subjects;
            }
            if (updates.assessments) {
                bundleData.assessments = updates.assessments;
            }

            const bundleRef = doc(db, "schools", docId, "config", "metadata_bundle");
            operations.push((batch) => batch.set(bundleRef, bundleData, { merge: true }));
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
            const metadata: Record<string, any> = {};
            Object.keys(updates).forEach(key => {
                metadata[`metadata.lastUpdated.${key}`] = serverTimestamp();
            });

            operations.push((batch) => batch.set(docRef, {
                ...sanitizeForFirestore(mainUpdates),
                ...metadata
            }, { merge: true }));
        } else if (Object.keys(updates).length > 0) {
            const docRef = doc(db, "schools", docId);
            const metadata: Record<string, any> = {};
            Object.keys(updates).forEach(key => {
                metadata[`metadata.lastUpdated.${key}`] = serverTimestamp();
            });
            operations.push((batch) => batch.update(docRef, metadata));
        }

        if (operations.length > 0) {
            trackFirebaseWrite('saveDataTransaction', 'multi', `Saving batch of ${operations.length} operations`);
            await executeBatch(operations);
        }

        // ---------------------------------------------------------------------
        // POST-TRANSACTION: REBUILD STUDENT BUCKET (CHUNKS)
        // ---------------------------------------------------------------------
        // Since we cannot easily "merge" into chunks atomically, we trigger
        // a bucket rebuild if students were modified. This reads the full list
        // and re-chunks it.
        if (hasStudentUpdates) {
            console.log(`[Optimization] 🔄 Student changes detected. Rebuilding bucket chunks...`);
            // We await this to ensure consistency before returning
            // Note: using no-args to force fetch from subcollection (Source of Truth)
            await updateStudentBucket(docId);
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
        const docSnap = await loggedGetDoc(docRef, `logUserActivity/${docId}`);
        if (docSnap.exists()) {
            const data = docSnap.data() as any;
            const logs = data.userLogs || [];
            logs.push(log);
            if (logs.length > 20) logs.splice(0, logs.length - 20); // Strict Prune
            await loggedUpdateDoc(docRef, { userLogs: logs }, `logUserActivity/update/${docId}`);
        }
    } catch (e) { console.error("Log error", e); }
}, 3000);

export const updateHeartbeat = debounce(async (docId: string, userId: number) => {
    try {
        const docRef = doc(db, "schools", docId);
        await loggedUpdateDoc(docRef, {
            [`activeSessions.${userId}`]: new Date().toISOString()
        }, `updateHeartbeat/${docId}/${userId}`);
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

    const [snap1, snap2] = await Promise.all([loggedGetDocs(q1, `searchSchools/q1/${sanitizedInput}`), loggedGetDocs(q2, `searchSchools/q2/${capitalizedInput}`)]);
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

    // OPTIMIZATION: Also create the student bucket if students are provided
    if (data.students && data.students.length > 0) {
        console.log(`[Firebase] Creating student bucket during term initialization...`);
        await updateStudentBucket(docId, data.students).catch(e => {
            console.error('[Firebase] Warning: Failed to create student bucket during init (non-critical)', e);
        });
    }
};

export const loginOrRegisterSchool = async (docId: string, password: string, initialData: AppDataType, createIfMissing: boolean = false, targetDatabaseIndex?: number): Promise<{ status: string; data?: AppDataType; message?: string; docId?: string; subscription?: any }> => {
    // 1. OPTIMIZATION: Check Inflight Promises FIRST to prevent double-reads (Race Condition Fix)
    const cacheKey = `${docId}_${createIfMissing}`;
    if (inflightLoginPromises.has(cacheKey)) {
        console.log(`[Firebase] 🛡️ Returning inflight promise for login/register: ${docId}`);
        return inflightLoginPromises.get(cacheKey);
    }

    const loginPromise = (async () => {
        // ... Original Function Body ...

        // 1. OPTIMIZATION: Check Inflight Promises FIRST to prevent double-reads (Race Condition Fix)
        if (inflightSchoolPromises.has(docId)) {
            console.log(`[Firebase] 🛡️ Returning inflight promise for school login: ${docId}`);
            // We cast the result to match the expected return type of loginOrRegisterSchool
            // Note: inflightSchoolPromises stores Promise<AppDataType | null>, but we need a complex object here.
            // This is a bit tricky. The inflight promise is for *fetching data*, not the whole login flow.
            // However, if we are just *fetching* (createIfMissing=false), we can piggyback.
            // If we are creating, we probably shouldn't dedup against a fetch.

            // Let's rely on a separate map for login operations if needed, or just guard the fetch part.
            // actually, let's look at how the fetch is done inside. 
        }

        // Better strategy: We can't easily reuse `inflightSchoolPromises` here because return types differ.
        // But we CAN wrap the execution in a new map or variable if we want to dedup login specifically.
        // For now, let's just proceed to the fetch part and ensure *that* uses the dedup logic.

        // WAIT: The user said "loginOrRegisterSchool called ... Fetching document...".
        // The "Fetching document" part SHOULD be using `loggedGetDoc` which doesn't dedup by default? 
        // No, `loggedGetDoc` is just a wrapper for `getDoc` with analytics.

        // We should implement specific dedup for this function or the underlying fetch.

        // Let's implement a specific dedupe for loginOrRegisterSchool based on docId.
        const CACHE_KEY = `login_${docId}`;
        // We need a module-level variable for this. I'll add it to the top of the file in a separate step or assume I can add it here.
        // For now, let's just check the existing `inflightSchoolPromises` map which is exposed in this file.

        // Actually, looking at the logs:
        // [FIREBASE_DEBUG] loginOrRegisterSchool called...
        // [FIREBASE_DEBUG] Fetching document...

        // If I add a check here, I need to store the promise.
        // -------------------------------------------------------------------------
        // CROSS-DATABASE HELPER (For registration primarily)
        // -------------------------------------------------------------------------
        if (typeof targetDatabaseIndex === 'number' && !isEmulator) {
            const { ACTIVE_DATABASE_INDEX } = await import('../constants');
            if (targetDatabaseIndex !== ACTIVE_DATABASE_INDEX) {
                console.log(`[Firebase] Cross-database operation detected. Target: ${targetDatabaseIndex}, Active: ${ACTIVE_DATABASE_INDEX}`);

                const config = FIREBASE_CONFIGS[targetDatabaseIndex];
                if (!config) return { status: 'error', message: 'Invalid database configuration' };

                const appName = `temp_reg_${targetDatabaseIndex}_${Date.now()}`;
                // @ts-ignore - InitializeApp is valid
                const tempApp = initializeApp(config, appName);
                const tempDb = getFirestore(tempApp);

                try {
                    const docRef = doc(tempDb, "schools", docId);
                    const docSnap = await loggedGetDoc(docRef, `loginOrRegisterSchool_tempDb/${targetDatabaseIndex}/${docId}`);

                    if (docSnap.exists()) {
                        const data = docSnap.data() as AppDataType;
                        if (data.password !== password) return { status: 'wrong_password' };
                        // Fetch subscription for existing school in other DB
                        const subRef = doc(tempDb, 'subscriptions', docId.split('_')[0]);
                        const subSnap = await loggedGetDoc(subRef, `loginOrRegisterSchool_tempDb_sub/${targetDatabaseIndex}/${docId}`);
                        const subscription = subSnap.exists() ? subSnap.data() : null;
                        // Return success with data, but caller (AuthOverlay) will initiate the DB switch
                        return { status: 'success', data: data, docId, subscription };
                    } else {
                        if (!createIfMissing) return { status: 'not_found' };

                        console.log(`[Firebase] Creating new school on Database ${targetDatabaseIndex}...`);
                        const newData = { ...initialData, password, Access: initialData.Access ?? false };
                        await setDoc(docRef, newData);

                        if (newData.Access === true) {
                            const subRef = doc(tempDb, 'subscriptions', docId.split('_')[0]);
                            const subSnap = await loggedGetDoc(subRef, `loginOrRegisterSchool_tempDb_sub/${targetDatabaseIndex}/${docId}`);
                            const subscription = subSnap.exists() ? subSnap.data() : null;
                            return { status: 'success', data: newData, docId: docId, subscription };
                        } else {
                            return { status: 'created_pending_access' };
                        }
                    }
                } catch (e: any) {
                    console.error('[Firebase] Cross-db error:', e);
                    return { status: 'error', message: e.message };
                } finally {
                    await deleteApp(tempApp).catch((_: any) => { });
                }
            }
        }

        console.log(`[FIREBASE_DEBUG] loginOrRegisterSchool called for docId: ${docId}, createIfMissing: ${createIfMissing}`);
        try {
            let targetDocId = docId;
            let docRef = doc(db, "schools", targetDocId);

            console.log(`[FIREBASE_DEBUG] Fetching document: schools/${targetDocId}`);
            trackFirebaseRead('loginOrRegisterSchool', 'schools', 1, `Checking school existence: ${targetDocId}`);
            let docSnap = await loggedGetDoc(docRef, `loginOrRegisterSchool/${targetDocId}`);
            console.log(`[FIREBASE_DEBUG] Document exists? ${docSnap.exists()}`);

            if (!docSnap.exists()) {
                console.log(`[FIREBASE_DEBUG] Document not found. Attempting case-insensitive fallback search...`);
                // Case-insensitive fallback
                const schoolsRef = collection(db, "schools");
                const q = query(schoolsRef, where(documentId(), '>=', targetDocId.toLowerCase()), limit(5)); // Optimize fallback
                trackFirebaseRead('loginOrRegisterSchool (fallback)', 'schools', 5, 'Fallback case-insensitive search');
                const snap = await loggedGetDocs(q, `loginOrRegisterSchool/fallback/${targetDocId}`);
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

                // Dev/Emulator Bypass
                // @ts-ignore
                const isDev = import.meta.env.DEV || import.meta.env.VITE_USE_EMULATOR === 'true';

                if (data.password !== password && !(isDev && password === 'devadmin')) {
                    console.warn(`[FIREBASE_DEBUG] Password mismatch.`);
                    return { status: 'wrong_password' };
                }
                if (data.Access === false) {
                    console.warn(`[FIREBASE_DEBUG] Access denied (Access flag is false).`);
                    return { status: 'access_denied' };
                }

                // LICENSE CHECK: Only check license for existing schools
                // EMULATOR & BOT BYPASS
                const sanitizedBotId = 'sbaacademylive';
                const baseName = targetDocId.split('_')[0].toLowerCase();

                if (isEmulator || baseName === sanitizedBotId) {
                    console.log(`[FIREBASE_DEBUG] Bypass detected (${isEmulator ? 'Emulator' : 'Bot School'}) - Bypassing license check.`);
                } else {
                    const subRef = doc(db, 'subscriptions', baseName);
                    trackFirebaseRead('loginOrRegisterSchool (license)', 'subscriptions', 1, 'Checking license status');
                    const subSnap = await loggedGetDoc(subRef, `loginOrRegisterSchool_license/${baseName}`);

                    if (!subSnap.exists()) {
                        console.warn(`[FIREBASE_DEBUG] License record for ${baseName} missing.`);
                        return { status: 'expired', message: 'No active license found for this school.' };
                    }

                    const subData = subSnap.data() as any;
                    const expiryDate = subData.expiryDate?.toDate();
                    if (!expiryDate || new Date() > expiryDate) {
                        console.warn(`[FIREBASE_DEBUG] School license has expired.`);
                        return { status: 'expired', message: 'Your school license has expired. Please use the License Management Portal to renew.' };
                    }
                }

                const subRef = doc(db, 'subscriptions', baseName);
                const subSnap = await loggedGetDoc(subRef, `loginOrRegisterSchool_sub/${baseName}`);
                const subscription = subSnap.exists() ? (subSnap.data() as any) : null;

                console.log(`[FIREBASE_DEBUG] Login successful. Returning data.`);

                // OPTIMIZATION: Ensure student bucket exists (create if missing but students exist)
                ensureStudentBucketExists(targetDocId).catch(e => {
                    console.error('[Firebase] Non-critical: Failed to ensure student bucket on login', e);
                });

                // OPTIMIZATION: Return ONLY main data. Do not fan-in.
                // STRIP LEGACY DATA: Same as getSchoolData
                if (data.students) delete data.students;
                if (data.scores) delete data.scores;
                if (data.classes) delete data.classes;
                if (data.subjects) delete data.subjects;
                if (data.assessments) delete data.assessments;

                console.log(`[FIREBASE_DEBUG] Login successful. Returning data.`);

                return { status: 'success', data: data, docId: targetDocId, subscription };
            } else {
                if (!createIfMissing) {
                    console.log(`[FIREBASE_DEBUG] Document not found and createIfMissing is false.`);
                    return { status: 'not_found' };
                }
                console.log(`[FIREBASE_DEBUG] Creating new school document: ${docId}`);
                // Respect Access from initialData (allows debug mode to set Access: true)
                const newData = { ...initialData, password, Access: initialData.Access ?? false };
                await loggedSetDoc(doc(db, "schools", docId), newData, undefined, `loginOrRegisterSchool/create/${docId}`);

                // If Access is true, return success (debug mode). Otherwise, pending.
                if (newData.Access === true) {
                    console.log(`[FIREBASE_DEBUG] New document created with Access=true. Returning 'success'.`);
                    const subRef = doc(db, 'subscriptions', docId.split('_')[0]);
                    const subSnap = await loggedGetDoc(subRef, `loginOrRegisterSchool_create_sub/${docId}`);
                    const subscription = subSnap.exists() ? subSnap.data() : null;
                    return { status: 'success', data: newData, docId: docId, subscription };
                } else {
                    console.log(`[FIREBASE_DEBUG] New document created with Access=false. Returning 'created_pending_access'.`);
                    return { status: 'created_pending_access' };
                }
            }
        } catch (e: any) {
            console.error(`[FIREBASE_DEBUG] Error in loginOrRegisterSchool:`, e);
            return { status: 'error', message: e.message };
        } finally {
            // Ensure we remove the promise from the cache when done (success or error)
            inflightLoginPromises.delete(cacheKey);
        }
    })();

    inflightLoginPromises.set(cacheKey, loginPromise);
    return loginPromise;
};

// ... User Management (updateUsers, updateDeviceCredentials, getUserById) same as before but minimal ...

export const updateUsers = async (docId: string, users: User[]) => {
    const docRef = doc(db, "schools", docId);
    await loggedSetDoc(docRef, { users }, { merge: true }, `updateUsers/${docId}`);
};

export const getUserById = async (docId: string, userId: number): Promise<User | null> => {
    const docRef = doc(db, "schools", docId);
    const docSnap = await loggedGetDoc(docRef, `getUserById/${docId}`);
    if (docSnap.exists()) {
        const data = docSnap.data() as AppDataType;
        return data.users?.find(u => u.id === userId) || null;
    }
    return null;
};

export const updateDeviceCredentials = async (docId: string, deviceCredentials: DeviceCredential[]) => {
    const docRef = doc(db, "schools", docId);
    await loggedSetDoc(docRef, { deviceCredentials }, { merge: true }, `updateDeviceCredentials/${docId}`);
};

/**
 * Fetch School History (All Terms)
 */
/**
 * Fetch School History (All Terms) - Legacy / Bulk
 */
export const getSchoolHistory = async (schoolNamePrefix: string): Promise<AppDataType[]> => {
    // Re-use the new granular functions to maintain DRY
    try {
        const termIds = await getSchoolTermIds(schoolNamePrefix);
        const data: AppDataType[] = [];
        for (const termId of termIds) {
            const termData = await getSchoolTermData(termId);
            if (termData) data.push(termData);
        }
        return data;
    } catch (e) {
        console.error("Error in getSchoolHistory:", e);
        return [];
    }
};

/**
 * 1. Fetch List of Historical Term IDs (Lightweight)
 */
export const getSchoolTermIds = async (schoolNamePrefix: string): Promise<string[]> => {
    try {
        const schoolsRef = collection(db, "schools");
        const q = query(schoolsRef,
            where(documentId(), '>=', schoolNamePrefix),
            where(documentId(), '<=', schoolNamePrefix + '\uf8ff')
        );
        trackFirebaseRead('getSchoolTermIds', 'schools', 0, 'Fetching school history list');
        const snapshot = await loggedGetDocs(q, `getSchoolHistory/list/${schoolNamePrefix}`);
        trackFirebaseRead('getSchoolTermIds', 'schools', snapshot.size, 'Fetched school history list');

        console.log(`[getSchoolTermIds] Found ${snapshot.size} historical terms for ${schoolNamePrefix}`);
        return snapshot.docs.map(d => d.id);
    } catch (error) {
        console.error("Error fetching school term IDs:", error);
        return [];
    }
};

/**
 * 2. Fetch Single Term Data (Detail)
 */
export const getSchoolTermData = async (docId: string): Promise<AppDataType | null> => {
    try {
        // Check Cache (Optional: implement granular cache or keep global?)
        // For now, simple fetch
        const docRef = doc(db, "schools", docId);
        const docSnap = await loggedGetDoc(docRef, `getSchoolTermData/${docId}`);

        if (!docSnap.exists()) return null;

        const mainData = docSnap.data() as AppDataType;
        console.log(`[getSchoolTermData] Processing term: ${docId}`);

        // Parallelize subcollection fetches for this specific term
        const [studentsSnap, subjectsSnap, classesSnap, assessmentsSnap, scoreBucketsSnap, scoresLegacySnap] = await Promise.all([
            loggedGetDocs(collection(db, "schools", docId, "students"), `getSchoolHistory/students/${docId}`),
            loggedGetDocs(collection(db, "schools", docId, "subjects"), `getSchoolHistory/subjects/${docId}`),
            loggedGetDocs(collection(db, "schools", docId, "classes"), `getSchoolHistory/classes/${docId}`),
            loggedGetDocs(collection(db, "schools", docId, "assessments"), `getSchoolHistory/assessments/${docId}`),
            loggedGetDocs(collection(db, "schools", docId, "score_buckets"), `getSchoolHistory/score_buckets/${docId}`),
            loggedGetDocs(collection(db, "schools", docId, "scores"), `getSchoolHistory/scores/${docId}`)
        ]);

        const students = studentsSnap.docs.map(s => s.data() as Student);
        const subjects = subjectsSnap.docs.map(s => s.data() as Subject);
        const classes = classesSnap.docs.map(c => c.data() as Class);
        const assessments = assessmentsSnap.docs.map(a => a.data() as Assessment);

        // Extract scores from buckets
        const scores: Score[] = [];
        scoreBucketsSnap.docs.forEach(bucketDoc => {
            const bucketData = bucketDoc.data() as any;
            if (bucketData.scoresMap) {
                Object.values(bucketData.scoresMap).forEach((score: any) => scores.push(score as Score));
            }
        });

        // Fallback to legacy
        if (scores.length === 0 && scoresLegacySnap.size > 0) {
            scoresLegacySnap.docs.forEach(d => scores.push(d.data() as Score));
        }

        return {
            ...mainData,
            students,
            subjects,
            classes,
            assessments,
            scores
        };

    } catch (error) {
        console.error(`Error fetching data for term ${docId}:`, error);
        return null;
    }
};
