import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, onSnapshot, runTransaction, query, where, documentId, writeBatch, updateDoc, deleteField, Unsubscribe } from "firebase/firestore";
import type { SchoolSettings, Student, Subject, Class, Grade, Assessment, Score, ReportSpecificData, ClassSpecificData, User, DeviceCredential, UserLog, OnlineUser } from '../types';

// Helper to migrate legacy arrays to subcollections safely
const migrateLegacyData = async (docId: string, data: any) => {
    const SUBCOLLECTION_KEYS = ['students', 'scores', 'classes', 'subjects', 'assessments'];
    const cleanup: any = {};
    let hasMigrationWork = false;
    let totalItemsToMigrate = 0;

    // Calculate total work first
    SUBCOLLECTION_KEYS.forEach(key => {
        if (Array.isArray(data[key]) && data[key].length > 0) {
            totalItemsToMigrate += data[key].length;
            hasMigrationWork = true;
        }
    });

    if (!hasMigrationWork) return;

    console.log(`[Migration] Found ${totalItemsToMigrate} legacy items to migrate.`);

    try {
        // We use Batched Writes instead of one massive Transaction to avoid the 500-op limit.
        // We assume exclusive control (no other user is editing *legacy* fields right now).

        let batch = writeBatch(db);
        let operationCount = 0;
        const commitBatch = async () => {
            if (operationCount > 0) {
                await batch.commit();
                batch = writeBatch(db); // Reset
                operationCount = 0;
            }
        };

        for (const key of SUBCOLLECTION_KEYS) {
            if (Array.isArray(data[key]) && data[key].length > 0) {
                console.log(`[Migration] Processing ${key}...`);

                for (const item of data[key]) {
                    if (item && item.id !== undefined) {
                        const subDocRef = doc(db, "schools", docId, key, String(item.id));
                        const sanitizedItem = sanitizeForFirestore(item);
                        batch.set(subDocRef, sanitizedItem, { merge: true });
                        operationCount++;

                        // Commit every 400 ops to stay safe (Limit is 500)
                        if (operationCount >= 400) {
                            await commitBatch();
                            console.log(`[Migration] 🔄 Committed a batch of 400 items...`);
                        }
                    }
                }

                // Mark this field for deletion after success
                cleanup[key] = deleteField();
            }
        }

        // Commit remaining writes
        await commitBatch();

        // Final Step: Clean up main document
        const docRef = doc(db, "schools", docId);
        await updateDoc(docRef, cleanup);
        console.log('[Migration] ✅ Migration & Cleanup complete. Main document cleaned.');

    } catch (e) {
        console.error('[Migration] ❌ Migration failed:', e);
        // Do not cleanup if write failed.
    }
};

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
import { ACTIVE_DATABASE_INDEX } from '../constants';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfigs = [
    // INDEX 0: Placeholder (Unused)
    {},
    // INDEX 1: Primary Database (sba-pro-master-759f6)
    {
        apiKey: "AIzaSyCe0O-mBCODiEA-KNVLXLMp00lJ6_Jt5SU",
        authDomain: "sba-pro-master-759f6.firebaseapp.com",
        projectId: "sba-pro-master-759f6",
        storageBucket: "sba-pro-master-759f6.firebasestorage.app",
        messagingSenderId: "239073604626",
        appId: "1:239073604626:web:452bc2719fc980704d14cb",
        measurementId: "G-47MMKKX888"
    },
    // INDEX 2: Backup Database (sba-pro-master-40f08)
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

// Select configuration based on the active index
const selectedConfig = firebaseConfigs[ACTIVE_DATABASE_INDEX] || firebaseConfigs[1];

console.log(`[Firebase] Initializing with Database Index: ${ACTIVE_DATABASE_INDEX} (${selectedConfig['projectId']})`);

// Initialize Firebase
const app = initializeApp(selectedConfig);
const analytics = getAnalytics(app);
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

// Helper to recursively replace undefined with null for Firestore compatibility
const sanitizeForFirestore = (obj: any): any => {
    if (obj === undefined) return null;
    if (obj === null) return null;
    if (Array.isArray(obj)) {
        return obj.map(sanitizeForFirestore);
    }
    if (typeof obj === 'object') {
        const newObj: any = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const val = sanitizeForFirestore(obj[key]);
                // Filter out "undefined" keys if intended, or set to null
                // If we set to null, Firestore keeps the field.
                newObj[key] = val;
            }
        }
        return newObj;
    }
    return obj;
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

    // DOMAIN OPTIMIZATION: Use range queries (>= start, <= end) to avoid full collection reads
    // This reduces reads from N (total docs) to M (matched docs).
    const sanitizedInput = sanitizeSchoolName(partialName);
    const schoolsRef = collection(db, "schools");

    // We search for IDs starting with the sanitized name (lowercase)
    // Note: This relies on IDs being stored as lowercase (which createDocumentId ensures).
    // Legacy IDs with mixed case might be missed, but this is a necessary trade-off for performance.

    // Strategy: Run two queries in parallel to catch most ID patterns without full scan
    // 1. Lowercase (standard): "stmarys"
    // 2. Capitalized (legacy): "Stmarys"

    const capitalizedInput = sanitizedInput.charAt(0).toUpperCase() + sanitizedInput.slice(1);

    const q1 = query(
        schoolsRef,
        where(documentId(), '>=', sanitizedInput),
        where(documentId(), '<=', sanitizedInput + '\uf8ff')
    );

    const q2 = query(
        schoolsRef,
        where(documentId(), '>=', capitalizedInput),
        where(documentId(), '<=', capitalizedInput + '\uf8ff')
    );

    // Run in parallel
    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

    const matches: string[] = [];
    const seen = new Set<string>();

    const processDoc = (doc: any) => {
        // Deduplicate
        if (seen.has(doc.id)) return;
        seen.add(doc.id);

        if (doc.id.toLowerCase().startsWith(sanitizedInput)) {
            matches.push(doc.id);
        }
    };

    snap1.forEach(processDoc);
    snap2.forEach(processDoc);

    if (matches.length > 0) {
        // Group matches by school name
        const schoolsMap = new Map<string, Set<string>>();

        matches.forEach(id => {
            const firstUnderscoreIndex = id.indexOf('_');
            if (firstUnderscoreIndex !== -1) {
                const schoolNamePart = id.substring(0, firstUnderscoreIndex);
                const parts = id.split('_');

                if (parts.length >= 2) {
                    if (!schoolsMap.has(schoolNamePart)) {
                        schoolsMap.set(schoolNamePart, new Set());
                    }
                    schoolsMap.get(schoolNamePart)?.add(parts[1]);
                }
            }
        });

        const results = Array.from(schoolsMap.entries()).map(([schoolName, yearsSet]) => ({
            schoolName,
            years: Array.from(yearsSet)
        }));

        return results;
    }

    return null;
};

