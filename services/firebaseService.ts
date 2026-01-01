import { initializeApp, deleteApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, signInAnonymously, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, collection, getDocs, onSnapshot, runTransaction, query, where, documentId, writeBatch, updateDoc, deleteField, Unsubscribe, limit, startAfter, orderBy, DocumentSnapshot, WriteBatch, serverTimestamp } from "firebase/firestore";
import type { SchoolSettings, Student, Subject, Class, Grade, Assessment, Score, ReportSpecificData, ClassSpecificData, User, DeviceCredential, UserLog, OnlineUser, AppDataType } from '../types';

// CACHE STORAGE
// @ts-ignore
const historyCache = new Map<string, { timestamp: number, data: AppDataType[] }>();
// @ts-ignore
const searchCache = new Map<string, { timestamp: number, results: any }>();
const inflightSchoolListPromises = new Map<string, Promise<SchoolListItem[]>>(); // CLEANUP: Prevent duplicate requests
const inflightSchoolPromises = new Map<string, Promise<AppDataType | null>>();
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

// In Emulator Mode, we ALWAYS use Index 2 (sba-pro-master-40f08) because that's what the Emulator is started with.
const targetIndex = isEmulator ? 2 : ACTIVE_DATABASE_INDEX;

const selectedConfig = FIREBASE_CONFIGS[targetIndex] || FIREBASE_CONFIGS[1];
console.log(`[Firebase] Initializing with Database Index: ${targetIndex} (${selectedConfig['projectId']}) ${isEmulator ? '[EMULATOR FORCED]' : ''}`);