// Helper to fetch full school data (Fan-In from Subcollections)
const getFullSchoolData = async (docId: string, mainDocData: AppDataType, keysToFetch?: (keyof AppDataType)[]): Promise<AppDataType> => {
    // If keysToFetch is provided, filtering to those that match SUBCOLLECTION_KEYS.
    // Otherwise, fetch all.
    const ALL_SUBCOLLECTIONS = ['students', 'scores', 'classes', 'subjects', 'assessments'];

    const keysToProcess = keysToFetch
        ? ALL_SUBCOLLECTIONS.filter(k => keysToFetch.includes(k as any))
        : ALL_SUBCOLLECTIONS;

    const fullData: any = { ...mainDocData };

    if (keysToProcess.length === 0 && keysToFetch) {
        // Optimization: If keysToFetch was provided but contained no subcollections (e.g. only 'settings'), 
        // we don't need to fetch anything here.
        // However, we must ensure we return the existing mainDocData structure.
        return fullData as AppDataType;
    }

    console.log(`[firebaseService] 📥 Fetching subcollections: ${keysToProcess.join(', ')}`);

    // Parallel fetch of selected subcollections
    await Promise.all(keysToProcess.map(async (key) => {
        try {
            const subColRef = collection(db, "schools", docId, key);
            const snapshot = await getDocs(subColRef);
            if (!snapshot.empty) {
                fullData[key] = snapshot.docs.map(d => d.data());
                // console.log(`[firebaseService] 📥 Fetched ${fullData[key].length} ${key} from subcollection`);
            }
        } catch (e) {
            console.error(`[firebaseService] Error fetching subcollection ${key}:`, e);
        }
    }));

    return fullData as AppDataType;
};

// ... loginOrRegisterSchool ...

// Helper to save/update the database with safe transactional merging for ALL fields
export const saveDataTransaction = async (
    docId: string,
    updates: Partial<AppDataType>,
    deletions?: Record<string, string[]>
) => {
    // ... existing saveDataTransaction code ...
    // (We are not touching saveDataTransaction in this edit, just skipping down to getSchoolData which is exported)
    // Actually, getSchoolData is further down. I see I need to be careful with the replace range.
    // getFullSchoolData is at line 280. 
    // getSchoolData is at line 775. 
    // I should split this into two replaces or use multi_replace if appropriate. 
    // But getFullSchoolData is local, so I can't export it easily without changing signature everywhere.
    // Wait, getFullSchoolData is defined right before usage in getSchoolData? 
    // No, it's defined at line 280. usage is at line 338 and 789.
    // I will start by updating getFullSchoolData definition.
};

// ...


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
                docSnap = match;
            }
        }

        if (docSnap.exists()) {
            const data = docSnap.data() as AppDataType;

            // Verify Password first
            if (data.password !== password) {
                return { status: 'wrong_password' };
            }

            if (data.Access === false) {
                return { status: 'access_denied' };
            }

            // Success! Fetch the REST of the data (Subcollections)
            const fullData = await getFullSchoolData(targetDocId, data);

            return { status: 'success', data: fullData, docId: targetDocId };
        } else {
            if (!createIfMissing) {
                return { status: 'not_found' };
            }

            // Create new school
            const newData: AppDataType = {
                ...initialData,
                password: password,
                Access: false
            };

            docRef = doc(db, "schools", docId);
            await setDoc(docRef, newData);
            return { status: 'created_pending_access' };
        }
    } catch (e: any) {
        console.error("Login/Register error:", e);
        return { status: 'error', message: e.message || "Unknown error occurred" };
    }
};