const app = initializeApp(selectedConfig);
export const auth = getAuth(app);
const analytics = getAnalytics(app);
export const db = getFirestore(app);
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
    clearCache('cached_school_list'); // Clear new cache key too
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
    // 1. Check inflight (Clean Up: Prevent dual fetching)
    if (inflightSchoolPromises.has(docId)) {
        console.log(`[Firebase] Returning inflight promise for school data: ${docId}`);
        return inflightSchoolPromises.get(docId)!;
    }

    const fetchPromise = (async () => {
        try {
            const docRef = doc(db, "schools", docId);
            trackFirebaseRead('getSchoolData', 'schools', 1, 'Loading main school data');
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data() as AppDataType;
                // Note: Fan-in logic removed for performance. Subcollections fetched on-demand.
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

// -----------------------------------------------------------------------------
// AUTHENTICATION & SCHOOL DISCOVERY
// -----------------------------------------------------------------------------

export interface SchoolListItem {
    docId: string;
    displayName: string;
    settings?: SchoolSettings;
    _databaseIndex?: number;
}

export interface SchoolPeriod {
    year: string;
    term: string;
    docId: string;
}

/**
 * Fetches the list of all registered schools across ALL configured databases.
 */
export const getSchoolList = async (prefix?: string): Promise<SchoolListItem[]> => {
    const CACHE_KEY = prefix ? `cached_school_list_${prefix.toLowerCase()}` : 'cached_school_list';

    // 1. Try Memory Cache
    const cached = getCachedData<SchoolListItem[]>(CACHE_KEY);
    if (cached) {
        console.log(`[Firebase] Returning cached school list${prefix ? ` for "${prefix}"` : ''}`);
        return cached;
    }

    // 2. Check for inflight promise (Clean Up: Prevent dual fetching)
    if (inflightSchoolListPromises.has(CACHE_KEY)) {
        console.log(`[Firebase] Returning inflight promise for school list: ${CACHE_KEY}`);
        return inflightSchoolListPromises.get(CACHE_KEY)!;
    }

    const fetchPromise = (async () => {
        try {
            console.log(`[Firebase] Fetching global school list from all databases${prefix ? ` (prefix: ${prefix})` : ''}...`);
            trackFirebaseRead('global_discovery', 'schools', 0, prefix ? `Searching schools by prefix: ${prefix}` : 'General discovery');

            const allSchools: SchoolListItem[] = [];

            // EMULATOR OVERRIDE: Single Database Only
            if (isEmulator) {
                console.log('[Firebase] Emulator detected - Querying ONLY the current emulator instance.');
                const schoolsRef = collection(db, 'schools');
                const snapshot = await getDocs(schoolsRef);
                const list = snapshot.docs
                    .map(doc => {
                        const data = doc.data() as any;
                        if (data.Access === false) return null;
                        return {
                            docId: doc.id,
                            displayName: data.settings?.schoolName || data.schoolName || doc.id,
                            settings: data.settings,
                            _databaseIndex: 2
                        } as SchoolListItem;
                    })
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
                        q = query(schoolsRef, limit(20));
                    }

                    const snapshot = await getDocs(q);
                    const localList: SchoolListItem[] = [];
                    snapshot.forEach(doc => {
                        const data = doc.data() as any;
                        if (data.Access === false) return; // Skip locked schools if explicitly marked
                        localList.push({
                            docId: doc.id,
                            displayName: data.settings?.schoolName || data.schoolName || doc.id,
                            settings: data.settings,
                            _databaseIndex: index
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
            const snapshot = await getDocs(q);
            trackFirebaseRead('getSchoolYearsAndTerms', 'schools', snapshot.size, `Fetched ${snapshot.size} potential term matches`);

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
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            console.warn(`[Auth] School ${docId} not found`);
            return { isValid: false, isExpired: false };
        }

        const data = docSnap.data();
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
        const subSnap = await getDoc(subRef);

        if (!subSnap.exists()) {
            console.warn(`[Auth] License not found for ${baseName}`);
            return { isValid: true, isExpired: true }; // Missing license counts as expired/inactive
        }

        const subData = subSnap.data();
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

            // --- METADATA TRACKING: Update lastUpdated for each modified key ---
            const metadata: Record<string, any> = {};
            Object.keys(updates).forEach(key => {
                metadata[`metadata.lastUpdated.${key}`] = serverTimestamp();
            });

            operations.push((batch) => batch.set(docRef, {
                ...sanitizeForFirestore(mainUpdates),
                ...metadata
            }, { merge: true }));
        } else if (Object.keys(updates).length > 0) {
            // Even if no main fields updated, update metadata for subcollections
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

export const loginOrRegisterSchool = async (docId: string, password: string, initialData: AppDataType, createIfMissing: boolean = false, targetDatabaseIndex?: number) => {

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
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data() as AppDataType;
                    if (data.password !== password) return { status: 'wrong_password' };
                    // Return success with data, but caller (AuthOverlay) will initiate the DB switch
                    return { status: 'success', data: data, docId };
                } else {
                    if (!createIfMissing) return { status: 'not_found' };

                    console.log(`[Firebase] Creating new school on Database ${targetDatabaseIndex}...`);
                    const newData = { ...initialData, password, Access: initialData.Access ?? false };
                    await setDoc(docRef, newData);

                    if (newData.Access === true) {
                        return { status: 'success', data: newData, docId };
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

            // LICENSE CHECK: Only check license for existing schools
            // EMULATOR & BOT BYPASS
            const sanitizedBotId = 'sbaacademylive';
            const baseName = targetDocId.split('_')[0].toLowerCase();

            if (isEmulator || baseName === sanitizedBotId) {
                console.log(`[FIREBASE_DEBUG] Bypass detected (${isEmulator ? 'Emulator' : 'Bot School'}) - Bypassing license check.`);
            } else {
                const subRef = doc(db, 'subscriptions', baseName);
                trackFirebaseRead('loginOrRegisterSchool (license)', 'subscriptions', 1, 'Checking license status');
                const subSnap = await getDoc(subRef);

                if (!subSnap.exists()) {
                    console.warn(`[FIREBASE_DEBUG] License record for ${baseName} missing.`);
                    return { status: 'expired', message: 'No active license found for this school.' };
                }

                const subData = subSnap.data();
                const expiryDate = subData.expiryDate?.toDate();
                if (!expiryDate || new Date() > expiryDate) {
                    console.warn(`[FIREBASE_DEBUG] School license has expired.`);
                    return { status: 'expired', message: 'Your school license has expired. Please use the License Management Portal to renew.' };
                }
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

        console.log(`[getSchoolHistory] Found ${snapshot.size} historical terms for ${schoolNamePrefix}`);

        // Fetch main documents and all subcollections
        const data: AppDataType[] = [];

        for (const docSnap of snapshot.docs) {
            const mainData = docSnap.data() as AppDataType;
            console.log(`[getSchoolHistory] Processing term: ${docSnap.id}`);

            // Fetch students subcollection
            const studentsRef = collection(db, "schools", docSnap.id, "students");
            trackFirebaseRead('getSchoolHistory', 'students', 0, `Fetching students for ${docSnap.id}`);
            const studentsSnapshot = await getDocs(studentsRef);
            trackFirebaseRead('getSchoolHistory', 'students', studentsSnapshot.size, `Fetched students for ${docSnap.id}`);
            const students = studentsSnapshot.docs.map(s => s.data() as Student);

            // Fetch subjects subcollection
            const subjectsRef = collection(db, "schools", docSnap.id, "subjects");
            trackFirebaseRead('getSchoolHistory', 'subjects', 0, `Fetching subjects for ${docSnap.id}`);
            const subjectsSnapshot = await getDocs(subjectsRef);
            trackFirebaseRead('getSchoolHistory', 'subjects', subjectsSnapshot.size, `Fetched subjects for ${docSnap.id}`);
            const subjects = subjectsSnapshot.docs.map(s => s.data() as Subject);

            // Fetch classes subcollection
            const classesRef = collection(db, "schools", docSnap.id, "classes");
            trackFirebaseRead('getSchoolHistory', 'classes', 0, `Fetching classes for ${docSnap.id}`);
            const classesSnapshot = await getDocs(classesRef);
            trackFirebaseRead('getSchoolHistory', 'classes', classesSnapshot.size, `Fetched classes for ${docSnap.id}`);
            const classes = classesSnapshot.docs.map(c => c.data() as Class);

            // Fetch assessments subcollection
            const assessmentsRef = collection(db, "schools", docSnap.id, "assessments");
            trackFirebaseRead('getSchoolHistory', 'assessments', 0, `Fetching assessments for ${docSnap.id}`);
            const assessmentsSnapshot = await getDocs(assessmentsRef);
            trackFirebaseRead('getSchoolHistory', 'assessments', assessmentsSnapshot.size, `Fetched assessments for ${docSnap.id}`);
            const assessments = assessmentsSnapshot.docs.map(a => a.data() as Assessment);

            // Fetch scores from score_buckets
            const scoreBucketsRef = collection(db, "schools", docSnap.id, "score_buckets");
            trackFirebaseRead('getSchoolHistory', 'score_buckets', 0, `Fetching scores for ${docSnap.id}`);
            const scoreBucketsSnapshot = await getDocs(scoreBucketsRef);
            trackFirebaseRead('getSchoolHistory', 'score_buckets', scoreBucketsSnapshot.size, `Fetched score buckets for ${docSnap.id}`);

            // Extract scores from all buckets
            const scores: Score[] = [];
            scoreBucketsSnapshot.docs.forEach(bucketDoc => {
                const bucketData = bucketDoc.data();
                if (bucketData.scoresMap) {
                    Object.values(bucketData.scoresMap).forEach((score: any) => {
                        scores.push(score as Score);
                    });
                }
            });

            console.log(`[getSchoolHistory] Loaded for ${docSnap.id}: ${students.length} students, ${subjects.length} subjects, ${classes.length} classes, ${assessments.length} assessments, ${scores.length} scores`);

            // Merge all data
            data.push({
                ...mainData,
                students,
                subjects,
                classes,
                assessments,
                scores
            });
        }

        console.log(`[getSchoolHistory] Total historical terms loaded: ${data.length}`);

        // Update Cache
        historyCache.set(schoolNamePrefix, { timestamp: Date.now(), data });
        return data;
    } catch (error) {
        console.error("Error fetching school history:", error);
        return [];
    }
};