// Helper to save/update the database with safe transactional merging for ALL fields
export const saveDataTransaction = async (
    docId: string,
    updates: Partial<AppDataType>,
    deletions?: Record<string, string[]>
) => {
    try {
        const docRef = doc(db, "schools", docId);

        await runTransaction(db, async (transaction) => {
            const sfDoc = await transaction.get(docRef);
            if (!sfDoc.exists()) {
                throw new Error("Document does not exist!");
            }

            const currentData = sfDoc.data() as AppDataType;
            const finalUpdates: any = {};

            const SUBCOLLECTION_KEYS = ['students', 'scores', 'classes', 'subjects', 'assessments'];

            // Collect all fields that need attention (either update or deletion)
            // PLUS force-check maintenance fields to self-heal size issues
            const allKeys = new Set([
                ...Object.keys(updates),
                ...(deletions ? Object.keys(deletions) : []),
                'userLogs',
                'activeSessions'
            ]);

            console.log('[firebaseService] ☁️ saveDataTransaction keys:', Array.from(allKeys));

            for (const key of allKeys) {
                // Debug logging for maintenance
                // console.log(`[firebaseService] Processing key: ${ key } `);

                const currentVal = currentData[key as keyof AppDataType];
                const newVal = updates[key as keyof AppDataType]; // Might be undefined if only pruning
                const deletedIds = deletions ? deletions[key] : undefined;

                // ---------------------------------------------------------
                // BRANCH A: Subcollections (The new scalable way)
                // ---------------------------------------------------------
                if (SUBCOLLECTION_KEYS.includes(key)) {
                    // 1. Handle Updates (Array of items)
                    if (Array.isArray(newVal)) {
                        newVal.forEach((item: any) => {
                            if (item && item.id !== undefined) {
                                // Write to schools/{docId}/{key}/{itemId}
                                const subDocRef = doc(db, "schools", docId, key, String(item.id));
                                // Use { merge: true } so we don't wipe existing fields if we only sent partial data
                                // (Though our app generally sends full objects for students/classes, scores might be partial in future)
                                const sanitizedItem = sanitizeForFirestore(item);
                                transaction.set(subDocRef, sanitizedItem, { merge: true });
                            }
                        });
                    }

                    // 2. Handle Deletions (Array of IDs)
                    if (deletedIds && Array.isArray(deletedIds)) {
                        console.log(`[firebaseService] 🗑️ Processing SUBCOLLECTION deletions for ${key}: ${deletedIds.join(', ')}`);
                        deletedIds.forEach(id => {
                            const subDocRef = doc(db, "schools", docId, key, String(id));
                            transaction.delete(subDocRef);
                        });
                    }

                    // Note: We DO NOT add anything to 'finalUpdates' for these keys.
                    // This creates the "Fan-Out" effect.
                    continue;
                }

                // ---------------------------------------------------------
                // BRANCH B: Main Document Fields (Legacy / Metadata)
                // ---------------------------------------------------------

                // DIAGNOSTICING SIZE:
                try {
                    const size = JSON.stringify(currentVal || {}).length;
                    if (size > 10000) {
                        console.log(`[firebaseService] ⚠️ Large Main Doc Field: ${key} = ${(size / 1024).toFixed(2)} KB`);
                    }
                } catch (e) { }

                // Strategy 1: Smart Array Merge (for lists with unique IDs that are NOT subcollections - e.g. maybe userLogs if we kept it here)
                // Actually userLogs is array type, but strictly pruned.
                const isArrayType = (Array.isArray(currentVal) || Array.isArray(newVal));

                if (isArrayType) {
                    // Check if items have IDs (safely)
                    const sampleItem = (Array.isArray(newVal) && newVal.length > 0) ? newVal[0] :
                        (Array.isArray(currentVal) && currentVal.length > 0) ? currentVal[0] : null;

                    const hasId = sampleItem && typeof sampleItem === 'object' && 'id' in sampleItem;

                    if (hasId) {
                        const mergedMap = new Map<string, any>();

                        // 1. Load Server Data first
                        if (Array.isArray(currentVal)) {
                            currentVal.forEach((item: any) => {
                                if (item && item.id !== undefined) mergedMap.set(String(item.id), item);
                            });
                        }

                        // 2. Overlay Local Updates (Last Write Wins for collision)
                        if (Array.isArray(newVal)) {
                            newVal.forEach((item: any) => {
                                if (item && item.id !== undefined) mergedMap.set(String(item.id), item);
                            });
                        }

                        // 3. Apply Deletions (Remove items that were locally deleted)
                        if (deletedIds && Array.isArray(deletedIds)) {
                            console.log(`[firebaseService] 🗑️ Processing deletions for ${key}: ${deletedIds.join(', ')}`);
                            console.log(`[firebaseService]    Map size BEFORE: ${mergedMap.size}`);
                            deletedIds.forEach(id => {
                                const deleted = mergedMap.delete(String(id));
                                console.log(`[firebaseService]    Deleted ID ${id}? ${deleted}`);
                            });
                            console.log(`[firebaseService]    Map size AFTER: ${mergedMap.size}`);
                        }

                        // SPECIAL HANDLING: Prune userLogs to prevent database size limit errors
                        if (key === 'userLogs') {
                            const allLogs = Array.from(mergedMap.values());
                            // Sort by timestamp if possible (assuming ISO strings) or just take last 50
                            // UserLog has timestamp field.
                            // FIX: Stricter limit 20 to aggressively reduce size
                            if (allLogs.length > 20) {
                                allLogs.sort((a, b) => (new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
                                const keptLogs = allLogs.slice(-20); // Keep last 20
                                console.log(`[firebaseService] ✂️ Pruned userLogs from ${allLogs.length} to 20`);
                                finalUpdates[key] = keptLogs;
                            } else if (newVal !== undefined || (allLogs.length !== (currentVal as any[])?.length)) {
                                // Only write if changed (updates exist OR length changed OR we just want to be safe)
                                // If we are just "maintenance checking" and nothing changed, we don't strictly need to write back 
                                // unless we want to ensure consistency. 
                                // Actually, finalUpdates[key] = ... implies we overwrite the field.
                                // If newVal is undefined and length is same, we are just writing back the same data.
                                // Optimization: Only write if meaningful change? 
                                // For now, write it to be safe (ensure sync).
                                finalUpdates[key] = allLogs;
                            }
                        } else {
                            // Only include in finalUpdates if there was a change (newVal or deletions) OR if we want to refresh
                            if (newVal !== undefined || (deletedIds && deletedIds.length > 0)) {
                                finalUpdates[key] = Array.from(mergedMap.values());
                            }
                        }
                    } else {
                        // Arrays without IDs: Overwrite (fallback) or Union? 
                        // e.g. string[]. We assume overwrite for simple lists unless specific logic.
                        if (newVal !== undefined) finalUpdates[key] = newVal;
                    }
                }
                // Strategy 2: Object Merge (for Settings, ActiveSessions)
                else if (key === 'settings' || key === 'activeSessions') {
                    // Start with server data, merge updates. (Deletions not supported for object properties yet, only array items)
                    // Cast to any to satisfy TS "Spread types may only be created from object types"
                    const currentObj = (currentVal || {}) as any;
                    const newObj = (newVal || {}) as any;
                    const mergedObj = { ...currentObj, ...newObj };

                    // SPECIAL HANDLING: Prune activeSessions > 24h
                    if (key === 'activeSessions') {
                        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                        const prunedSessions: Record<string, string> = {};
                        Object.entries(mergedObj).forEach(([sessionId, timestamp]) => {
                            if (typeof timestamp === 'string' && timestamp > yesterday) {
                                prunedSessions[sessionId] = timestamp;
                            }
                        });
                        finalUpdates[key] = prunedSessions;
                    } else {
                        finalUpdates[key] = mergedObj;
                    }
                }
                // Strategy 3: Default Overwrite (Primitives)
                else {
                    if (newVal !== undefined) finalUpdates[key] = newVal;
                }
            }



            // Only perform update if we have data
            if (Object.keys(finalUpdates).length > 0) {
                // Sanitize the entire payload to ensure no 'undefined' values exist
                const sanitizedUpdates = sanitizeForFirestore(finalUpdates);
                transaction.update(docRef, sanitizedUpdates);
            }
        });
        console.log(`[firebaseService] Transaction successful.Keys: ${Object.keys(updates).join(', ')}.Deletions: ${deletions ? Object.keys(deletions).join(', ') : 'none'} `);
    } catch (e) {
        console.error("[firebaseService] Transaction failed: ", e);
        throw e;
    }
};

// DANGEROUS: This overwrites the entire database document.
// ONLY use this for creating a new term/school from scratch.
// DO NOT use for syncing - it will wipe existing arrays if not careful.
export const initializeNewTermDatabase = async (docId: string, data: Partial<AppDataType>) => {
    try {
        // docId is expected to be the full document ID (sanitized)
        const docRef = doc(db, "schools", docId);
        // We use setDoc without merge to ensure a clean state, or merge:true if we trust the input is complete.
        // For new term initialization, we want to ensure specific structure.
        await setDoc(docRef, data, { merge: true });
        console.log("New term database initialized successfully");
    } catch (error: any) {
        console.error("Error initializing new term:", error);
        throw error;
    }
};

// Helper to subscribe to real-time updates with Subcollection Fan-In
export const subscribeToSchoolData = (docId: string, callback: (data: AppDataType, isLocal?: boolean) => void) => {
    const docRef = doc(db, "schools", docId);

    // State to hold partial data from multiple sources
    // We initialize with a skeleton, but actual data comes from snapshots
    let currentAggregatedData: Partial<AppDataType> = {};
    let isInitialLoad = true;
    const SUBCOLLECTION_KEYS = ['students', 'scores', 'classes', 'subjects', 'assessments'];

    // Store all unsubscribe functions
    const unsubscribes: Unsubscribe[] = [];

    // Helper to debounce updates slightly if multiple listeners fire at once? 
    // For now, valid simple approach: just call callback on every update.
    // React's setState batching usually handles rapid updates well.

    const notifyCallback = () => {
        // Only notify if we have at least the basic school info (from main doc)
        if ((currentAggregatedData as any).schoolName) {
            callback(currentAggregatedData as AppDataType, false);
        }
    };

    // 1. Subscribe to Main Document (Settings, Logs, Metadata)
    const mainUnsub = onSnapshot(docRef, { includeMetadataChanges: true }, (docSnap) => {
        if (docSnap.metadata.hasPendingWrites && !isInitialLoad) {
            // Include pending writes? Yes, usually for optimistic UI.
            // But we ignore "echo" if needed. 
        }

        if (docSnap.exists()) {
            const data = docSnap.data() as AppDataType;

            // Merge into aggregated data (excluding subcollection keys if they exist physically in main doc)
            // Actually, we overwrite. But subcollections might not be in 'data' if they are true subcollections.
            // CAUTION: If legacy arrays exist in 'data', they will overwrite our subcollection arrays 
            // unless we migrate them.

            // Debug: See what's actually in the main doc
            // console.log('[firebaseService] 📨 Snapshot Keys:', Object.keys(data));

            // Migration Check:
            migrateLegacyData(docId, data);

            // Update local state, but preserve Subcollection arrays if we already fetched them
            // We iterate keys to only update Non-Subcollection keys from main doc
            // (Unless main doc *has* the array, in which case it temporarily wins until migration finishes)
            const mainData: any = { ...data };

            // If main doc has empty/null for subcollection keys (which is the goal), keep our local subcollection data
            SUBCOLLECTION_KEYS.forEach(key => {
                if (!mainData[key] || (Array.isArray(mainData[key]) && mainData[key].length === 0)) {
                    // Main doc doesn't have it, so keep our aggregated subcollection data
                    if ((currentAggregatedData as any)[key]) {
                        mainData[key] = (currentAggregatedData as any)[key];
                    } else {
                        mainData[key] = []; // Default to empty array if neither has it
                    }
                }
            });

            currentAggregatedData = { ...currentAggregatedData, ...mainData };
            notifyCallback();
        } else {
            console.log("No such document!");
            // callback(null); // Optional: Handle deletion
        }
        isInitialLoad = false;
    });
    unsubscribes.push(mainUnsub);

    // 2. Subscribe to Subcollections
    SUBCOLLECTION_KEYS.forEach(key => {
        const subColRef = collection(db, "schools", docId, key);
        const subUnsub = onSnapshot(subColRef, (snapshot) => {
            const items = snapshot.docs.map(d => d.data());
            // console.log(`[firebaseService] 📥 Received ${items.length} items from ${key} subcollection`);

            (currentAggregatedData as any)[key] = items;
            notifyCallback();
        });
        unsubscribes.push(subUnsub);
    });

    // Return a single unsubscribe function that calls all of them
    return () => {
        unsubscribes.forEach(unsub => unsub());
    };
};



// User Management Functions

/**
 * Update the users array in the school database
 */
export const updateUsers = async (docId: string, users: User[]) => {
    try {
        const docRef = doc(db, "schools", docId);
        await setDoc(docRef, { users }, { merge: true });
    } catch (error: any) {
        console.error('[firebaseService] Error updating users:', error);
        throw error;
    }
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
    try {
        const docRef = doc(db, "schools", docId);
        await setDoc(docRef, { deviceCredentials }, { merge: true });
    } catch (error: any) {
        console.error('[firebaseService] Error updating device credentials:', error);
        throw error;
    }
};

/**
 * Log a user activity
 */
export const logUserActivity = async (docId: string, log: UserLog) => {
    try {
        const docRef = doc(db, "schools", docId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return;

        const data = docSnap.data() as AppDataType;
        const logs = data.userLogs || [];

        // Optional: limit logs
        // AGGRESSIVE PRUNING: Reduce to 50 items to prevent hitting Firestore 1MB limit
        if (logs.length > 50) logs.splice(0, logs.length - 50); // Keep last 50

        logs.push(log);

        await setDoc(docRef, { userLogs: logs }, { merge: true });
    } catch (error: any) {
        console.error('[firebaseService] Error logging user activity:', error);
        throw error;
    }
};

/**
 * Update user heartbeat
 */
export const updateHeartbeat = async (docId: string, userId: number) => {
    try {
        // We can't use simple dot notation for dynamic keys in setDoc with merge efficiently without a map
        // So we read-update-write activeSessions map
        const docRef = doc(db, "schools", docId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return;

        const data = docSnap.data() as AppDataType;
        const activeSessions = data.activeSessions || {};

        // Prune stale sessions (> 24 hours) to save space
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        Object.keys(activeSessions).forEach(key => {
            if (activeSessions[key] < yesterday) {
                delete activeSessions[key];
            }
        });

        activeSessions[userId.toString()] = new Date().toISOString();

        await setDoc(docRef, { activeSessions }, { merge: true });
    } catch (error: any) {
        console.error('[firebaseService] Error updating heartbeat:', error);
        throw error;
    }
};

/**
 * Fetch the full school data document
 */
export const getSchoolData = async (docId: string, keysToFetch?: (keyof AppDataType)[]): Promise<AppDataType | null> => {
    try {
        const docRef = doc(db, "schools", docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data() as AppDataType;

            // Trigger migration if legacy data is found
            // This ensures manual fetches cleans up the DB too
            console.log('[firebaseService] 📥 getSchoolData found document. Checking for migration...');
            await migrateLegacyData(docId, data);

            // Fetch subcollections to ensure we return COMPLETE data
            const fullData = await getFullSchoolData(docId, data, keysToFetch);
            return fullData;
        }
        return null;
    } catch (e) {
        console.error("Error fetching school data:", e);
        throw e;
    }
};


/**
 * Fetch all historical terms for a school
 */
export const getSchoolHistory = async (schoolName: string): Promise<AppDataType[]> => {
    try {
        const sanitizedSchoolName = sanitizeSchoolName(schoolName);
        const prefix = sanitizedSchoolName + '_';

        // Query for documents starting with schoolName_
        const schoolsRef = collection(db, "schools");
        const q = query(
            schoolsRef,
            where(documentId(), '>=', prefix),
            where(documentId(), '<', prefix + '\uf8ff')
        );

        const querySnapshot = await getDocs(q);


        // Use parallel fetching to get full data for each term
        const historyData = await Promise.all(querySnapshot.docs.map(async (doc) => {
            const data = doc.data() as AppDataType;
            // Fetch subcollections if needed (fan-in)
            return await getFullSchoolData(doc.id, data);
        }));

        return historyData;

    } catch (e) {
        console.error("Error fetching school history:", e);
        throw e;
    }
};
