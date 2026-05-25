import React, { createContext, useContext, ReactNode, useState, useEffect, useRef, useMemo } from 'react';
import { updateHeartbeat, logUserActivity, getSchoolData, saveDataTransaction, fetchStudents, fetchScoresForClass, fetchSubcollection, fetchMetadataBundle, updateMetadataBundle, updateStudentBucket, ensureStudentBucketExists, db } from '../services/firebaseService';
import { onSnapshot, doc, collection, Unsubscribe } from 'firebase/firestore';
import { getDeviceCredential } from '../services/authService';
import * as SyncLogger from '../services/syncLogger';
import useLocalStorage from '../hooks/useLocalStorage';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { offlineQueue } from '../services/offlineQueue';
import { useDatabaseError } from './DatabaseErrorContext';
import { useFirebaseAnalytics } from './FirebaseAnalyticsContext';
import { isQuotaExhaustedError } from '../utils/databaseErrorHandler';
import * as LZ from 'lz-string';
import type { Student, Subject, Class, Grade, Assessment, Score, SchoolSettings, ReportSpecificData, ClassSpecificData, User, UserLog, OnlineUser, Page, AppDataType } from '../types';
import {
    INITIAL_SETTINGS,
    INITIAL_STUDENTS,
    INITIAL_SUBJECTS,
    INITIAL_CLASSES,
    INITIAL_GRADES,
    INITIAL_ASSESSMENTS,
    INITIAL_SCORES,
    INITIAL_REPORT_DATA,
    INITIAL_CLASS_DATA,
    MULTI_SCORE_ENTRY_ENABLED,
} from '../constants';

export interface DataContextType {
    loadMetadata: (force?: boolean) => Promise<any>; // Exposed Metadata Loader
    refreshFromCloud: (ignoreSyncLock?: boolean, keysToRefresh?: (keyof AppDataType)[]) => Promise<'throttled' | 'success' | 'error'>;
    schoolId: string | null;

    // State
    settings: SchoolSettings;
    students: Student[];
    deletedStudents: Student[];
    subjects: Subject[];
    deletedSubjects: Subject[];
    classes: Class[];
    deletedClasses: Class[];
    grades: Grade[];
    deletedGrades: Grade[];
    assessments: Assessment[];
    deletedAssessments: Assessment[];
    scores: Score[];
    reportData: ReportSpecificData[];
    classData: ClassSpecificData[];
    users?: User[]; // Optional because it might be empty initially
    userLogs?: UserLog[];
    activeSessions?: Record<string, string>;
    onlineUsers: OnlineUser[];

    // Setters
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    setSettings: React.Dispatch<React.SetStateAction<SchoolSettings>>;
    updateSettings: (updates: Partial<SchoolSettings>) => void;
    setAssessments: React.Dispatch<React.SetStateAction<Assessment[]>>; // For reordering
    // Student CRUD
    addStudent: (student: Omit<Student, 'id'>) => number;
    updateStudent: (student: Student) => void;
    deleteStudent: (id: number) => void;
    // Subject CRUD
    addSubject: (subject: Omit<Subject, 'id'>) => number;
    updateSubject: (subject: Subject) => void;
    deleteSubject: (id: number) => void;
    // Class CRUD
    addClass: (cls: Omit<Class, 'id'>) => number;
    updateClass: (cls: Class) => void;
    deleteClass: (id: number) => void;
    // Grade CRUD
    addGrade: (grade: Omit<Grade, 'id'>) => number;
    updateGrade: (grade: Grade) => void;
    deleteGrade: (id: number) => void;
    // Assessment CRUD
    addAssessment: (assessment: Omit<Assessment, 'id'>) => number;
    updateAssessment: (assessment: Assessment) => void;
    deleteAssessment: (id: number) => void;
    // Score CRUD
    updateStudentScores: (studentId: number, subjectId: number, assessmentId: number, newScores: string[]) => void;
    getStudentScores: (studentId: number, subjectId: number, assessmentId: number) => string[];
    // Report Data
    getReportData: (studentId: number) => ReportSpecificData | undefined;
    updateReportData: (studentId: number, data: Partial<Omit<ReportSpecificData, 'totalSchoolDays'>>) => void;
    // Class Data
    getClassData: (classId: number) => ClassSpecificData | undefined;
    updateClassData: (classId: number, data: Partial<ClassSpecificData>) => void;
    // FIX: Add function to load imported data.
    loadImportedData: (data: Partial<AppDataType>, isRemote?: boolean) => void;
    saveToCloud: (isManualSave?: boolean) => Promise<void>;

    // Page-specific save functions
    saveSettings: () => Promise<void>;
    saveStudents: () => Promise<void>;
    saveTeachers: () => Promise<void>;
    saveSubjects: () => Promise<void>;
    saveClasses: () => Promise<void>;
    saveGrades: () => Promise<void>;
    saveAssessments: () => Promise<void>;
    saveScores: () => Promise<void>;
    subscription: any | null;

    setSchoolId: (id: string | null) => void;

    // Network status
    isOnline: boolean;
    isSyncing: boolean;
    isFetching: boolean;
    queuedCount: number;
    // Sync control
    pauseSync: () => void;
    resumeSync: () => void;
    blockRemoteUpdates: () => void;
    allowRemoteUpdates: () => void;

    // New Actions
    logUserAction: (userId: number, userName: string, role: string, action: 'Login' | 'Logout') => Promise<void>;
    sendHeartbeat: (userId: number) => Promise<void>;

    // Lazy Loading
    loadStudents: (limit?: number, force?: boolean) => Promise<void>;
    loadScores: (classId: number | undefined, subjectId: number) => Promise<void>;

    // UI Feedback
    hasLocalChanges: boolean;
    setHasLocalChanges: (hasChanges: boolean) => void;
    isDirty: (...fields: (keyof AppDataType)[]) => boolean; // Check if specific fields have unsaved changes

    // Debug
    getPendingUploadData: (limitToFields?: (keyof AppDataType)[], dataOverride?: AppDataType) => any;

    // Draft score synchronization
    updateDraftScore: (studentId: number, subjectId: number, assessmentId: number, value: string) => void;
    removeDraftScore: (studentId: number, subjectId: number, assessmentId: number) => void;
    getComputedScore: (studentId: number, subjectId: number, assessmentId: number) => string;
    draftVersion: number; // Increment to trigger re-renders of inputs
    pendingCount: number;
    isPageDirty: (pageName: Page) => boolean;
    revertPendingChanges: (field: keyof AppDataType, id?: number | string) => void;
    revertAllPendingChanges: () => void;
    isItemDirty: (field: keyof AppDataType, id: string | number) => boolean;
    isSettingDirty: (field: keyof SchoolSettings) => boolean;
    isScoreDirty: (studentId: number, subjectId: number, assessmentId: number) => boolean;
    isDraftScore: (studentId: number, subjectId: number, assessmentId: number) => boolean;
    refreshVersion: number;
    restoreDefaultGrades: () => void;
    getOriginalItem: (field: keyof AppDataType, id: string | number) => any;
    unreadNotificationCount: number;
    markNotificationAsRead: (id: number) => void;
    markAllNotificationsAsRead: () => void;
    restoreItem: (field: keyof AppDataType, id: number) => void;
    permanentlyDeleteItem: (field: keyof AppDataType, id: number) => void;
    mergeSubjects: (targetId: number, duplicateIds: number[]) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// Helper to extract primary key from collection items (handles id, studentId, classId)
export const getItemId = (item: any): string | undefined => {
    if (!item || typeof item !== 'object') return undefined;
    const id = item.id ?? item.studentId ?? item.subjectId ?? item.classId;
    return id !== undefined ? String(id) : undefined;
};

// Deep comparison helper to check if two values are equal
export const deepEqual = (a: any, b: any): boolean => {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;

    // For arrays
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!deepEqual(a[i], b[i])) return false;
        }
        return true;
    }

    // For objects
    if (typeof a === 'object' && typeof b === 'object') {
        const keysA = Object.keys(a).sort();
        const keysB = Object.keys(b).sort();

        if (keysA.length !== keysB.length) return false;

        for (let i = 0; i < keysA.length; i++) {
            if (keysA[i] !== keysB[i]) return false;
            if (!deepEqual(a[keysA[i]], b[keysA[i]])) return false;
        }
        return true;
    }

    return false;
};

const IGNORED_KEYS = new Set(['_seconds', '_nanoseconds', 'createdAt', 'updatedAt', '__v', '_firestore', '_isLocallyCreated']);

export const deepEqualOptimized = (a: any, b: any): boolean => {
    if (a === b) return true;

    const isEmptyValue = (v: any) => 
        v === null || 
        v === undefined || 
        v === '' || 
        (Array.isArray(v) && v.length === 0) ||
        (v === false); // deleted: false vs missing is equivalent

    if (isEmptyValue(a) && isEmptyValue(b)) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;

    if (typeof a === 'string') {
        return a.trim() === b.trim();
    }

    if (Array.isArray(a) && Array.isArray(b)) {
        const filteredA = a.filter(v => !isEmptyValue(v));
        const filteredB = b.filter(v => !isEmptyValue(v));
        if (filteredA.length !== filteredB.length) return false;
        
        // Order-independent check for objects with IDs
        if (filteredA.length > 0 && typeof filteredA[0] === 'object') {
            const mapB = new Map<string, any>();
            for (const item of filteredB) {
                const id = getItemId(item);
                if (id !== undefined) mapB.set(id, item);
            }
            
            for (const item of filteredA) {
                const id = getItemId(item);
                if (id === undefined) return false;
                const itemB = mapB.get(id);
                if (!itemB || !deepEqualOptimized(item, itemB)) return false;
            }
            return true;
        }

        // Normal array index-by-index comparison
        for (let i = 0; i < filteredA.length; i++) {
            if (!deepEqualOptimized(filteredA[i], filteredB[i])) return false;
        }
        return true;
    }

    if (typeof a === 'object') {
        // Special handling for assessmentScores inside Scores
        const hasAssessmentScoresA = 'assessmentScores' in a;
        const hasAssessmentScoresB = 'assessmentScores' in b;
        
        const keysA = Object.keys(a).filter(k => !IGNORED_KEYS.has(k) && k !== 'assessmentScores');
        const keysB = Object.keys(b).filter(k => !IGNORED_KEYS.has(k) && k !== 'assessmentScores');

        // Build list of active keys
        const activeKeysA = keysA.filter(k => !isEmptyValue(a[k]));
        const activeKeysB = keysB.filter(k => !isEmptyValue(b[k]));

        if (activeKeysA.length !== activeKeysB.length) return false;

        for (const key of activeKeysA) {
            if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
            
            let valA = a[key];
            let valB = b[key];

            const lowerKey = key.toLowerCase();
            if (lowerKey === 'id' || lowerKey.endsWith('id') || lowerKey === 'studentid' || lowerKey === 'classid' || lowerKey === 'age') {
                if (valA !== null && valA !== undefined) valA = String(valA);
                if (valB !== null && valB !== undefined) valB = String(valB);
            }

            if (!deepEqualOptimized(valA, valB)) return false;
        }

        // Compare assessmentScores
        if (hasAssessmentScoresA || hasAssessmentScoresB) {
            const scoresA = hasAssessmentScoresA ? a.assessmentScores : null;
            const scoresB = hasAssessmentScoresB ? b.assessmentScores : null;

            const isEmptyScores = (s: any) => {
                if (!s || typeof s !== 'object') return true;
                return Object.keys(s).every(k => !Array.isArray(s[k]) || s[k].every((v: any) => v === ''));
            };

            const emptyA = isEmptyScores(scoresA);
            const emptyB = isEmptyScores(scoresB);

            if (emptyA && emptyB) return true;
            if (emptyA || emptyB) return false;

            const keysSA = Object.keys(scoresA).filter(k => Array.isArray(scoresA[k]) && scoresA[k].some((v: any) => v !== ''));
            const keysSB = Object.keys(scoresB).filter(k => Array.isArray(scoresB[k]) && scoresB[k].some((v: any) => v !== ''));

            if (keysSA.length !== keysSB.length) return false;

            for (const k of keysSA) {
                if (!Object.prototype.hasOwnProperty.call(scoresB, k)) return false;
                const arrA = scoresA[k].filter((v: any) => v !== '');
                const arrB = scoresB[k].filter((v: any) => v !== '');
                if (!deepEqualOptimized(arrA, arrB)) return false;
            }
        }

        return true;
    }

    return false;
};

export const isDataEqual = (a: any, b: any, field?: string): boolean => {
    const result = deepEqualOptimized(a, b);
    if (!result && field) {
        console.log(`[DataContext] 🔍 isDataEqual(${String(field)}): MISMATCH`, {
            a,
            b
        });
    }
    return result;
};

export const normalizeData = (data: any): any => {
    // Kept for backward compatibility but unused internally
    return data;
};


export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Database error handler
    const { showError: showDatabaseError } = useDatabaseError();

    // Check for Emulator Mode
    // @ts-ignore
    const isEmulator = import.meta.env.VITE_USE_EMULATOR === 'true';

    // Helper to create school-specific localStorage keys
    const getKey = (base: string) => {
        const prefix = isEmulator ? 'emulator-sba-' : 'sba-';
        return schoolId ? `${prefix}${schoolId}-${base}` : `${prefix}${base}`;
    };

    // CRITICAL: Get schoolId first (non-namespaced or emulator-namespaced)
    // We need to use a distinct key for schoolId in emulator mode to prevent cross-contamination
    const schoolIdKey = isEmulator ? 'emulator-sba-school-id' : 'sba-school-id';
    const [schoolId, setSchoolId] = useLocalStorage<string | null>(schoolIdKey, null);

    // All data uses schoolId-namespaced keys
    const [settings, setSettings] = useLocalStorage<SchoolSettings>(getKey('settings'), INITIAL_SETTINGS);
    const isPersistenceEnabled = settings.allowPersistence ?? true;

    // SENSITIVE DATA: Respects allowPersistence flag
    const [students, setStudents] = useLocalStorage<Student[]>(getKey('students'), INITIAL_STUDENTS, isPersistenceEnabled);
    const [scores, setScores] = useLocalStorage<Score[]>(getKey('scores'), INITIAL_SCORES, isPersistenceEnabled);
    const [reportData, setReportData] = useLocalStorage<ReportSpecificData[]>(getKey('report-data'), INITIAL_REPORT_DATA, isPersistenceEnabled);
    const [classData, setClassData] = useLocalStorage<ClassSpecificData[]>(getKey('class-data'), INITIAL_CLASS_DATA, isPersistenceEnabled);

    // STRUCTURAL DATA & SELECTIONS: Always persisted for smooth UI (not considered sensitive)
    const [subjects, setSubjects] = useLocalStorage<Subject[]>(getKey('subjects'), INITIAL_SUBJECTS);
    const [classes, setClasses] = useLocalStorage<Class[]>(getKey('classes'), INITIAL_CLASSES);
    const [grades, setGrades] = useLocalStorage<Grade[]>(getKey('grades'), INITIAL_GRADES);
    const [assessments, setAssessments] = useLocalStorage<Assessment[]>(getKey('assessments'), INITIAL_ASSESSMENTS);

    const isRemoteUpdate = React.useRef(false);
    const lastLocalUpdate = React.useRef(Date.now());

    // CACHE CLEARING LOGIC for Non-Persistence Mode
    // If persistence is disabled, clear local DISK cache on app launch or when flag is toggled to false.
    // We only clear SENSITIVE RECORD data (students, scores, etc.) and keep structural data (classes, subjects).
    useEffect(() => {
        if (!schoolId || settings.allowPersistence !== false) return;

        console.log(`[DataContext] 🧹 Persistence disabled for ${schoolId}. Clearing sensitive DISK cache...`);

        // Keys to clear (must match getKey(base) in useLocalStorage hooks)
        const keysToClear = ['students', 'scores', 'report-data', 'class-data'];

        keysToClear.forEach(base => {
            const fullKey = getKey(base);
            localStorage.removeItem(fullKey);
        });

        // We do NOT clear 'settings' or structural data to preserve the 'allowPersistence' flag
        // and ensure "control selections" (which depend on classes/subjects) remain functional.

    }, [schoolId, settings.allowPersistence]);



    // Network and sync state
    const isOnline = useNetworkStatus();
    const [isSyncing, setIsSyncing] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    const [queuedCount, setQueuedCount] = useState(offlineQueue.getQueueSize());

    // Sync lock to prevent concurrent syncs
    const isSyncingRef = React.useRef(false);

    // Sync pause control - used during authentication to stop all saves
    const isSyncPaused = React.useRef(false);

    // Form blocking control - used to block remote updates while forms are open
    const isFormOpen = React.useRef(false);

    // FIX: Add users to DataContextstate so it's included in sync/saves
    const [users, setUsersInternal] = useState<User[]>([]);
    const [userLogs, setUserLogs] = useState<UserLog[]>([]);
    const [activeSessions, setActiveSessions] = useState<Record<string, string>>({});
    const [subscription, setSubscription] = useState<any | null>(null);

    // GATING: Track if the session is "unlocked" (password verified)
    const [isSessionUnlocked, setIsSessionUnlocked] = useState(false);

    // Wrapped setUsers with logging to track all changes
    const setUsers = (value: React.SetStateAction<User[]>) => {
        const newValue = typeof value === 'function' ? value(users) : value;
        SyncLogger.log(`setUsers called. Current count: ${users.length}, New count: ${newValue.length}`);
        SyncLogger.log(`Stack trace: ${new Error().stack}`);
        setUsersInternal(newValue);
    };

    // Firebase Analytics Tracking (conditionally available in debug mode)
    let analytics: ReturnType<typeof useFirebaseAnalytics> | null = null;
    try {
        analytics = useFirebaseAnalytics();
    } catch (e) {
        // FirebaseAnalyticsProvider not available (not in debug mode or not wrapped)
    }

    // Track overall local changes for UI feedback (e.g. enabling Upload button)
    const [hasLocalChanges, setHasLocalChanges] = useState(false);
    // Force re-renders when dirty state changes (since dirtyFields is a ref)
    const [dirtyVersion, setDirtyVersion] = useState(0);
    // Track manual refreshes to force components to drop unsaved data
    const [refreshVersion, setRefreshVersion] = useState(0);

    // -------------------------------------------------------------------------
    // INSTANT VERSION UPDATE (Push-Based)
    // -------------------------------------------------------------------------
    // Listen for deployment pings from the build script. If the version in the 
    // database differs from our current runtime version, trigger a reload.
    useEffect(() => {
        const LATEST_VERSION = "1.0.299"; // Updated automatically by build script
        
        const deployDocRef = doc(db, 'system', 'deployment');
        
        const unsubscribe = onSnapshot(deployDocRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                const serverVersion = data.version;
                
                if (serverVersion && serverVersion !== LATEST_VERSION) {
                    // Guard against infinite reload loops when the CDN (Vercel/GitHub Pages)
                    // is still serving a cached old bundle after a reload.
                    // We track the last version we attempted a reload for in sessionStorage.
                    // If we already tried to reload for THIS server version, back off — 
                    // the new code just isn't live yet on the CDN.
                    const reloadAttemptKey = `reload_attempted_for_${serverVersion}`;
                    if (sessionStorage.getItem(reloadAttemptKey)) {
                        console.log(`[Version] ⏸️ Already reloaded for v${serverVersion}. Waiting for CDN to propagate...`);
                        return;
                    }

                    console.log(`[Version] 🚀 New version ${serverVersion} detected. Reloading silently...`);
                    sessionStorage.setItem(reloadAttemptKey, 'true');
                    window.onbeforeunload = null;
                    window.location.reload();
                }
            }
        }, (error) => {
            console.warn('[Version] Failed to attach version listener:', error);
        });

        return () => unsubscribe();
    }, []);

    // Track original cloud data to compare against current state
    const originalData = React.useRef<Partial<AppDataType>>({});
    // Flag to track if we are in the initial sync phase after login
    const isInitialSyncing = React.useRef(true);

    const markDirty = React.useCallback((field: keyof AppDataType, force: boolean = false) => {
        // Only mark dirty if it's NOT a remote update OR forced (manual user action)
        if (force || !isRemoteUpdate.current) {
            // Prevent infinite loops and unnecessary re-renders: Only update if NOT already dirty
            if (!dirtyFields.current.has(field)) {
                dirtyFields.current.add(field);
                setHasLocalChanges(true); // Enable Save button globally
                setDirtyVersion(v => v + 1); // Force re-render
            }
        }
    }, []);

    const unmarkDirty = React.useCallback((field: keyof AppDataType) => {
        if (dirtyFields.current.has(field)) {
            // console.log(`[DataContext] ⚪ Unmark Dirty: ${field}`);
            dirtyFields.current.delete(field);
            setHasLocalChanges(dirtyFields.current.size > 0);
            setDirtyVersion(v => v + 1); // Force re-render
        }
    }, []);

    // Track pending (uncommitted) changes for individual items in collections
    // Persisted to localStorage to survive page refreshes and protect manual edits
    const [persistedPendingMap, setPersistedPendingMap] = useLocalStorage<Record<string, string[]>>(
        getKey('pending-changes-map'),
        {
            students: [], subjects: [], classes: [], grades: [],
            assessments: [], scores: [], reportData: [], classData: [],
            users: [], settings: [],
        }
    );

    // Provide the 'Set' based interface the existing logic expects.
    // Converted to useRef to act as an Absolute Synchronous Source of Truth, preventing
    // stale closures when multiple edits happen rapidly on slow mobile devices.
    const pendingChangesMap = React.useRef<Record<string, Set<string>>>({
        students: new Set(), subjects: new Set(), classes: new Set(), grades: new Set(),
        assessments: new Set(), scores: new Set(), reportData: new Set(), classData: new Set(),
        users: new Set(), settings: new Set(),
    });

    // Keep the fast synchronous ref in sync with the persistent React state (handles hydration and cross-tab)
    useEffect(() => {
        Object.keys(persistedPendingMap).forEach(key => {
            const vals = persistedPendingMap[key as keyof typeof persistedPendingMap];
            if (Array.isArray(vals)) {
                pendingChangesMap.current[key] = new Set(vals);
            }
        });
    }, [persistedPendingMap]);

    const markItemDirty = React.useCallback((field: string, itemOrId: any) => {
        const id = typeof itemOrId === 'object' ? getItemId(itemOrId) : String(itemOrId);
        if (!id || id === 'undefined' || id === 'null') return;

        // Synchronously update the Set for immediate logic access
        if (!pendingChangesMap.current[field]) pendingChangesMap.current[field] = new Set();
        if (pendingChangesMap.current[field].has(id)) return;
        
        pendingChangesMap.current[field].add(id);

        // Collect ALL current sets into a single atomic full map
        const nextFullMap: Record<string, string[]> = {};
        Object.keys(pendingChangesMap.current).forEach(k => {
            nextFullMap[k] = Array.from(pendingChangesMap.current[k]);
        });
        
        // Update React State UI
        setPersistedPendingMap(nextFullMap);

        // Immediate Write-Through built purely from synchronous ref
        try {
            const jsonString = JSON.stringify(nextFullMap);
            const compressed = LZ.compress(jsonString);
            localStorage.setItem(getKey('pending-changes-map'), compressed);
        } catch (error) {
            if (isQuotaExhaustedError(error)) {
                showDatabaseError({
                    message: "Device storage is full. Your manual edits cannot be saved locally and may be lost on refresh.",
                    code: 'QUOTA_EXCEEDED'
                }, 'write');
            }
        }

        markDirty(field as keyof AppDataType, true);
    }, [setPersistedPendingMap, markDirty, showDatabaseError]);

    const markItemClean = React.useCallback((field: string, itemOrId: any) => {
        const id = typeof itemOrId === 'object' ? getItemId(itemOrId) : String(itemOrId);
        if (!id) return;

        // Synchronously update the Set
        if (pendingChangesMap.current[field]) {
            pendingChangesMap.current[field].delete(id);
        }

        // Collect atomic state
        const nextFullMap: Record<string, string[]> = {};
        Object.keys(pendingChangesMap.current).forEach(k => {
            nextFullMap[k] = Array.from(pendingChangesMap.current[k]);
        });

        // Update React State UI
        setPersistedPendingMap(nextFullMap);

        // Synchronous Write-Through
        try {
            const jsonString = JSON.stringify(nextFullMap);
            const compressed = LZ.compress(jsonString);
            localStorage.setItem(getKey('pending-changes-map'), compressed);
        } catch (error) {
            // Failsafe
        }

        if (pendingChangesMap.current[field]?.size === 0) {
            unmarkDirty(field as keyof AppDataType);
        }
    }, [setPersistedPendingMap, unmarkDirty]);

    const isItemDirty = React.useCallback((field: keyof AppDataType, id: string | number) => {
        const currentItems = stateRef.current[field];
        const originalItems = originalData.current[field];

        // CRITICAL PROTECTION: If originalItems is undefined, we haven't loaded the cloud version for this field yet.
        // Returning true here would trigger "Unsaved" tag before we even know the cloud state.
        if (originalItems === undefined) return false;

        if (!Array.isArray(currentItems) || !Array.isArray(originalItems)) return false;

        const currentItem = currentItems.find((item: any) => String(getItemId(item)) === String(id));
        if (!currentItem) return false;

        const originalItem = originalItems.find((item: any) => String(getItemId(item)) === String(id));

        // 1. If it's not in cloud baseline, it's a local-only item (Added)
        if (!originalItem) {
            const isMeaningful = isMeaningfulDiscrepancy(field, currentItem);
            if (isMeaningful) {
                console.log(`[DataContext] 🔍 isItemDirty(${field}, ${id}): LOCAL-ONLY & MEANINGFUL. Marking dirty.`);
            }
            return isMeaningful;
        }

        // 2. If it is in cloud, compare semantically
        const isEqual = isDataEqual(currentItem, originalItem);
        if (!isEqual) {
            const normCurrent = normalizeData(currentItem);
            const normOriginal = normalizeData(originalItem);
            
            // Log granular differences
            const diffs: string[] = [];
            const allKeys = new Set([...Object.keys(normCurrent || {}), ...Object.keys(normOriginal || {})]);
            allKeys.forEach(k => {
                if (!deepEqual(normCurrent?.[k], normOriginal?.[k])) {
                    diffs.push(`${k}: [${JSON.stringify(normOriginal?.[k])}] -> [${JSON.stringify(normCurrent?.[k])}]`);
                }
            });

            console.log(`[DataContext] 🔍 isItemDirty(${field}, ${id}): SEMANTIC DIFFERENCE FOUND.`, {
                differences: diffs,
                current: normCurrent,
                original: normOriginal
            });
        }
        return !isEqual;
    }, []);

    const isSettingDirty = React.useCallback((field: keyof SchoolSettings) => {
        if (!settings || !originalData.current.settings) return false;
        return !deepEqual(settings[field], originalData.current.settings[field]);
    }, [settings]);

    const isScoreDirty = React.useCallback((studentId: number, subjectId: number, assessmentId: number) => {
        const scoreId = `${studentId}-${subjectId}`;

        // 1. Check Draft Scores first (most immediate)
        const draftKey = `${studentId}-${subjectId}-${assessmentId}`;
        if (draftScores.current.has(draftKey)) return true;

        // 2. Check individual assessment within a "locally saved" score
        const existingScore = scores.find(s => s.id === scoreId);
        if (!existingScore) return false;

        const originalScore = originalData.current.scores?.find(s => String(s.id) === scoreId);
        if (!originalScore) {
            // If it's a completely new score item, it's dirty if it has any meaningful content
            const val = existingScore.assessmentScores?.[assessmentId];
            return val && Array.isArray(val) && val.some(v => v !== null && v !== undefined && String(v).trim() !== '');
        }

        const currentVal = existingScore.assessmentScores?.[assessmentId] || [];
        const originalVal = originalScore.assessmentScores?.[assessmentId] || [];

        return !deepEqual(currentVal, originalVal);
    }, [scores]);

    const isDraftScore = React.useCallback((studentId: number, subjectId: number, assessmentId: number) => {
        const draftKey = `${studentId}-${subjectId}-${assessmentId}`;
        return draftScores.current.has(draftKey);
    }, []);

    // FIX: Use a Ref to hold the latest state for saveToCloud to access during retries
    const stateRef = React.useRef<AppDataType>({
        settings, students, subjects, classes, grades, assessments, scores, reportData, classData, users, userLogs, activeSessions
    });

    useEffect(() => {
        stateRef.current = {
            settings,
            students,
            subjects,
            classes,
            grades,
            assessments,
            scores,
            reportData,
            classData,
            users,
            userLogs,
            activeSessions
        };
    }, [settings, students, subjects, classes, grades, assessments, scores, reportData, classData, users, userLogs, activeSessions]);

    // -------------------------------------------------------------------------
    // MOBILE RELIABILITY: Lifecycle & Persistence Guards
    // -------------------------------------------------------------------------
    
    // Pagehide Listener for Robust Tab Termination
    useEffect(() => {
        const handleForceBackup = () => {
            // Note: visibilityState === 'hidden' or 'pagehide' means the JavaScript
            // environment could be terminated at any moment on a mobile device.
            // We force a final, synchronous write-through for intentionality.
            console.log('[DataContext] 📱 Mobile Lifecycle event detected. Forcing immediate data backup...');
            
            try {
                // Force any active inputs to blur and commit their React state before we backup
                if (document.activeElement && 'blur' in document.activeElement) {
                    (document.activeElement as HTMLElement).blur();
                }

                // 1. Back up Pending Changes Map
                const mapData = JSON.stringify(persistedPendingMap);
                localStorage.setItem(getKey('pending-changes-map'), LZ.compress(mapData));
                
                // 2. Back up dirty fields (as a failsafe for reload comparison)
                const dirtySet = Array.from(dirtyFields.current);
                localStorage.setItem(getKey('dirty-fields-failsafe'), JSON.stringify(dirtySet));
            } catch (e) {
                // Silently fail in lifecycle hook to avoid blocking page transition
                console.error('[DataContext] Failed to backup during tab close:', e);
            }
        };

        window.addEventListener('beforeunload', handleForceBackup);
        window.addEventListener('pagehide', handleForceBackup);
        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') handleForceBackup();
        });
        
        return () => {
            window.removeEventListener('beforeunload', handleForceBackup);
            window.removeEventListener('pagehide', handleForceBackup);
        };
    }, [persistedPendingMap]);

    // Track last loaded collection timestamps to prevent redundant fetches
    const lastLoadedTimestamps = React.useRef<Record<string, any>>({});
    const inflightPromises = React.useRef<Map<string, Promise<any>>>(new Map());

    // loadImportedData relocated below to resolve TDZ issues

    // CRITICAL: When the Context (School, Year, or Term) changes, reset all state
    // to prevent legacy data from contaminating the new context.
    const lastContextKey = React.useRef<string | null>(null);
    React.useEffect(() => {
        const currentContextKey = `${schoolId}-${settings.academicYear}-${settings.academicTerm}`;

        // ONLY reset if it's a REAL context shift (remote load or saved change).
        // If the context changed but it's currently marked as DIRTY locally, skip reset.
        // This prevents data loss while typing a new Academic Year or Term.
        const isLocallyChangingContext = isSettingDirty('academicYear') || isSettingDirty('academicTerm');

        if (lastContextKey.current !== null && lastContextKey.current !== currentContextKey) {
            const lastSchoolId = lastContextKey.current.split('-')[0];
            const isSchoolSwitch = lastSchoolId !== schoolId;

            if (isLocallyChangingContext && !isSchoolSwitch) {
                console.log("[DataContext] Context shift detected but marked as local edit. Skipping reset during typing.");
                return;
            }

            console.log(`[DataContext] 🔄 ${isSchoolSwitch ? 'SCHOOL SWITCH' : 'Context'} Change Detected: ${lastContextKey.current} -> ${currentContextKey}. Resetting records.`);

            // 1. Reset collections, but PRESERVE global settings (District, Address, etc.)
            setStudents(INITIAL_STUDENTS);
            setSubjects(INITIAL_SUBJECTS);
            setClasses(INITIAL_CLASSES);
            setGrades(INITIAL_GRADES);
            setAssessments(INITIAL_ASSESSMENTS);
            setScores(INITIAL_SCORES);
            setReportData(INITIAL_REPORT_DATA);
            setClassData(INITIAL_CLASS_DATA);
            setUserLogs([]);
            setActiveSessions({});
            
            // 1b. If it was a SCHOOL switch, also reset settings to default
            // to ensure no cross-school logo/signature leakage before cloud load.
            if (isSchoolSwitch) {
                console.log("[DataContext] 🧹 School switch detected. Resetting shared settings...");
                setSettings(INITIAL_SETTINGS);
            }

            // 2. Clear tracking for collections, but NOT settings
            // This ensures if the user was typing a new Year, their 'settings' dirty mark stays!
            ['students', 'subjects', 'classes', 'grades', 'assessments', 'scores', 'reportData', 'classData', 'users'].forEach(field => {
                dirtyFields.current.delete(field as keyof AppDataType);
                if (pendingChangesMap.current[field]) {
                    pendingChangesMap.current[field].clear();
                }
            });

            setHasLocalChanges(dirtyFields.current.size > 0);
            draftScores.current.clear();
            setDraftVersion(0);
            
            // 3. Wipe baseline data to force a fresh cloud fetch comparison
            if (isSchoolSwitch) {
                // HARD RESET for new school: No baseline preservation
                originalData.current = {};
            } else {
                // Term/Year shift: Preserve global settings baseline (Logo, School Name, etc.)
                const settingsBaseline = originalData.current.settings;
                originalData.current = {
                    settings: settingsBaseline
                };
            }
            lastLoadedTimestamps.current = {};
        }
        lastContextKey.current = currentContextKey;
    }, [schoolId, settings.academicYear, settings.academicTerm, dirtyVersion]);

    // -------------------------------------------------------------------------
    // DIRTY FIELD TRACKING OPTIMIZATION
    // -------------------------------------------------------------------------
    // We track exactly which top-level keys in AppDataType have changed locally.
    // This allows us to only push modified data to Firestore, drastically reducing
    // write sizes and potential conflicts.
    const dirtyFields = React.useRef<Set<keyof AppDataType>>(new Set());

    /**
     * Determines if a discrepancy between local and cloud data is "meaningful".
     * A discrepancy is NOT meaningful if the local data is just the default initial state.
     */
    const isMeaningfulDiscrepancy = (field: keyof AppDataType, local: any): boolean => {
        // Define initial states for comparison
        const initialStates: Partial<Record<keyof AppDataType, any>> = {
            settings: INITIAL_SETTINGS,
            students: INITIAL_STUDENTS,
            subjects: INITIAL_SUBJECTS,
            classes: INITIAL_CLASSES,
            grades: INITIAL_GRADES,
            assessments: INITIAL_ASSESSMENTS,
            scores: INITIAL_SCORES,
            reportData: INITIAL_REPORT_DATA,
            classData: INITIAL_CLASS_DATA,
            users: [],
            userLogs: [],
            activeSessions: {}
        };

        const initialState = initialStates[field];

        let isDefault = false;
        
        // If the initial state is an array, compare against the specific item with matching ID
        if (Array.isArray(initialState)) {
            const localId = getItemId(local);
            const initialItem = initialState.find((item: any) => String(getItemId(item)) === String(localId));
            if (initialItem) {
                isDefault = isDataEqual(local, initialItem);
            } else {
                // If the item isn't in the initial state array, it's definitely a meaningful addition
                isDefault = false;
            }
        } else {
            // If the initial state is not an array (e.g., settings), compare the entire object
            isDefault = isDataEqual(local, initialState);
        }

        if (isDefault) {
            // console.log(`[DataContext] 🔍 isMeaningfulDiscrepancy(${field}): Item matches INITIAL STATE. Not meaningful.`);
            return false;
        }

        // Logic refined: if it's NOT default, and we are calling this, it's likely a real change
        // compared to whatever the cloud baseline is.
        return true;
    };

    // Keep stateRef in sync with latest state for save operations
    useEffect(() => {
        stateRef.current = {
            settings, students, subjects, classes, grades, assessments, scores, reportData, classData, users, userLogs, activeSessions
        };
    }, [settings, students, subjects, classes, grades, assessments, scores, reportData, classData, users, userLogs, activeSessions]);



    /**
     * Smart Merge Helper: Reconciles an incoming cloud collection with the local state.
     * Prioritizes cloud truth unless an item is explicitly marked as "dirty" (manually edited).
     */
    const reconcileCollection = React.useCallback((field: keyof AppDataType, cloudItems: any[], localItems: any[]): any[] => {
        if (!Array.isArray(cloudItems)) return localItems || [];
        if (!Array.isArray(localItems)) return cloudItems || [];

        const cloudIds = new Set(cloudItems.map(item => String(getItemId(item))));
        const dirtyIds = pendingChangesMap.current[field] || new Set<string>();

        // 1. Ghost Deletion Guard: Check if cloud is suspiciously smaller than local
        // This prevents mass data loss if a network request returns a partial array.
        const isSuspiciousDeletion = cloudItems.length < localItems.length * 0.5 && localItems.length > 5;
        if (isSuspiciousDeletion) {
            console.warn(`[DataContext] ⚠️ Ghost Deletion Guard triggered for ${field}. Cloud: ${cloudItems.length}, Local: ${localItems.length}. Merging instead of discarding.`);
            const mergedMap = new Map(localItems.map(item => [String(getItemId(item)), item]));
            cloudItems.forEach(item => mergedMap.set(String(getItemId(item)), item));
            return Array.from(mergedMap.values());
        }

        // 2. Reconciliation Loop: Re-anchor local edits or adopt cloud truth
        const reconciled = cloudItems.map(cloudItem => {
            const id = String(getItemId(cloudItem));
            const isDirty = dirtyIds.has(id);
            const localVersion = localItems.find(l => String(getItemId(l)) === id);

            if (isDirty && localVersion) {
                // VALUE-AWARE RE-ANCHORING: If local edit now matches cloud truth, clear dirty flag
                if (isDataEqual(localVersion, cloudItem)) {
                    console.log(`[DataContext] ⚓ Re-anchoring ${field}:${id}: Local edit now matches Cloud. Item is clean.`);
                    dirtyIds.delete(id);
                    if (dirtyIds.size === 0) unmarkDirty(field);
                    return cloudItem;
                }
                // console.log(`[DataContext] 🛡️ Preservation: Keeping local version of ${field}:${id}`);
                return localVersion;
            }
            return cloudItem;
        });

        // 3. New Local Additions: Keep local-only items if they are marked dirty
        const localOnly = localItems.filter(localItem => {
            const id = String(getItemId(localItem));
            return !cloudIds.has(id) && dirtyIds.has(id);
        });

        if (dirtyIds.size > 0 || localOnly.length > 0) {
            console.log(`[DataContext] ⚒️ Reconciled ${field}: cloud=${cloudItems.length}, local=${localItems.length}, preserved=${dirtyIds.size} edits, kept=${localOnly.length} local-only`);
        }

        return [...reconciled, ...localOnly];
    }, [isDataEqual, unmarkDirty, pendingChangesMap]);

    // Fields managed exclusively by their own subcollection listeners.
    // These must NEVER be marked dirty by recheckDirtyStatus during a remote update,
    // because the mismatch is transient (listener hasn't settled yet) not a real local edit.
    const SUBCOLLECTION_FIELDS = new Set<keyof AppDataType>(['grades', 'classes', 'subjects', 'assessments', 'students']);

    // Check if current data actually differs from original cloud data
    const recheckDirtyStatus = React.useCallback((field: keyof AppDataType, currentValue: any, force: boolean = false) => {
        const originalValue = originalData.current[field];

        // CRITICAL: If originalValue is undefined, we haven't loaded the cloud version for this field yet.
        // In this case, we cannot safely say the field is "dirty" compared to the cloud.
        if (originalValue === undefined) return;

        // SAFETY: If a remote update is in progress, never mark ANY fields as dirty.
        // The listener updates originalData atomically, so any transient mismatch seen here
        // (like closure lag from batching) is a React batch artifact, not a real local change.
        // BUT: If force is true (e.g., we explicitly call this after a fetch), we allow the check to run
        // so that dirty flags can be cleared if the new cloud data matches our state.
        if (isRemoteUpdate.current && !force) return;

        const isEqual = isDataEqual(currentValue, originalValue);

        // If values are the same, remove from dirty
        if (isEqual) {
            if (dirtyFields.current.has(field)) {
                dirtyFields.current.delete(field);
                // Update hasLocalChanges based on remaining dirty fields
                setHasLocalChanges(dirtyFields.current.size > 0 || Array.from(draftScores.current.values()).length > 0);
                setDirtyVersion(v => v + 1); // Force re-render
            }
        } else {
            // Values differ - only mark dirty if NOT a remote update.
            if (!isRemoteUpdate.current) {
                markDirty(field, true);
            }
        }
    }, [markDirty]);

    const rebuildItemDirtyMap = React.useCallback((dataOverride?: Partial<AppDataType>) => {
        // If dataOverride is passed, only check the keys present in dataOverride.
        // Otherwise, check all collections.
        const collectionsToCheck = dataOverride 
            ? (Object.keys(dataOverride) as (keyof AppDataType)[]).filter(k => 
                ['students', 'subjects', 'classes', 'grades', 'assessments', 'reportData', 'classData'].includes(k)
              )
            : ['students', 'subjects', 'classes', 'grades', 'assessments', 'reportData', 'classData'] as (keyof AppDataType)[];

        let anyMapChanged = false;
        const newMapState = { ...persistedPendingMap };

        collectionsToCheck.forEach(field => {
            const current = dataOverride?.[field] !== undefined ? dataOverride[field] : stateRef.current[field];
            const original = originalData.current[field];

            if (!Array.isArray(current) || !Array.isArray(original)) return;

            const currentDirtyIds = new Set<string>();
            current.forEach((item: any) => {
                const itemId = getItemId(item);
                if (!itemId) return;
                const origItem = original.find((o: any) => getItemId(o) === itemId);

                if (!origItem || !isDataEqual(item, origItem)) {
                    // ATOMIC SANITIZATION: If both the cloud and local state agree the item is soft-deleted,
                    // silently evict it from the pending changes map. 
                    // This prevents Firestore Security Rules from rejecting an unnecessary 'deleted: true' update.
                    const origAny = origItem as any;
                    const itemAny = item as any;
                    if (origAny && origAny.deleted === true && itemAny.deleted === true) {
                        return; // Skip adding to currentDirtyIds (Silently drop)
                    }
                    currentDirtyIds.add(itemId);
                }
            });

            const prevDirtyIds = persistedPendingMap[field as string] || [];
            if (!isDataEqual(Array.from(currentDirtyIds).sort(), [...prevDirtyIds].sort())) {
                newMapState[field as string] = Array.from(currentDirtyIds);
                anyMapChanged = true;
            }
        });

        // 2. Settings (Non-array granular tracking)
        const checkSettings = !dataOverride || ('settings' in dataOverride);
        if (checkSettings) {
            const currentSettings = dataOverride?.settings !== undefined ? dataOverride.settings : stateRef.current.settings;
            const originalSettings = originalData.current.settings;
            if (currentSettings && originalSettings) {
                 const currentDirtyKeys: string[] = [];
                 Object.keys(currentSettings).forEach(key => {
                     const k = key as keyof SchoolSettings;
                     if (!deepEqual(currentSettings[k], originalSettings[k])) {
                         currentDirtyKeys.push(key);
                     }
                 });

                 const prevDirtyKeys = persistedPendingMap.settings || [];
                 if (!isDataEqual(currentDirtyKeys.sort(), [...prevDirtyKeys].sort())) {
                     newMapState.settings = currentDirtyKeys;
                     anyMapChanged = true;
                 }
            }
        }

        if (anyMapChanged) {
            setPersistedPendingMap(newMapState);
            setDirtyVersion(v => v + 1);
            
            // PERSISTENCE SYNC: Immediately update localStorage with the sanitized map
            // to prevent the deleted items from re-appearing on the next refresh/load out of sync.
            try {
                const mapData = JSON.stringify(newMapState);
                localStorage.setItem(getKey('pending-changes-map'), LZ.compress(mapData));
            } catch (e) {
                console.error("[DataContext] Could not sync sanitized map to localStorage", e);
            }
        }
    }, [isDataEqual, persistedPendingMap, setPersistedPendingMap]);

    const recheckAllDirtyStatus = React.useCallback((dataOverride?: Partial<AppDataType>) => {
        console.log('[DataContext] 🔍 Performing full dirty recheck against cloud baseline...');
        const fieldsToCheck: (keyof AppDataType)[] = [
            'settings', 'students', 'subjects', 'classes', 'grades', 'assessments',
            'scores', 'reportData', 'classData', 'userLogs', 'activeSessions'
        ];

        for (const field of fieldsToCheck) {
            const val = dataOverride?.[field] !== undefined ? dataOverride[field] : stateRef.current[field];
            // If dataOverride is provided, we FORCE the recheck to ensure flags are cleared after a load
            recheckDirtyStatus(field, val, !!dataOverride);
        }

        // Also rebuild item-level map
        rebuildItemDirtyMap(dataOverride);
    }, [recheckDirtyStatus, rebuildItemDirtyMap]);

// loadImportedData relocated below

    // Split monolithic useEffect into fine-grained reactive effects for each collection
    React.useEffect(() => {
        if (!originalData.current.settings) return;
        recheckDirtyStatus('settings', settings);
        rebuildItemDirtyMap({ settings });
    }, [settings, recheckDirtyStatus, rebuildItemDirtyMap]);

    React.useEffect(() => {
        if (originalData.current.students === undefined) return;
        recheckDirtyStatus('students', students);
        rebuildItemDirtyMap({ students });
    }, [students, recheckDirtyStatus, rebuildItemDirtyMap]);

    React.useEffect(() => {
        if (originalData.current.subjects === undefined) return;
        recheckDirtyStatus('subjects', subjects);
        rebuildItemDirtyMap({ subjects });
    }, [subjects, recheckDirtyStatus, rebuildItemDirtyMap]);

    React.useEffect(() => {
        if (originalData.current.classes === undefined) return;
        recheckDirtyStatus('classes', classes);
        rebuildItemDirtyMap({ classes });
    }, [classes, recheckDirtyStatus, rebuildItemDirtyMap]);

    React.useEffect(() => {
        if (originalData.current.grades === undefined) return;
        recheckDirtyStatus('grades', grades);
        rebuildItemDirtyMap({ grades });
    }, [grades, recheckDirtyStatus, rebuildItemDirtyMap]);

    React.useEffect(() => {
        if (originalData.current.assessments === undefined) return;
        recheckDirtyStatus('assessments', assessments);
        rebuildItemDirtyMap({ assessments });
    }, [assessments, recheckDirtyStatus, rebuildItemDirtyMap]);

    React.useEffect(() => {
        if (originalData.current.scores === undefined) return;
        recheckDirtyStatus('scores', scores);
        rebuildItemDirtyMap({ scores });
    }, [scores, recheckDirtyStatus, rebuildItemDirtyMap]);

    React.useEffect(() => {
        if (originalData.current.reportData === undefined) return;
        recheckDirtyStatus('reportData', reportData);
        rebuildItemDirtyMap({ reportData });
    }, [reportData, recheckDirtyStatus, rebuildItemDirtyMap]);

    React.useEffect(() => {
        if (originalData.current.classData === undefined) return;
        recheckDirtyStatus('classData', classData);
        rebuildItemDirtyMap({ classData });
    }, [classData, recheckDirtyStatus, rebuildItemDirtyMap]);

    // AUTO-SYNC REMOVED: All saves are now manual and page-specific

    // Listeners state to prevent double-subscription
    const activeListeners = React.useRef<Record<string, () => void>>({});

    useEffect(() => {
        if (!schoolId || !isSessionUnlocked) {
            // Cleanup on school change or logout
            Object.values(activeListeners.current).forEach((unsub: any) => unsub());
            activeListeners.current = {};
            return;
        }

        console.log(`[DataContext] 🛰️ Setting up True Listeners for ${schoolId}...`);

        const setupListener = (key: string, collectionRef: any, stateSetter: (data: any) => void) => {
            if (activeListeners.current[key]) return;

            activeListeners.current[key] = onSnapshot(collectionRef, (snapshot) => {
                // Ignore local optimistic updates to prevent jitter/loops
                if (snapshot.metadata.hasPendingWrites) return;

                const data = snapshot.docs ? snapshot.docs.map(doc => doc.data()) : snapshot.data();
                if (!data) return;

                console.log(`[DataContext] 📥 Real-time update for ${key}`);
                
                // IMPORTANT: We bypass local dirty protection here. If we skip updating the UI 
                // state but the main doc listener updates originalData (or vice versa), it causes 
                // a "Baseline Lag" that results in a massive Reversal pending payload.
                // We purposefully prioritize cloud consistency here without returning early.

                // Mark as remote update to prevent loopback marking it dirty
                isRemoteUpdate.current = true;
                
                // 1. ATOMIC BASELINE SYNC: Update baseline FIRST before React queue
                // This forces RecheckAllDirtyStatus to instantly compare the new baseline
                if (originalData.current) {
                    originalData.current[key as keyof AppDataType] = Array.isArray(data) ? [...data] : {...data} as any;
                }

                // 2. Queue UI React State update
                stateSetter(data);

                // FORCE UNMARK: Ensure it is not falsely added to pending saves due to React batches
                unmarkDirty(key as keyof AppDataType);
                
                setTimeout(() => { isRemoteUpdate.current = false; }, 1000);
            }, (error) => {
                console.error(`[DataContext] ❌ Listener error for ${key}:`, error);
            });
        };

        // 1. School Main Doc (Settings, Access, etc.)
        const schoolRef = doc(db, "schools", schoolId);
        activeListeners.current['main'] = onSnapshot(schoolRef, (snapshot) => {
            if (snapshot.metadata.hasPendingWrites) return;
            const data = snapshot.data();
            if (data) {
                console.log(`[DataContext] 📥 Real-time update for School Main Doc`);
                isRemoteUpdate.current = true;

                // CRITICAL FIX: Strip out subcollection-managed fields before processing.
                // grades, classes, subjects, assessments are managed by their own dedicated
                // per-collection onSnapshot listeners. If we let the main doc pass these
                // (potentially stale or legacy) fields into loadImportedData, it overwrites
                // originalData.current with stale/deleted items, causing the dirty-tracking
                // system to perpetually flag those collections as "pending save", ultimately
                // causing permission-denied errors when the save payload includes deleted items.
                const { grades: _g, classes: _c, subjects: _s, assessments: _a, students: _st, scores: _sc, reportData: _rd, classData: _cd, ...mainDocData } = data;

                // ATOMIC BASELINE SYNC: Instantly force the baseline to match the incoming main doc data
                // before loadImportedData captures closure state. This stops the async batch lag.
                Object.entries(mainDocData).forEach(([key, val]) => {
                    const validKey = key as keyof AppDataType;
                    // Protect locally typed/unsaved settings from sudden clobbering, but sync otherwise
                    if (originalData.current && val !== undefined && !dirtyFields.current.has(validKey)) {
                        originalData.current[validKey] = Array.isArray(val) ? [...val] : JSON.parse(JSON.stringify(val));
                    }
                });

                loadImportedData(mainDocData, true);
                if (data.metadata?.lastUpdated) {
                    lastLoadedTimestamps.current = { ...data.metadata.lastUpdated };
                }
                setTimeout(() => { isRemoteUpdate.current = false; }, 1000);
            }
        });

        // 2. Subcollections
        const SUBCOLLECTIONS = [
            { key: 'students', ref: collection(db, "schools", schoolId, "students") },
            { key: 'classes', ref: collection(db, "schools", schoolId, "classes") },
            { key: 'subjects', ref: collection(db, "schools", schoolId, "subjects") },
            { key: 'assessments', ref: collection(db, "schools", schoolId, "assessments") },
            { key: 'grades', ref: collection(db, "schools", schoolId, "grades") }
        ];

        SUBCOLLECTIONS.forEach(sub => {
            setupListener(sub.key, sub.ref, (data) => {
                const setterMap: Record<string, any> = {
                    students: setStudents,
                    classes: setClasses,
                    subjects: setSubjects,
                    assessments: setAssessments,
                    grades: setGrades
                };
                if (setterMap[sub.key]) setterMap[sub.key](data);
            });
        });

        return () => {
            console.log(`[DataContext] 🛑 Cleaning up listeners for ${schoolId}`);
            Object.values(activeListeners.current).forEach((unsub: any) => unsub());
            activeListeners.current = {};
        };
    }, [schoolId, isSessionUnlocked]);

    const saveToCloud = async (isManualSave: boolean = false, skipRefresh: boolean = false) => {
        // Manual save triggered

        // CRITICAL: Don't sync if user was active very recently (within last 500ms)
        // This prevents syncing mid-keystroke or mid-interaction
        // DISABLED: Old strict debounce logic replaced by 10s idle timer
        /*
        const timeSinceLastUpdate = Date.now() - lastLocalUpdate.current;
        if (timeSinceLastUpdate < 500) {
            console.log(`User actively working (${timeSinceLastUpdate}ms ago), postponing sync`);
            // Reschedule the sync for later
            setTimeout(() => saveToCloud(), 1000);
            return;
        }
        */

        // ---------------------------------------------------------------------
        // NEW LOGIC: Commit all "active typing" drafts before saving
        // ---------------------------------------------------------------------
        if (draftScores.current.size > 0) {
            console.log(`[DataContext] 📝 Committing ${draftScores.current.size} draft scores before cloud save...`);
            draftScores.current.forEach((value, key) => {
                const [studentId, subjectId, assessmentId] = key.split('-').map(Number);
                // We use updateStudentScores which handles the markDirty logic and state updates
                // Note: newScores expects string[]
                updateStudentScores(studentId, subjectId, assessmentId, [value]);
            });
            // Clear drafts as they are now committed to the main state
            draftScores.current.clear();
            setDraftVersion(v => v + 1);
        }

        if (dirtyFields.current.size === 0) {
            console.log('[DataContext] 💤 No dirty fields to sync. Skipping save.');
            return;
        }

        const fieldsToSave = Array.from(dirtyFields.current);
        console.log(`[DataContext] ☁️ Syncing dirty fields: ${fieldsToSave.join(', ')} (Manual Save)`);

        // Capture CURRENT state at sync time (not stale state from when timeout started)
        SyncLogger.log(`saveToCloud: Preparing to save. Users count: ${users.length}`);

        const currentData = stateRef.current;

        // CRITICAL: Log warning if saving empty users array
        if (fieldsToSave.includes('users') && users.length === 0 && schoolId) {
            SyncLogger.log(`WARNING: Attempting to save with empty users array. This may indicate an issue.`);
            console.warn('[DataContext] Saving with empty users array - this should only happen for new school accounts');
        }

        // Use standard helper to generate payload (Ensures consistency with savePageData)
        // This handles smart diffing, deletions, and logic for all fields.
        const pendingData = getPendingUploadData();
        const transactionDeletions = pendingData._deletions || {};
        // Remove _deletions from payload
        const { _deletions, ...transactionPayload } = pendingData;

        // FIX: Arrays on the main document or metadata bundle are completely overwritten by Firebase merge.
        // If they are in the payload (meaning they have changes), we MUST send the FULL array.
        const FULL_ARRAY_KEYS = ['reportData', 'classData', 'users', 'userLogs', 'subjects', 'classes', 'assessments', 'grades'];
        FULL_ARRAY_KEYS.forEach(k => {
            if (transactionPayload[k] !== undefined || dirtyFields.current.has(k as keyof AppDataType)) {
                transactionPayload[k] = currentData[k as keyof AppDataType];
            }
        });

        // Check network status
        if (!isOnline) {
            console.log("Offline - adding to queue");
            // Offline queue fallback
            const fullPayload: Partial<AppDataType> = {};
            fieldsToSave.forEach(field => {
                const key = field as keyof AppDataType;
                (fullPayload as any)[key] = currentData[key];
            });

            offlineQueue.addToQueue(fullPayload);
            setQueuedCount(offlineQueue.getQueueSize());
            return;
        }

        try {
            isSyncingRef.current = true;
            setIsSyncing(true);

            // FIX: Check for EITHER updates OR deletions.
            // Previously, if we only had deletions (no updates), this block was skipped!
            if (Object.keys(transactionPayload).length > 0 || (transactionDeletions && Object.keys(transactionDeletions).length > 0)) {
                console.log('[DataContext] ☁️ Performing Universal Transactional Save...');
                SyncLogger.log(`Universal Transactional Save started for ${schoolId}`);
                
                // Uses the new generalized transaction helper
                await saveDataTransaction(schoolId, transactionPayload, transactionDeletions, stateRef.current.students);
                console.log('[DataContext] ✅ Data saved to cloud successfully!');
            } else {
                console.log('[DataContext] ℹ️ No actionable updates or deletions found for transaction.');
            }

            // OPTIMIZED: Skip refresh if we already have the data locally and just saved it.
            // This prevents the redundant "Get" immediately after "Create/Update".
            // The local state and originalData are already updated below.
            if (!skipRefresh && isManualSave && false) { // DISABLED: Trust local state + originalData sync below.
                console.log('[DataContext] 🔄 Auto-refreshing data from cloud (Granular)...');
                const fieldsToRefresh = fieldsToSave as (keyof AppDataType)[];
                await refreshFromCloud(true, fieldsToRefresh);
            } else {
                console.log('[DataContext] ⏭️ Skipping redundant re-fetch - Local state is synced (Optimized)');
            }

            console.log('[DataContext] 🎉 Sync & Refresh complete - cleared dirty fields');

            // Clear dirty fields only for the fields that were actually saved
            fieldsToSave.forEach(field => {
                dirtyFields.current.delete(field);
                
                // Post-Save Handshake: Persist clearing of dirty map
                setPersistedPendingMap(prev => ({
                    ...prev,
                    [field as string]: []
                }));

                // Synchronously clear the Set map
                if (pendingChangesMap.current[field]) {
                    pendingChangesMap.current[field].clear();
                }

                // CRITICAL: Update originalData to match the new server state
                // This prevents the "Preview" from showing these items as changed in future saves
                const key = field as keyof AppDataType;
                
                // CRITICAL: Update originalData to match the new server state.
                // We use deep cloning to ensure the baseline is completely independent.
                try {
                    const dataToClone = currentData[key];
                    if (dataToClone !== undefined) {
                        originalData.current[key] = JSON.parse(JSON.stringify(dataToClone));
                    }
                } catch (e) {
                    console.warn(`[DataContext] ⚠️ Failed to deep clone baseline for ${key}:`, e);
                    // Fallback to shallow clone
                    const dataToClone = currentData[key];
                    if (Array.isArray(dataToClone)) {
                        originalData.current[key] = [...dataToClone] as any;
                    } else if (dataToClone && typeof dataToClone === 'object') {
                        originalData.current[key] = { ...dataToClone as any } as any;
                    }
                }

                // Update the "Last Loaded" metadata timestamp to match the new server state.
                if (lastLoadedTimestamps.current[key]) {
                    lastLoadedTimestamps.current[`_loaded_${String(key)}`] = lastLoadedTimestamps.current[key];
                }
            });

            // Update hasLocalChanges based on remaining dirty fields
            setHasLocalChanges(dirtyFields.current.size > 0);

            // Explicitly clear pending changes maps
            fieldsToSave.forEach(field => {
                if (pendingChangesMap.current[field]) pendingChangesMap.current[field].clear();
            });
            setDirtyVersion(v => v + 1);

            setIsSyncing(false);
            isSyncingRef.current = false;
        } catch (error) {
            console.error('[DataContext] ❌ Failed to save data to cloud:', error);

            // Show database error modal for critical errors
            showDatabaseError(error, 'write');

            // FIX: Don't add to offline queue if it's a permanent error like Quota Exceeded or Permission Denied
            if (isQuotaExhaustedError(error) || error?.code === 'permission-denied' || error?.message?.includes('permission-denied')) {
                console.log('[DataContext] 🚫 Not adding to offline queue - Error is permanent (Quota/Permission)');
                setIsSyncing(false);
                isSyncingRef.current = false;
                return;
            }

            console.log('[DataContext] 📦 Adding to offline queue for retry when online');
            // Re-construct full payload for queue fallback
            const fullPayload: Partial<AppDataType> = {};
            fieldsToSave.forEach(field => {
                // @ts-ignore
                fullPayload[field] = currentData[field];
            });

            offlineQueue.addToQueue(fullPayload);
            setQueuedCount(offlineQueue.getQueueSize());
            setIsSyncing(false);
            isSyncingRef.current = false;
        }
    };

    // Throttling Ref
    const lastGlobalRefresh = React.useRef<number>(0);

    // refreshFromCloud relocated below

    // Track initial mount to prevent auto-save before data is loaded from cloud
    const isInitialMount = React.useRef(true);

    // AUTO-SYNC REMOVED: All saves are now manual via page-specific save buttons

    // Helper to wrap state setters with dirty marking
    const createCrud = <T extends { id: number }>(
        items: T[],
        setItems: React.Dispatch<React.SetStateAction<T[]>>,
        fieldKey: keyof AppDataType
    ) => ({
        add: (item: Omit<T, 'id'>) => {
            markDirty(fieldKey, true);
            // Ignore legacy timestamp IDs when calculating next sequential ID
            const sequentialIds = items.map(i => typeof i.id === 'number' ? i.id : 0).filter(id => id < 1000000);
            const maxId = sequentialIds.length > 0 ? Math.max(...sequentialIds) : 0;
            const newId = maxId + 1;
            markItemDirty(fieldKey as string, newId);
            setItems(prev => [...prev, { ...item, id: newId, _isLocallyCreated: true } as unknown as T]);
            return newId;
        },
        update: (updatedItem: T) => {
            markDirty(fieldKey, true);
            markItemDirty(fieldKey as string, updatedItem.id);
            setItems(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
        },
        delete: (id: number) => {
            markDirty(fieldKey, true);
            markItemDirty(fieldKey as string, id);
            // SOFT DELETE: Mark as deleted instead of filtering
            setItems(prev => prev.map(item => item.id === id ? { 
                ...item, 
                deleted: true, 
                deletedAt: new Date().toISOString(),
                deletedBy: Number(localStorage.getItem('sba_user_id') || localStorage.getItem('emulator-sba_user_id'))
            } as unknown as T : item));
        },
    });

    const studentCrud = createCrud(students, setStudents, 'students');
    const subjectCrud = createCrud(subjects, setSubjects, 'subjects');
    const classCrud = createCrud(classes, setClasses, 'classes');
    const gradeCrud = createCrud(grades, setGrades, 'grades');

    // Wrapped student CRUD that also updates the student bucket on changes
    const addStudent = (student: Omit<Student, 'id'>) => {
        markDirty('students', true);
        const sequentialIds = students.map(i => typeof i.id === 'number' ? i.id : 0).filter(id => id < 1000000);
        const maxId = sequentialIds.length > 0 ? Math.max(...sequentialIds) : 0;
        const newId = maxId + 1;
        
        markItemDirty('students', newId);
        setStudents(prev => {
            const newItem = { ...student, id: newId, _isLocallyCreated: true } as Student;
            return [...prev, newItem];
        });
        return newId;
    };

    const updateStudent = (updatedStudent: Student) => {
        markDirty('students', true);
        markItemDirty('students', updatedStudent.id);
        setStudents(prev => {
            const next = prev.map(item => item.id === updatedStudent.id ? updatedStudent : item);
            return next;
        });
    };

    const deleteStudent = (id: number) => {
        console.log(`[DELETE DEBUG] deleteStudent called for ID: ${id}`);
        markDirty('students', true);
        markItemDirty('students', id);
        setStudents(prev => {
            // SOFT DELETE: Mark as deleted instead of filtering
            const next = prev.map(item => item.id === id ? { 
                ...item, 
                deleted: true, 
                deletedAt: new Date().toISOString(),
                deletedBy: Number(localStorage.getItem('sba_user_id') || localStorage.getItem('emulator-sba_user_id'))
            } : item);
            console.log(`[DELETE DEBUG] student ${id} marked as deleted. Total count (including deleted): ${next.length}`);
            return next;
        });
    };

    // Custom Assessment CRUD to handle exam ordering
    const addAssessment = (assessment: Omit<Assessment, 'id'>) => {
        markDirty('assessments', true);
        const newId = Date.now();
        markItemDirty('assessments', newId);
        const newAssessment = { ...assessment, id: newId, _isLocallyCreated: true } as Assessment;
        setAssessments(prev => {
            const examIndex = prev.findIndex(a => a.name.toLowerCase().includes('exam'));
            if (examIndex !== -1) {
                const newAssessments = [...prev];
                newAssessments.splice(examIndex, 0, newAssessment); // Insert before the exam
                return newAssessments;
            }
            return [...prev, newAssessment]; // Otherwise, append
        });
        return newId;
    };
    const updateAssessment = (updatedAssessment: Assessment) => {
        markDirty('assessments', true);
        markItemDirty('assessments', updatedAssessment.id);
        setAssessments(prev => prev.map(item => item.id === updatedAssessment.id ? updatedAssessment : item));
    };
    const deleteAssessment = (id: number) => {
        markDirty('assessments', true);
        markItemDirty('assessments', id);
        setAssessments(prev => prev.map(item => item.id === id ? { 
            ...item, 
            deleted: true, 
            deletedAt: new Date().toISOString(),
            deletedBy: Number(localStorage.getItem('sba_user_id') || localStorage.getItem('emulator-sba_user_id'))
        } : item));
    };

    // Wrapped subject CRUD that also updates the metadata bundle on changes
    const addSubject = (subject: Omit<Subject, 'id'>) => {
        markDirty('subjects', true);
        const sequentialIds = subjects.map(i => typeof i.id === 'number' ? i.id : 0).filter(id => id < 1000000);
        const maxId = sequentialIds.length > 0 ? Math.max(...sequentialIds) : 0;
        const newId = maxId + 1;
        
        markItemDirty('subjects', newId);
        setSubjects(prev => {
            const newItem = { ...subject, id: newId, _isLocallyCreated: true } as Subject;
            return [...prev, newItem];
        });
        return newId;
    };

    const updateSubject = (updatedSubject: Subject) => {
        markDirty('subjects', true);
        markItemDirty('subjects', updatedSubject.id);
        setSubjects(prev => {
            const next = prev.map(item => item.id === updatedSubject.id ? updatedSubject : item);
            return next;
        });
    };

    const deleteSubject = (id: number) => {
        markDirty('subjects', true);
        markItemDirty('subjects', id);
        setSubjects(prev => prev.map(item => item.id === id ? { 
            ...item, 
            deleted: true, 
            deletedAt: new Date().toISOString(),
            deletedBy: Number(localStorage.getItem('sba_user_id') || localStorage.getItem('emulator-sba_user_id'))
        } : item));
    };

    // Wrapped class CRUD that also updates the metadata bundle on changes
    const addClass = (cls: Omit<Class, 'id'>) => {
        markDirty('classes', true);
        const sequentialIds = classes.map(i => typeof i.id === 'number' ? i.id : 0).filter(id => id < 1000000);
        const maxId = sequentialIds.length > 0 ? Math.max(...sequentialIds) : 0;
        const newId = maxId + 1;
        
        markItemDirty('classes', newId);
        setClasses(prev => {
            const newItem = { ...cls, id: newId, _isLocallyCreated: true } as Class;
            return [...prev, newItem];
        });
        return newId;
    };

    const updateClass = (updatedClass: Class) => {
        markDirty('classes', true);
        markItemDirty('classes', updatedClass.id);
        setClasses(prev => {
            const next = prev.map(item => item.id === updatedClass.id ? updatedClass : item);
            return next;
        });
    };

    const deleteClass = (id: number) => {
        markDirty('classes', true);
        markItemDirty('classes', id);
        setClasses(prev => prev.map(item => item.id === id ? { 
            ...item, 
            deleted: true, 
            deletedAt: new Date().toISOString(),
            deletedBy: Number(localStorage.getItem('sba_user_id') || localStorage.getItem('emulator-sba_user_id'))
        } : item));
    };

    const restoreDefaultGrades = () => {
        markDirty('grades', true);
        // Clear old items from dirty map (optional but cleaner)
        grades.forEach(g => markItemClean('grades', g.id));

        // Apply initial grades
        setGrades(INITIAL_GRADES);

        // Mark all as dirty so they show as "Add/Update" in preview
        INITIAL_GRADES.forEach(g => {
            // Tag with _isLocallyCreated so they pass the zombie check if they were deleted on server
            (g as any)._isLocallyCreated = true;
            markItemDirty('grades', String(g.id));
        });

        console.log(`[DataContext] ♻️ Restored ${INITIAL_GRADES.length} system default grades`);
    };

    const updateStudentScores = (studentId: number, subjectId: number, assessmentId: number, newScores: string[]) => {
        const scoreId = `${studentId}-${subjectId}`;

        // FIX: Check if scores actually changed to prevent false dirty flags
        const existingScore = scores.find(s => s.id === scoreId);
        const currentScores = existingScore?.assessmentScores?.[assessmentId] || [];

        if (deepEqual(currentScores, newScores)) {
            return;
        }

        // SMART DIRTY CHECK
        const originalScore = originalData.current.scores?.find(s => String(s.id) === scoreId);
        const originalAssessmentScores = originalScore?.assessmentScores?.[assessmentId] || [];
        const isActuallyChanged = !deepEqual(newScores, originalAssessmentScores);

        if (isActuallyChanged) {
            markItemDirty('scores', scoreId);
        } else {
            markItemClean('scores', scoreId);

            // Re-verify if any OTHER assessments in this score are still dirty
            // This is more thorough than just deleting from a set
            const hasOtherDirtyAssessments = Object.entries(existingScore?.assessmentScores || {}).some(([id, val]) => {
                if (Number(id) === assessmentId) return false;
                const origVal = originalScore?.assessmentScores?.[id] || [];
                return !deepEqual(val, origVal);
            });

            if (!hasOtherDirtyAssessments) {
                markItemClean('scores', scoreId);
            }
        }

        setScores(prevScores => {
            const existingScoreIndex = prevScores.findIndex(s => s.id === scoreId);
            let updatedScores;

            if (existingScoreIndex > -1) {
                updatedScores = prevScores.map((score, index) => {
                    if (index === existingScoreIndex) {
                        return {
                            ...score,
                            assessmentScores: {
                                ...score.assessmentScores,
                                // We keep empty strings because [''] indicates an explicitly cleared score
                                [assessmentId]: newScores.filter(s => s !== null && s !== undefined),
                            },
                        };
                    }
                    return score;
                });
            } else {
                const newScoreEntry: Score = {
                    id: scoreId,
                    studentId,
                    subjectId,
                    assessmentScores: {
                        [assessmentId]: newScores.filter(s => s !== null && s !== undefined),
                    },
                    _isLocallyCreated: true
                };
                updatedScores = [...prevScores, newScoreEntry];
            }

            setDraftVersion(v => v + 1);
            return updatedScores;
        });
    };

    const getStudentScores = (studentId: number, subjectId: number, assessmentId: number): string[] => {
        const scoreId = `${studentId}-${subjectId}`;
        const score = scores.find(s => s.id === scoreId);
        return score?.assessmentScores?.[assessmentId] || [];
    };

    const getReportData = (studentId: number): ReportSpecificData | undefined => {
        return reportData.find(d => d.studentId === studentId);
    };

    const updateReportData = (studentId: number, data: Partial<Omit<ReportSpecificData, 'totalSchoolDays'>>) => {
        markDirty('reportData', true);
        markItemDirty('reportData', studentId);
        setReportData(prev => {
            const existingIndex = prev.findIndex(d => d.studentId === studentId);
            if (existingIndex > -1) {
                return prev.map((item, index) =>
                    index === existingIndex ? { ...item, ...data, studentId } : item
                );
            } else {
                // FIX: Removed 'headmasterRemark' as it does not exist on the ReportSpecificData type.
                const newEntry: ReportSpecificData = {
                    studentId,
                    attendance: '',
                    conduct: '',
                    interest: '',
                    attitude: '',
                    teacherRemark: '',
                    ...data,
                    _isLocallyCreated: true
                };
                return [...prev, newEntry];
            }
        });
    };

    const getClassData = (classId: number): ClassSpecificData | undefined => {
        return classData.find(d => d.classId === classId);
    };

    const updateClassData = (classId: number, data: Partial<ClassSpecificData>) => {
        markDirty('classData', true);
        markItemDirty('classData', classId);
        setClassData(prev => {
            const existingIndex = prev.findIndex(d => d.classId === classId);
            if (existingIndex > -1) {
                return prev.map((item, index) =>
                    index === existingIndex ? { ...item, ...data, classId } : item
                );
            } else {
                const newEntry: ClassSpecificData = {
                    classId,
                    totalSchoolDays: '',
                    ...data,
                    _isLocallyCreated: true
                };
                return [...prev, newEntry];
            }
        });
    };

    const updateSettings = (updates: Partial<SchoolSettings>) => {
        markDirty('settings', true);
        
        // Granular marking
        Object.keys(updates).forEach(key => {
            const k = key as keyof SchoolSettings;
            const isEqual = deepEqual(settings[k], updates[k]);
            if (!isEqual) {
                markItemDirty('settings', key);
            }
        });
        
        setSettings(prev => ({ ...prev, ...updates }));
    };

    // -------------------------------------------------------------------------
    // PAGE-SPECIFIC SAVE FUNCTIONS
    // -------------------------------------------------------------------------

    const savePageData = async (field: keyof AppDataType, data: any) => {
        if (!schoolId) {
            console.log(`No school ID, skipping ${String(field)} save.`);
            return;
        }

        if (!isDirty(field)) {
            console.log(`[savePageData] No changes to ${String(field)}, skipping save.`);
            return;
        }

        if (isSyncingRef.current) {
            console.log(`[savePageData] Sync already in progress for ${String(field)}`);
            return;
        }

        try {
            isSyncingRef.current = true;
            setIsSyncing(true);
            console.log(`[savePageData] ☁️ Saving ${String(field)} to cloud...`);

            // FIX: Granular Save - Only get data for THIS field (and potentially logs/sessions if needed)
            // This prevents "Bleeding Saves" and correctly handles deletions for this field.
            // We include 'userLogs' and 'activeSessions' to ensure they sync often.
            const { _deletions, ...updates } = getPendingUploadData([field, 'userLogs', 'activeSessions']);
            if (field === 'students' && _deletions?.students) {
                console.log(`[DELETE DEBUG] savePageData sending students deletions:`, _deletions.students);
            }

            // FIX: Arrays on the main document or metadata bundle are completely overwritten by Firebase merge.
            // If they are in the payload (meaning they have changes), we MUST send the FULL array.
            const FULL_ARRAY_KEYS = ['reportData', 'classData', 'users', 'userLogs', 'subjects', 'classes', 'assessments', 'grades'];
            FULL_ARRAY_KEYS.forEach(k => {
                if (updates[k] !== undefined || (k === field)) {
                    updates[k] = stateRef.current[k as keyof AppDataType];
                }
            });

            // Use transaction for all saves to ensure consistency

            await saveDataTransaction(schoolId, updates, _deletions, stateRef.current.students);

            // COMPOSITE STORAGE: If we just saved metadata, trigger a bundle rebuild
            // This ensures the optimized 'fetchMetadataBundle' has the latest data.
            const METADATA_FIELDS: (keyof AppDataType)[] = ['classes', 'subjects', 'assessments', 'grades'];
            if (METADATA_FIELDS.includes(field)) {
                const { updateMetadataBundle } = await import('../services/firebaseService');
                console.log(`[savePageData] 📦 Triggering metadata bundle rebuild for ${String(field)}...`);
                // We fire and forget this, but log errors
                updateMetadataBundle(schoolId).catch(err => {
                    console.error('[savePageData] Failed to rebuild metadata bundle:', err);
                });
            }

            // Update originalData baseline to the NEWly saved data
            // This prevents the UI from showing "Modified" highlights after a successful save
            if (field === 'settings') {
                originalData.current.settings = { ...stateRef.current.settings };
            } else if (Array.isArray(data)) {
                // Replace the baseline with the current live state after a successful save.
                // CRITICAL: We must NOT use a merge-only Map here because deleted items would
                // remain in originalData, causing them to re-appear on the next remote sync
                // (the smart merge would see them as "local-only unsaved items" and re-add them).
                // stateRef.current[field] reflects the true post-deletion state.
                originalData.current[field] = [...(stateRef.current[field] as any[])] as any;
            }

            // Clear granular dirty map for this field
            setPersistedPendingMap(prev => ({
                ...prev,
                [field as string]: []
            }));

            if (pendingChangesMap.current[field]) {
                pendingChangesMap.current[field].clear();
            }

            // Clear dirty flag for this field
            dirtyFields.current.delete(field);
            setHasLocalChanges(dirtyFields.current.size > 0);

            console.log(`[savePageData] ✅ ${String(field)} saved successfully!`);
            setIsSyncing(false);
            isSyncingRef.current = false;
        } catch (error) {
            console.error(`[savePageData] ❌ Failed to save ${String(field)}:`, error);
            showDatabaseError(error, 'write');
            setIsSyncing(false);
            isSyncingRef.current = false;
        }
    };

    const saveSettings = () => savePageData('settings', settings);
    const saveStudents = () => savePageData('students', students);
    const saveTeachers = () => savePageData('users', users);
    const saveSubjects = () => savePageData('subjects', subjects);
    const saveClasses = () => savePageData('classes', classes);
    const saveGrades = () => savePageData('grades', grades);
    const saveAssessments = () => savePageData('assessments', assessments);
    const saveScores = () => savePageData('scores', scores);


    // Process offline queue when coming back online
    useEffect(() => {
        if (isOnline && queuedCount > 0 && schoolId) {
            console.log('Network restored - syncing current state and clearing queue');
            // ... (rest of the logic)
        }
    }, [isOnline, schoolId, queuedCount]);

    // FIX: Add logic to process activeSessions and determine online users
    // An online user is one who has a heartbeat within the last 5 minutes (300000ms)
    // We update our own heartbeat every minute if active
    const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

    // Process offline queue when coming back online
    useEffect(() => {
        if (isOnline && queuedCount > 0 && schoolId) {
            console.log('Network restored - syncing current state and clearing queue');
            setIsSyncing(true);

            // Instead of processing old queued snapshots, sync the CURRENT state
            // This prevents overwriting recent changes with stale data
            const currentData: AppDataType = {
                settings,
                students,
                subjects,
                classes,
                grades,
                assessments,
                scores,
                reportData,
                classData,
                users: users || [],
                // Prune logs to max 50 to prevent hitting Firestore 1MB limit
                userLogs: (userLogs || []).slice(-50),
                // Prune stale sessions (> 24h)
                activeSessions: Object.fromEntries(
                    Object.entries(activeSessions || {}).filter(([_, timestamp]) =>
                        timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
                    )
                ) as Record<string, string>
            };

            // NOTE: We calculate deletions manually here to support "Offline Deletions"
            // but we implement a SAFETY CHECK to prevent "Mass Wipe" bugs.
            const deletions: Record<string, string[]> = {};

            // Check major collections for deletions
            (['students', 'scores', 'assessments', 'users'] as const).forEach(key => {
                const currentArr = currentData[key] as any[];
                const originalArr = originalData.current[key] as any[];

                if (Array.isArray(currentArr) && Array.isArray(originalArr)) {
                    const deletedIds = originalArr
                        .filter(o => o && o.id && !currentArr.find(c => c && c.id === o.id))
                        .map(o => String(o.id));

                    // SAFETY VALVE: Only allow deletions if they are NOT a "Mass Wipe"
                    // If > 20% of data is being deleted, assume it's a glitch and block the deletion.
                    // Exception: Small number of deletes (<= 5) is always allowed.
                    const isSuspicious = deletedIds.length > 5 && (deletedIds.length > originalArr.length * 0.2);

                    if (deletedIds.length > 0) {
                        if (isSuspicious) {
                            console.warn(`[DataContext] 🛡️ SAFETY VALVE: Blocked suspicious mass deletion of ${deletedIds.length} ${key} during offline recovery.`);
                            // Notify user via the error modal (using a custom error object)
                            showDatabaseError({
                                message: `Safety Alert: A mass deletion of ${deletedIds.length} ${key} was blocked during offline recovery to prevent accidental data loss.`,
                                code: 'SAFETY_BLOCK',
                                details: 'If this was intentional, please perform the deletion while online or in smaller batches.'
                            });
                            // We do NOT add to 'deletions', effectively restoring the server data for these items.
                        } else {
                            deletions[key] = deletedIds;
                        }
                    }
                }
            });

            // Use the transactional save to perform a SMART MERGE of the offline state
            // This prevents overwriting server data (like the "Data Wipe" bug caused by setDoc/merge:true on arrays)

            saveDataTransaction(schoolId, currentData, deletions, stateRef.current.students)
                .then(() => {
                    // Success - clear the entire queue since we just synced current state
                    offlineQueue.clearQueue();
                    setQueuedCount(0);

                    // Also clear dirty fields since we just synced everything
                    dirtyFields.current.clear();
                    setHasLocalChanges(false);

                    setIsSyncing(false);
                    console.log('Current state synced successfully (Merged), queue cleared');

                    // Trigger a refresh to get the true merged state from server
                    refreshFromCloud(true);
                })
                .catch(error => {
                    console.error('Error syncing current state:', error);

                    // Show database error modal
                    showDatabaseError(error, 'write');

                    // Keep queue as is, will retry on next online event
                    setIsSyncing(false);
                });
        }
    }, [isOnline, schoolId, queuedCount, users]);


    useEffect(() => {
        if (!activeSessions || !users) {
            setOnlineUsers([]);
            return;
        }

        const now = new Date();
        const threshold = 5 * 60 * 1000; // 5 minutes

        const online: OnlineUser[] = [];
        Object.entries(activeSessions).forEach(([userIdStr, timestamp]) => {
            const lastActive = new Date(timestamp as string);
            if (now.getTime() - lastActive.getTime() < threshold) {
                const uid = parseInt(userIdStr);
                const user = users.find(u => u.id === uid);
                if (user) {
                    online.push({
                        userId: uid,
                        userName: user.name,
                        role: user.role,
                        lastHeartbeat: timestamp as string
                    });
                }
            }
        });

        setOnlineUsers(online);
    }, [activeSessions, users]);

    // OPTIMIZATION: Ensure Student Bucket Exists on Startup
    // This catches schools that haven't migrated yet, even if they don't visit the Student page immediately.
    useEffect(() => {
        if (schoolId && isSessionUnlocked) {
            // No preloaded students passed here; function will check bucket existence (1 read)
            // and fetch subcollection ONLY if bucket is missing.
            console.log(`[DataContext] 📦 Checking student bucket existence for ${schoolId}...`);
            ensureStudentBucketExists(schoolId).catch(console.error);
        }
    }, [schoolId, isSessionUnlocked]);

    // Heartbeat effect
    useEffect(() => {
        if (!schoolId || !users || users.length === 0) return;

        // Find current user ID from session/local storage?
        // Actually DataContext doesn't know the current user directly, UserContext does.
        // But we can't import UserContext here (circular dependency).
        // Solution: We expose a function `sendHeartbeat(userId)` and let UserContext call it.
    }, []);

    const sendHeartbeat = React.useCallback(async (userId: number) => {
        if (schoolId) {
            // OPTIMIZATION: Update local state and let auto-sync handle the write
            // This avoids a separate READ + WRITE operation every minute
            const timestamp = new Date().toISOString();

            setActiveSessions(prev => ({
                ...prev,
                [userId.toString()]: timestamp
            }));

            markDirty('activeSessions');
            // await updateHeartbeat(schoolId, userId); // Removed direct call
        }
    }, [schoolId, markDirty]);

    const logUserAction = React.useCallback(async (userId: number, userName: string, role: string, action: 'Login' | 'Logout') => {
        if (!schoolId) return;

        // ONLY log 'Login' actions as per user request to reduce writes
        if (action !== 'Login') {
            return;
        }

        const log: UserLog = {
            id: Date.now(),
            userId,
            userName,
            role: role as any,
            action,
            timestamp: new Date().toISOString(),
            isRead: false,
        };

        // Mark as dirty to sync this log
        // Actually logUserActivity in firebaseService writes directly to DB?
        // Checking firebaseService.ts... 
        // Yes, logUserActivity does `setDoc(..., { userLogs: logs }, { merge: true })`.
        // This is a DIRECT write. To optimize this, we should add it to local state and let auto-sync handle it!
        // Wait, current implementation of logUserActivity in firebaseService performs a READ, then WRITE.
        // This is expensive.

        // BETTER APPROACH: Add to local state `userLogs` and mark dirty.
        setUserLogs(prev => {
            const newLogs = [...prev, log];
            // Limit to 500
            if (newLogs.length > 500) newLogs.shift();
            return newLogs;
        });

        markDirty('userLogs');

        // We do NOT call the direct firebase service anymore.
        // await logUserActivity(schoolId, log);
    }, [schoolId, markDirty]);

    // Removed logPageVisit to prevent excessive logging

    // Sync control functions
    const pauseSync = () => {
        console.log('[DataContext] Sync PAUSED');
        isSyncPaused.current = true;
        isSyncingRef.current = false;
        setIsSessionUnlocked(false); // Lock session on pause
    };

    const resumeSync = () => {
        console.log('[DataContext] Sync RESUMED');
        isSyncPaused.current = false;
        setIsSessionUnlocked(true); // Unlock session on resume

        // CRITICAL FIX: Reset lastLocalUpdate to allow Firebase data to load immediately
        // Without this, if user navigates quickly after login, the 10-second check
        // in the Firebase subscription prevents data from loading
        lastLocalUpdate.current = 0;
    };

    // Form blocking control functions
    const blockRemoteUpdates = () => {
        console.log('[DataContext] Blocking remote updates - form opened');
        isFormOpen.current = true;
    };

    const allowRemoteUpdates = () => {
        console.log('[DataContext] Allowing remote updates - form closed');
        isFormOpen.current = false;
    };

    // Helper to check if specific fields are dirty
    const isDirty = (...fields: (keyof AppDataType)[]) => {
        return fields.some(field => dirtyFields.current.has(field));
    };

    // REVERT LOGIC
    const revertAllPendingChanges = () => {
        console.log('[DataContext] 🔄 Reverting ALL pending changes...');

        // 1. Revert each dirty field to originalData
        dirtyFields.current.forEach(field => {
            const original = originalData.current[field];

            // Safeguard: Only revert if original data exists. 
            // If it doesn't, it means we don't have a server baseline yet, so reverting might clear data.
            if (original === undefined) {
                console.warn(`[DataContext] ⚠️ Skipping revert for ${field} - originalData not available.`);
                return;
            }

            // @ts-ignore
            const setter = {
                settings: setSettings,
                students: setStudents,
                subjects: setSubjects,
                classes: setClasses,
                grades: setGrades,
                assessments: setAssessments,
                scores: setScores,
                reportData: setReportData,
                classData: setClassData,
                users: setUsers,
                userLogs: setUserLogs,
                activeSessions: setActiveSessions
            }[field];

            if (setter && original !== undefined) {
                // @ts-ignore
                setter(original);
            }
        });

        // 2. Clear dirty state
        dirtyFields.current.clear();
        setHasLocalChanges(false);
        setDirtyVersion(v => v + 1);

        // 3. Clear pending score changes specifically
        Object.values(pendingChangesMap.current).forEach(set => {
            if (set instanceof Set) set.clear();
        });
    };

    const revertPendingChanges = (field: keyof AppDataType, id?: number | string) => {
        console.log(`[DataContext] 🔄 Reverting pending change for ${String(field)} (ID: ${id})`);

        const originalVal = originalData.current[field];
        // @ts-ignore
        const currentVal = {
            settings, students, subjects, classes, grades, assessments, scores, reportData, classData, users, userLogs, activeSessions
        }[field];

        // Case 1: Revert Entire Field (e.g. Settings, or no ID provided)
        if (id === undefined) {
            // @ts-ignore
            const setter = {
                settings: setSettings,
                students: setStudents,
                subjects: setSubjects,
                classes: setClasses,
                grades: setGrades,
                assessments: setAssessments,
                scores: setScores,
                reportData: setReportData,
                classData: setClassData,
                users: setUsers,
                userLogs: setUserLogs,
                activeSessions: setActiveSessions
            }[field];

            if (setter && originalVal !== undefined) {
                // @ts-ignore
                setter(originalVal);
                dirtyFields.current.delete(field);
                
                // Clear granular map too
                if (pendingChangesMap.current[field]) {
                    pendingChangesMap.current[field].clear();
                }

                // If no more dirty fields, clear global flag
                if (dirtyFields.current.size === 0) setHasLocalChanges(false);
                setDirtyVersion(v => v + 1);
            }
            return;
        }

        // Case 1.5: Revert Specific Setting Field
        if (field === 'settings' && id !== undefined) {
             const originalVal = originalData.current.settings;
             if (originalVal) {
                 const key = String(id) as keyof SchoolSettings;
                 setSettings(prev => ({ ...prev, [key]: originalVal[key] }));
                 markItemClean('settings', id);
             }
             return;
        }

        // Case 2: Revert Specific Item in Array (Students, Scores, etc.)
        if (Array.isArray(currentVal) && Array.isArray(originalVal)) {
            // @ts-ignore
            const setter = {
                settings: setSettings,
                students: setStudents,
                subjects: setSubjects,
                classes: setClasses,
                grades: setGrades,
                assessments: setAssessments,
                scores: setScores,
                reportData: setReportData,
                classData: setClassData,
                users: setUsers,
                userLogs: setUserLogs,
                activeSessions: setActiveSessions
            }[field];

            if (!setter) return;

            // Find original item
            // @ts-ignore
            const originalItem = originalVal.find(i => getItemId(i) === String(id));

            let newArray = [...currentVal];

            if (originalItem) {
                // RESTORE: Replace current item with original
                // @ts-ignore
                const idx = newArray.findIndex(i => getItemId(i) === String(id));
                if (idx !== -1) {
                    newArray[idx] = originalItem;
                } else {
                    // It was deleted, so add it back
                    newArray.push(originalItem);
                }
                markItemClean(field, id);
            } else {
                // REMOVE: It was a NEW item, so just remove it
                // @ts-ignore
                newArray = newArray.filter(i => getItemId(i) !== String(id));
            }

            // Update State
            // @ts-ignore
            setter(newArray);

            // Clear drafts related to this score ID (studentId-subjectId)
            if (field === 'scores') {
                const scoreIdPrefix = String(id) + '-';
                for (const key of draftScores.current.keys()) {
                    if (key.startsWith(scoreIdPrefix)) {
                        draftScores.current.delete(key);
                    }
                }
            }

            // NOTE: We don't verify if the *rest* of the array is clean here (expensive).
            // We just assume the field is still dirty if we reverted one item, 
            // UNLESS we want to do a full deep comparison check?
            // User just wants to "Clear", implying "Don't Save This". 
            // Ideally we check if this was the LAST change.
            // Let's do a quick length check or deep compare if feasible? 
            // For now, keep it marked dirty to be safe, or check equality.
            if (deepEqual(newArray, originalVal)) {
                dirtyFields.current.delete(field);
                if (dirtyFields.current.size === 0) setHasLocalChanges(false);
            }
            // Propagate version change to UI (e.g. InlineScoreInput)
            setDirtyVersion(v => v + 1);
        }
    };

    // Updated to support granular saves (preventing "Bleeding Save" bugs)
    const getPendingUploadData = React.useCallback((limitToFields?: (keyof AppDataType)[], dataOverride?: AppDataType): any => {
        if (dirtyFields.current.size === 0) {
            return {};
        }

        let fieldsToSave = Array.from(dirtyFields.current);

        // FILTER: If fields are restricted, only include those allowed
        if (limitToFields && limitToFields.length > 0) {
            const allowedSet = new Set(limitToFields);
            fieldsToSave = fieldsToSave.filter(f => allowedSet.has(f as keyof AppDataType));
        }

        if (fieldsToSave.length === 0) return {};

        // FIX: Use stateRef.current instead of closure variables.
        // Closure values (settings, scores, etc.) may be STALE if React state updates (e.g. from
        // draft score commits via setScores) haven't re-rendered yet when getPendingUploadData is called.
        // stateRef.current is kept in sync via a useEffect and is always up-to-date.
        const currentData: AppDataType = dataOverride || stateRef.current;
        const payload: any = {};
        const deletions: any = {};

        // GRANULAR ROLE-BASED GUARD
        // Fetch current user from localStorage/state to verify permissions
        const storedUserId = localStorage.getItem('sba_user_id') || localStorage.getItem('emulator-sba_user_id');
        const currentUser = (storedUserId && currentData.users) ? currentData.users.find(u => String(u.id) === storedUserId) : null;
        const userRole = currentUser?.role || 'Guest';
        const isAdmin = userRole === 'Admin';
        const allowedClasses = currentUser?.allowedClasses || [];

        fieldsToSave.forEach(f => {
            const field = f as keyof AppDataType;

            // 1. METADATA GUARD: Non-admins cannot modify global metadata
            // RELAXED: During preview (getPendingUploadData), we allow seeing these changes
            // even if the final saveToCloud might block them, so the user knows they are "Unsaved".
            const isMetadata = ['subjects', 'classes', 'assessments', 'grades'].includes(field);
            if (isMetadata && !isAdmin && !limitToFields) { // Only log warning if full payload requested
                console.log(`[DataContext] ℹ️ Note: Non-admin changing metadata field '${String(field)}'. This will be tracked locally.`);
            }

            // @ts-ignore
            const currentVal = currentData[field];
            const originalVal = originalData.current[field];

            // Perform smart diff for arrays to only show changed items in preview
            if (Array.isArray(currentVal) && Array.isArray(originalVal)) {

                // 2. DELETION GUARD (Scoped Data)
                let deletedIds = originalVal
                    .filter((o: any) => {
                        const oid = getItemId(o);
                        return oid && !currentVal.find((c: any) => getItemId(c) === oid);
                    })
                    .map((o: any) => getItemId(o) as string);

                if (deletedIds.length > 0) {
                    // Filter deletions based on user scope if not admin
                    if (!isAdmin && (field === 'students' || field === 'reportData')) {
                        const originalDeletedIdsLength = deletedIds.length;
                        deletedIds = deletedIds.filter(id => {
                            const item = originalVal.find((o: any) => getItemId(o) === id);
                            // Only allow deletion if item class is in allowedClasses
                            const itemClass = item?.class || item?.name || item?.className;
                            return itemClass && allowedClasses.includes(itemClass);
                        });

                        if (deletedIds.length < originalDeletedIdsLength) {
                            console.warn(`[DataContext] 🛡️ Role-Based Guard: Filtered out ${originalDeletedIdsLength - deletedIds.length} unauthorized deletions for ${String(field)}`);
                        }
                    }

                    // 3. MASS-DELETION PROTECTION
                    const isMassDeletion = deletedIds.length > 5 && (deletedIds.length > originalVal.length * 0.2);
                    if (isMassDeletion && !isAdmin) {
                        console.error(`[DataContext] 🚫 SAFETY BLOCK: Preventing suspicious mass deletion of ${deletedIds.length} ${String(field)} by non-admin user.`);
                        // Do not add to deletions map
                    } else if (deletedIds.length > 0) {
                        console.log(`[DataContext] 🗑️ Detected Deletions for ${String(field)}:`, deletedIds);
                        if (field === 'students') {
                            console.log(`[DELETE DEBUG] getPendingUploadData detected student deletions:`, deletedIds);
                        }
                        deletions[field] = deletedIds;
                    }
                }

                // 4. Update Logic
                // @ts-ignore
                const updates = currentVal.filter(item => {
                    const itemId = getItemId(item);
                    if (itemId) {
                        const originalItem = originalVal.find((o: any) => getItemId(o) === itemId);

                        // ATOMIC PAYLOAD SANITIZATION: Prevents Firestore Security Rule Rejection
                        // If taking actions mid-app instantly adds the item to the pending set before background sanitization can run,
                        // we must forcefully intercept it right before it hits the payload.
                        // If the server knows it's softly deleted, and we also know it's softly deleted, NEVER upload it.
                        const origAny = originalItem as any;
                        const itemAny = item as any;
                        if (origAny && origAny.deleted === true && itemAny.deleted === true) {
                            // Optionally cleanup the set since we actively caught it
                            if (pendingChangesMap.current[field]) {
                                pendingChangesMap.current[field].delete(itemId);
                            }
                            return false; // Drop from update payload immediately
                        }

                        // PREVIEW FIX: If it's explicitly in the pendingChangesMap, include it
                        // This handles cases like "Restore System Default" where data might match cloud but is statefully unsaved
                        const pendingSet = pendingChangesMap.current[field];
                        if (pendingSet && pendingSet.has(itemId)) return true;

                        if (!originalItem) {
                            // Zombie Data Prevention: If it wasn't created locally in this session, drop it!
                            if (!(item as any)._isLocallyCreated) {
                                console.log(`[DataContext] 🧟 ZOMBIE PREVENTED: Discarding stale record ${itemId} for ${String(field)}`);
                                return false;
                            }
                            return pendingSet && pendingSet.has(itemId);
                        }

                        // Semantic comparison
                        return !isDataEqual(item, originalItem, field);
                    }
                    return true;
                });

                if (updates.length > 0) {
                    payload[field] = updates;
                }

            } else if (field === 'settings') {
                // 5. SETTINGS GUARD: Admin only
                if (!isAdmin) {
                    console.warn(`[DataContext] 🛡️ Role-Based Guard: stripping unauthorized change to 'settings'`);
                    return;
                }
                
                // Granular diff for settings
                const pendingSet = pendingChangesMap.current.settings;
                if (pendingSet && pendingSet.size > 0) {
                    const settingsPayload: any = {};
                    pendingSet.forEach(key => {
                        const k = key as keyof SchoolSettings;
                        settingsPayload[k] = currentData.settings[k];
                    });
                    payload.settings = settingsPayload;
                    console.log(`[DataContext] ⚙️ settings granular payload:`, settingsPayload);
                } else if (dirtyFields.current.has('settings')) {
                    // Fallback to full object if marked dirty but map is somehow empty (safety)
                    payload.settings = currentVal;
                }
            } else {
                // Non-array fields (activeSessions, etc.)
                // @ts-ignore
                payload[field] = currentVal;
            }
        });

        if (Object.keys(deletions).length > 0) {
            payload._deletions = deletions;
        }

        return payload;
    }, [schoolId]);

    // Draft Score State
    const draftScores = useRef<Map<string, string>>(new Map());
    const [draftVersion, setDraftVersion] = useState(0); // Used to force updates in subscribers

    // Load draft scores from persistent storage on boot to survive rapid tab discards while typing
    useEffect(() => {
        if (!schoolId) return;
        try {
            const compressed = localStorage.getItem(getKey('draft-scores-map'));
            if (compressed) {
                // @ts-ignore - LZ is available globally or imported
                const jsonString = LZ.decompress(compressed);
                if (jsonString) {
                    const parsed = JSON.parse(jsonString);
                    draftScores.current = new Map(Object.entries(parsed));
                    setDraftVersion(v => v + 1);
                }
            }
        } catch (error) {
            console.warn("[DataContext] Failed to restore draft scores:", error);
        }
    }, [schoolId]);

    // Helper to persist draft scores synchronously
    const persistDraftScoresSync = React.useCallback(() => {
        try {
            const obj = Object.fromEntries(draftScores.current);
            const jsonString = JSON.stringify(obj);
            // @ts-ignore - LZ is available globally or imported
            const compressed = LZ.compress(jsonString);
            localStorage.setItem(getKey('draft-scores-map'), compressed);
        } catch (error) {
            // Memory constrained, silent fail
        }
    }, [schoolId]);

    // Cache for loaded subjects to prevent redundant fetches
    const loadedSubjects = useRef<Set<number>>(new Set());

    // Update the draft value for a score (marks it as dirty)
    const updateDraftScore = (studentId: number, subjectId: number, assessmentId: number, value: string) => {
        const key = `${studentId}-${subjectId}-${assessmentId}`;
        draftScores.current.set(key, value);

        // Immediate Write-Through
        persistDraftScoresSync();

        // Update derived state
        setHasLocalChanges(true);
        // Notify subscribers (inputs) that drafts have changed
        setDraftVersion(prev => prev + 1);
    };

    // Remove a score from draft (marks it as clean/reverted or saved)
    const removeDraftScore = (studentId: number, subjectId: number, assessmentId: number) => {
        const key = `${studentId}-${subjectId}-${assessmentId}`;
        if (draftScores.current.delete(key)) {
            // Immediate Write-Through
            persistDraftScoresSync();

            // Only update if it actually existed
            if (draftScores.current.size === 0 && dirtyFields.current.size === 0) {
                setHasLocalChanges(false);
            }
            setDraftVersion(prev => prev + 1);
        }
    };

    // CRITICAL FIX: Compute pending count from actual payload data, not just draft inputs
    // This ensures the save button shows the actual number of scores that will be uploaded
    // UPDATE: Now counts ALL pending changes (students, subjects, etc.), not just scores.
    const pendingCount = useMemo(() => {
        const payload = getPendingUploadData(undefined, {
            settings, students, subjects, classes, grades, assessments, scores, reportData, classData, users, userLogs, activeSessions
        } as AppDataType);
        let count = 0;
        Object.keys(payload).forEach(key => {
            // IGNORE activeSessions and userLogs for the pending count
            // These change automatically (heartbeats, nav logs) and shouldn't trigger "Unsaved Changes" UI
            if (key === 'activeSessions' || key === 'userLogs') return;

            const val = payload[key as keyof AppDataType];
            if (key === '_deletions') {
                // Count individual items being deleted
                Object.values(val as Record<string, string[]>).forEach(ids => {
                    count += ids.length;
                });
            } else if (Array.isArray(val)) {
                count += val.length;
            } else if (val && typeof val === 'object' && Object.keys(val).length > 0) {
                count += Object.keys(val).length;
            }
        });

        // CRITICAL FIX: Add draft scores count to pending count
        // This ensures the Save button is enabled while typing
        count += draftScores.current.size;

        return count;
    }, [getPendingUploadData, dirtyVersion, draftVersion, settings, students, subjects, classes, grades, assessments, scores, reportData, classData, users, userLogs, activeSessions]);

    // Get the score to display: prefer draft, fallback to saved
    const getComputedScore = (studentId: number, subjectId: number, assessmentId: number): string => {
        const draftKey = `${studentId}-${subjectId}-${assessmentId}`;
        if (draftScores.current.has(draftKey)) {
            // Strictly check undefined, because '' is a valid draft state
            const draft = draftScores.current.get(draftKey);
            if (draft !== undefined) return draft;
        }
        // Fallback to saved data
        const savedScores = getStudentScores(studentId, subjectId, assessmentId);
        // Strongly bind to the first element if it safely exists, otherwise return blank string
        return savedScores.length > 0 ? savedScores[0] : '';
    };

    const isPageDirty = React.useCallback((pageName: string): boolean => {
        const PAGE_DATA_MAPPING: Record<string, (keyof AppDataType)[]> = {
            'School Setup': ['settings'],
            'Classes & Teachers': ['classes', 'users'],
            'Subjects': ['subjects'],
            'Students': ['students'],
            'Grading System': ['grades'],
            'Assessment Types': ['assessments'],
            'Score Entry': ['scores'],
            'Score Summary': ['scores'],
            'Student Progress': ['scores', 'students'],
            'Report Viewer': ['reportData'],
            'Data Management': ['settings', 'students', 'subjects', 'classes', 'grades', 'assessments', 'scores', 'reportData', 'classData', 'users'],
        };

        const fields = PAGE_DATA_MAPPING[pageName];
        if (!fields) return false;

        // 1. Check if any mapped field has ACTUAL pending changes
        const pendingData = getPendingUploadData(fields, {
            settings, students, subjects, classes, grades, assessments, scores, reportData, classData, users, userLogs, activeSessions
        } as AppDataType);
        
        const { _deletions, ...updates } = pendingData;
        const hasActualChanges = Object.keys(updates).length > 0;
        if (hasActualChanges) return true;

        // 2. Special check for Score Entry (draft scores)
        if (pageName === 'Score Entry' || pageName === 'Score Summary') {
            if (draftScores.current.size > 0) return true;
        }

        return false;
    }, [getPendingUploadData, draftVersion, settings, students, subjects, classes, grades, assessments, scores, reportData, classData, users, userLogs, activeSessions]);

    // -------------------------------------------------------------------------
    // LAZY LOADING IMPLEMENTATION
    // -------------------------------------------------------------------------

    const loadStudents = React.useCallback(async (limit: number = 0, force: boolean = false, ignorePreservation: boolean = false) => {
        if (!schoolId) return;

        // Metadata Check: Only fetch if server has newer data than what we last loaded
        const serverTimestamp = lastLoadedTimestamps.current['students'];
        const loadedTimestamp = lastLoadedTimestamps.current['_loaded_students'];

        // Refined isUpToDate:
        // 1. If forced, always fetch.
        // 2. If no students loaded, always fetch.
        // 3. If we have students AND (no server timestamp OR local matches server), we are up to date.
        // 4. CRITICAL: If originalData baseline is missing, we are NOT up to date (need 1 fetch to sync baseline).
        const hasBaseline = originalData.current.students !== undefined;
        // Require previouslyLoaded to be true to avoid skipping the first load of the session
        const previouslyLoaded = lastLoadedTimestamps.current['_loaded_students'] !== undefined;

        const isUpToDate = !force && !ignorePreservation && previouslyLoaded &&
            students.length > 0 && hasBaseline &&
            (!serverTimestamp || deepEqual(serverTimestamp, loadedTimestamp));

        console.log(`[DataContext] 🔍 loadStudents Check:`, {
            studentsCount: students.length,
            serverTS: serverTimestamp,
            loadedTS: loadedTimestamp,
            isUpToDate,
            hasBaseline,
            ignorePreservation,
            hasInflight: inflightPromises.current.has(`students-${limit}`)
        });

        // PROTECTION: Never overwrite local data if we have unsaved students
        // Exception: ignorePreservation (Global Refresh)
        const isDirtyFlag = dirtyFields.current.has('students');
        if (isDirtyFlag && !force && !ignorePreservation && previouslyLoaded) {
            console.log(`[DataContext] 🛡️ Students have unsaved local changes. Skipping fetch to prevent data loss.`);
            setTimeout(() => recheckAllDirtyStatus(), 500);
            return;
        }

        if (isUpToDate) {
            console.log(`[DataContext] 🧠 Students up-to-date. Skipping read.`);
            setTimeout(() => recheckAllDirtyStatus(), 500);
            return;
        }

        // DEDUPLICATION: Prevent concurrent redundant fetches
        const cacheKey = `students-${limit}`;
        if (inflightPromises.current.has(cacheKey)) {
            console.log(`[DataContext] ⏳ Students fetch already in progress. Deduping...`);
            return inflightPromises.current.get(cacheKey);
        }

        const fetchPromise = (async () => {
            setIsFetching(true);
            try {
                console.log(`[DataContext] 📥 Loading Students (Optimized via Bucket)...`);
                // OPTIMIZATION: Use fetchStudents which prefers the BUCKET (1 read) over subcollection (N reads)
                // Signature: (docId: string, pageSize: number, lastVisible: DocumentSnapshot | null)
                const result = await fetchStudents(schoolId, limit > 0 ? limit : 1000, null);
                const newStudents = result.students;

                if (newStudents) {
                    console.log(`[DataContext] ✅ Loaded ${newStudents.length} students.`);
                    // Mark as loaded even if serverTimestamp is undefined
                    lastLoadedTimestamps.current['_loaded_students'] = serverTimestamp || 'loaded_once';

                    // Merge with existing students if paginating or forcing update
                    setStudents(prev => {
                        // 1. Set originalData baseline to CLOUD data ONLY
                        // (not merged with local) so dirty checks compare local vs cloud correctly
                        originalData.current.students = [...newStudents] as any;

                        // 2. DISCARD LOCAL CHANGES if ignorePreservation is set (Global Refresh)
                        if (ignorePreservation) return newStudents;

                        // 3. Smart Merge: preserve local edits to existing students
                        const cloudStudentIds = new Set(newStudents.map(s => String(getItemId(s))));
                        const prevMap = new Map(prev.map(s => [getItemId(s) || 'unknown', s]));
                        newStudents.forEach(cloudStudent => {
                            const sid = getItemId(cloudStudent);
                            if (!sid) return;
                            const local = prevMap.get(sid);

                            // SMART MERGE: Preserve local if it differs from cloud AND is meaningful
                            if (local && !isDataEqual(local, cloudStudent)) {
                                if (isMeaningfulDiscrepancy('students', local)) {
                                    console.log(`[DataContext] 🛡️ Reconciliation: Keeping local version of student ${sid} (has meaningful changes)`, {
                                        local: normalizeData(local),
                                        cloud: normalizeData(cloudStudent)
                                    });
                                    markDirty('students', true);
                                    markItemDirty('students', sid);
                                    return;
                                } else {
                                    console.log(`[DataContext] 🔄 Reconciliation: Overwriting local student ${sid} with cloud version (local was default state/meaningless)`);
                                }
                            }
                            prevMap.set(sid, cloudStudent);
                        });

                        // 4. Detect local-only students (added locally, not yet in cloud)
                        const localOnlyStudents: any[] = [];
                        prev.forEach(localStudent => {
                            const sid = getItemId(localStudent);
                            if (sid && !cloudStudentIds.has(String(sid))) {
                                localOnlyStudents.push(localStudent);
                            }
                        });

                        if (localOnlyStudents.length > 0) {
                            console.log(`[DataContext] 🔍 Detected ${localOnlyStudents.length} local-only (unsaved) students. Marking dirty.`);
                            console.log(`[DELETE DEBUG] loadStudents is re-adding local-only (unsaved) students! Wait, are these deleted students? IDs:`, localOnlyStudents.map(s => s.id));
                            markDirty('students', true);
                            localOnlyStudents.forEach(s => {
                                const sid = getItemId(s);
                                if (sid) markItemDirty('students', sid);
                            });
                        }

                        return Array.from(prevMap.values());
                    });

                    recheckAllDirtyStatus();

                    // OPTIMIZATION: Ensure student bucket exists (create if missing)
                    // We only pass preloaded students if we likely fetched ALL of them (length < limit)
                    // Default limit is 1000. If we have 1000, we might have more, so we don't pass them to ensure safety.
                    const usedLimit = limit > 0 ? limit : 1000;
                    if (newStudents.length > 0) {
                        const isLikelyComplete = newStudents.length < usedLimit;

                        // If it's complete, pass it to avoid re-fetching. 
                        // If not complete, pass undefined, and ensureStudentBucketExists will fetch ALL from subcollection.
                        ensureStudentBucketExists(schoolId, isLikelyComplete ? newStudents : undefined).catch(e => {
                            console.error('[DataContext] Non-critical: Failed to ensure student bucket after loading', e);
                        });
                    }
                }
            } catch (e) {
                console.error("Failed to load students", e);
                showDatabaseError(e, 'read');
            } finally {
                setIsFetching(false);
                inflightPromises.current.delete(cacheKey);
            }
        })();

        inflightPromises.current.set(cacheKey, fetchPromise);
        return fetchPromise;
    }, [schoolId, reconcileCollection, recheckAllDirtyStatus, showDatabaseError]); // STABILIZED: Removed students.length dependency

    // loadUsers removed - users now in main document

    const loadScores = React.useCallback(async (classId: number | undefined, subjectId: number, force: boolean = false, ignorePreservation: boolean = false) => {
        if (!schoolId) return;

        // Cache Check - We track loaded subjects, not class-subjects
        if (!force && !ignorePreservation && loadedSubjects.current.has(subjectId)) {
            console.log(`[DataContext] 🧠 Using Cached Scores for Subject ${subjectId}`);
            return;
        }

        // DEDUPLICATION - Key by Subject ID only, as buckets contain ALL class scores for that subject
        const cacheKey = `scores-${subjectId}`;

        if (inflightPromises.current.has(cacheKey)) {
            console.log(`[DataContext] ⏳ Scores fetch for Subject ${subjectId} already in progress. Deduping...`);
            return inflightPromises.current.get(cacheKey);
        }

        const fetchPromise = (async () => {
            setIsFetching(true);
            try {
                console.log(`[DataContext] 📥 Lazy Loading Scores for Subject ${subjectId}...`);
                // Note: The classId param here is technically redundant for the bucket fetch itself,
                // but we might need it for legacy fallback or logging. 
                // Since our new fetchScoresForClass (which really fetches by Subject Bucket) handles it,
                // we just pass it through. 
                const newScores = await fetchScoresForClass(schoolId, classId, subjectId);

                if (newScores) {
                    loadedSubjects.current.add(subjectId);

                    console.log(`[DataContext] ✅ Loaded ${newScores.length} scores for Subject ${subjectId}.`);
                    let finalScoresToRecheck: Score[] = [];
                    setScores(prev => {
                        // 1. ATOMIC BASELINE SYNC: Update originalData for this subject
                        const currentOriginal = (originalData.current.scores || []) as Score[];
                        const originalMap = new Map<string, Score>(currentOriginal.map(s => [String(getItemId(s)), s]));

                        // Clear existing baseline for this subject to avoid duplicates/stale items
                        for (const [key, score] of originalMap.entries()) {
                            if (Number(score.subjectId) === Number(subjectId)) {
                                originalMap.delete(key);
                            }
                        }

                        // Add the new cloud baseline
                        newScores.forEach(s => {
                            const sid = getItemId(s);
                            if (sid) originalMap.set(sid, s);
                        });
                        originalData.current.scores = Array.from(originalMap.values());

                        // 2. DISCARD LOCAL CHANGES if ignorePreservation is set (Global Refresh)
                        const otherSubjectScores = prev.filter(s => Number(s.subjectId) !== Number(subjectId));
                        if (ignorePreservation) {
                            finalScoresToRecheck = [...otherSubjectScores, ...newScores];
                            return finalScoresToRecheck;
                        }

                        // 3. SMART MERGE: Reconcile ONLY scores for this subject
                        const currentSubjectScores = prev.filter(s => Number(s.subjectId) === Number(subjectId));
                        const reconciledForSubject = reconcileCollection('scores', newScores, currentSubjectScores);

                        finalScoresToRecheck = [...otherSubjectScores, ...reconciledForSubject];
                        return finalScoresToRecheck;
                    });

                    // Recalculate dirty states using the NEW data directly to avoid React state batching race conditions
                    recheckAllDirtyStatus({ scores: finalScoresToRecheck });
                }
            } catch (e) {
                console.error("Failed to load scores", e);
                showDatabaseError(e, 'read');
            } finally {
                setIsFetching(false);
                inflightPromises.current.delete(cacheKey);
            }
        })();

        inflightPromises.current.set(cacheKey, fetchPromise);
        return fetchPromise;
    }, [schoolId, reconcileCollection, recheckAllDirtyStatus, showDatabaseError]);

    // Load Critical Metadata (Classes, Subjects, Assessments)
    const loadMetadata = React.useCallback(async (force: boolean = false, ignorePreservation: boolean = false) => {
        if (!schoolId) return;

        // Metadata Check
        const sTS = lastLoadedTimestamps.current['subjects'];
        const cTS = lastLoadedTimestamps.current['classes'];
        const aTS = lastLoadedTimestamps.current['assessments'];
        const gTS = lastLoadedTimestamps.current['grades'];

        // Check if we already have data or if we've successfully loaded at least once
        const hasData = classes.length > 0 || subjects.length > 0 || assessments.length > 0 || grades.length > 0;
        const previouslyLoaded = lastLoadedTimestamps.current['_loaded_classes'] !== undefined;

        // CRITICAL: Ensure we have baselines in memory before skipping
        const hasBaselines = !!(originalData.current.classes && originalData.current.subjects && originalData.current.assessments);

        const isUpToDate = !force && !ignorePreservation && previouslyLoaded && (
            hasData && hasBaselines &&
            (!cTS || deepEqual(cTS, lastLoadedTimestamps.current['_loaded_classes'])) &&
            (!sTS || deepEqual(sTS, lastLoadedTimestamps.current['_loaded_subjects'])) &&
            (!aTS || deepEqual(aTS, lastLoadedTimestamps.current['_loaded_assessments'])) &&
            (!gTS || deepEqual(gTS, lastLoadedTimestamps.current['_loaded_grades']))
        );

        console.log(`[DataContext] 🔍 loadMetadata Check:`, {
            hasData,
            previouslyLoaded,
            isUpToDate,
            inflight: inflightPromises.current.has('metadata')
        });

        // PROTECTION: Skip if metadata fields are dirty AND we have successfully loaded previously.
        const isDirtyFlag = dirtyFields.current.has('classes') || dirtyFields.current.has('subjects') || dirtyFields.current.has('assessments') || dirtyFields.current.has('grades');
        if (isDirtyFlag && !force && !ignorePreservation && previouslyLoaded) {
            console.log(`[DataContext] 🛡️ Metadata has unsaved local changes. Skipping fetch to prevent data loss.`);
            setTimeout(() => recheckAllDirtyStatus(), 500);
            return;
        }

        if (isUpToDate) {
            console.log(`[DataContext] 🧠 Metadata up-to-date (Metadata Match). Skipping read.`);
            setTimeout(() => recheckAllDirtyStatus(), 500);
            return;
        }

        // DEDUPLICATION
        const cacheKey = 'metadata';
        if (inflightPromises.current.has(cacheKey)) {
            console.log(`[DataContext] ⏳ Metadata fetch already in progress. Deduping...`);
            return inflightPromises.current.get(cacheKey);
        }

        const fetchPromise = (async () => {
            setIsFetching(true);
            try {
                console.log(`[DataContext] 📥 Loading Metadata (Classes, Subjects, Assessments)...`);

                // Use composite bundle strategy: 1 read for all metadata vs 3 separate reads (now 4: includes grades)
                const { classes: fetchedClasses, subjects: fetchedSubjects, assessments: fetchedAssessments, grades: fetchedGrades } = await fetchMetadataBundle(schoolId);

                // GRANULAR PRESERVATION: 
                // For schools in 'Partial Migration' state, some fields might be in subcollections 
                // while others are still in the main document. 
                // We ONLY overwrite state if we actually fetched something non-empty, 
                // OR if both are empty (clean state).

                const nextState: Partial<AppDataType> = {};

                const updateField = <T extends any>(
                    fieldName: string,
                    fetched: T[] | undefined,
                    currentLocal: T[],  // Current local state (may have unsaved additions)
                    setter: React.Dispatch<React.SetStateAction<T[]>>,
                    fieldKey: keyof AppDataType
                ) => {
                    const hasFetched = fetched && fetched.length > 0;
                    const hasLocal = currentLocal && currentLocal.length > 0;

                    // PROTECTION: If cloud data for a structural field is empty, but local state already has valid data 
                    // (likely loaded during initial launch via loadImportedData from legacy fields), 
                    // PRESERVE the local data instead of wiping it with empty.
                    if (fetched !== undefined && !hasFetched && hasLocal) {
                        // Check if local data is meaningful (not just the initial state/default)
                        const isMeaningful = currentLocal.some(item => isMeaningfulDiscrepancy(fieldKey, item));
                        if (isMeaningful) {
                            console.log(`[DataContext] 🛡️ Metadata Preservation: Cloud returned 0 ${fieldName}, but local state has ${currentLocal.length} valid items. Aborting overwrite to prevent data loss.`);
                            return;
                        }
                    }

                    if (hasFetched) {
                        // DISCARD LOCAL CHANGES if ignorePreservation is set (Global Refresh)
                        if (ignorePreservation) {
                            setter(fetched);
                            originalData.current[fieldKey] = fetched as any;
                            (nextState as any)[fieldKey] = fetched;
                            return;
                        }

                        // SMART MERGE: Cloud data is the authoritative baseline.
                        // But we must preserve any local edits to existing items that are meaningful.
                        const prevMap = new Map(currentLocal.map((item: any) => [String(getItemId(item)), item]));

                        fetched.forEach((cloudItem: any) => {
                            const id = getItemId(cloudItem);
                            if (!id) return;
                            const local = prevMap.get(String(id));

                            // Preserve local if it differs from cloud AND is meaningful
                            if (local && !isDataEqual(local, cloudItem)) {
                                if (isMeaningfulDiscrepancy(fieldKey, local)) {
                                    console.log(`[DataContext] 🛡️ Reconciliation: Keeping local version of ${fieldName} item ${id} (has meaningful changes)`, {
                                        local: normalizeData(local),
                                        cloud: normalizeData(cloudItem)
                                    });
                                    markDirty(fieldKey, true);
                                    markItemDirty(String(fieldKey), id);
                                    return;
                                } else {
                                    console.log(`[DataContext] 🔄 Reconciliation: Overwriting local ${fieldName} item ${id} with cloud version (local was default state/meaningless)`);
                                }
                            }
                            // Otherwise adopt cloud version
                            prevMap.set(String(id), cloudItem);
                        });

                        // Also identify local-only items (completely new)
                        const cloudIds = new Set(fetched.map((item: any) => String(getItemId(item))));
                        const localOnlyItems = Array.from(prevMap.values()).filter((item: any) => {
                            const id = getItemId(item);
                            return id && !cloudIds.has(String(id));
                        });

                        const mergedData = Array.from(prevMap.values()) as T[];

                        setter(mergedData);

                        // Baseline = cloud ONLY (so dirty check compares local vs cloud correctly)
                        originalData.current[fieldKey] = fetched as any;
                        (nextState as any)[fieldKey] = mergedData;

                        // Mark local-only items as dirty so they appear as "Unsaved"
                        if (localOnlyItems.length > 0) {
                            console.log(`[DataContext] 🔍 Detected ${localOnlyItems.length} local-only (unsaved) ${fieldName} items. Marking dirty.`);
                            markDirty(fieldKey, true);
                            localOnlyItems.forEach((item: any) => {
                                const id = getItemId(item);
                                if (id) markItemDirty(String(fieldKey), id);
                            });
                        }
                    } else if (fetched) {
                        // Empty set from cloud. 
                        // If we have local data and haven't saved it to THIS session yet, it's "local-only".
                        const localOnlyItems = currentLocal.filter(item => isMeaningfulDiscrepancy(fieldKey, item));

                        if (localOnlyItems.length > 0 && !ignorePreservation) {
                            console.log(`[DataContext] 🛡️ Preservation: Detected ${localOnlyItems.length} local-only items for ${fieldName} despite empty cloud.`);
                            setter(localOnlyItems);
                            originalData.current[fieldKey] = [] as any; // Baseline is empty cloud
                            (nextState as any)[fieldKey] = localOnlyItems;

                            markDirty(fieldKey, true);
                            localOnlyItems.forEach(item => {
                                const id = getItemId(item);
                                if (id) markItemDirty(String(fieldKey), id);
                            });
                        } else {
                            // Truly empty state derived from authoritative cloud
                            setter([]);
                            originalData.current[fieldKey] = [] as any;
                            (nextState as any)[fieldKey] = [];
                        }
                    }
                };

                updateField('classes', fetchedClasses, classes, setClasses, 'classes');
                updateField('subjects', fetchedSubjects, subjects, setSubjects, 'subjects');
                updateField('assessments', fetchedAssessments, assessments, setAssessments, 'assessments');
                updateField('grades', fetchedGrades, grades, setGrades, 'grades');

                lastLoadedTimestamps.current['_loaded_classes'] = cTS || 'loaded_once';
                lastLoadedTimestamps.current['_loaded_subjects'] = sTS || 'loaded_once';
                lastLoadedTimestamps.current['_loaded_assessments'] = aTS || 'loaded_once';
                lastLoadedTimestamps.current['_loaded_grades'] = gTS || 'loaded_once';

                // Recalculate dirty states with the new state override
                recheckAllDirtyStatus(nextState);

                // Ensure a delayed recheck correctly uses the completely finalized stateRef
                setTimeout(() => {
                    recheckAllDirtyStatus();
                }, 1000);

                console.log(`[DataContext] ✅ Metadata Merge triggered for School: ${schoolId}`);
            } catch (e) {
                console.error("Failed to load metadata", e);
                showDatabaseError(e, 'read');
            } finally {
                setIsFetching(false);
                inflightPromises.current.delete(cacheKey);
            }
        })();

        inflightPromises.current.set(cacheKey, fetchPromise);
        return fetchPromise;
    }, [schoolId]); // STABILIZED: Removed classes.length, subjects.length, assessments.length

    // Load Critical Metadata (Classes, Subjects, Assessments)
    // Should be called on Dashboard or App Init

    

    // --- Synchronization Orchestrators (Relocated to bottom to avoid TDZ) ---

// START_LOAD_IMPORTED_DATA
    const loadImportedData = React.useCallback((data: Partial<AppDataType>, isRemote: boolean = false, sub?: any) => {
        if (sub) setSubscription(sub);
        
        // 1. INITIALIZATION GUARD: On initial launch sync, force-verify intentionality from disk.
        // This ensures local edits made in previous sessions survive the initial cloud merge 
        // even if React state hydration hasn't completed.
        if (isRemote && isInitialSyncing.current) {
            console.log('[DataContext] 🛡️ Initial Cloud Sync Guard: Verifying intentionality from disk...');
            try {
                const rawMap = localStorage.getItem(getKey('pending-changes-map'));
                if (rawMap) {
                    const decompressed = LZ.decompress(rawMap);
                    if (decompressed) {
                        const diskMap = JSON.parse(decompressed);
                        Object.keys(diskMap).forEach(field => {
                            if (Array.isArray(diskMap[field])) {
                                if (!pendingChangesMap.current[field]) pendingChangesMap.current[field] = new Set();
                                diskMap[field].forEach((id: string) => {
                                    pendingChangesMap.current[field].add(id);
                                });
                            }
                        });
                    }
                }
            } catch (e) {
                console.error('[DataContext] Failed to re-initialize intentionality from disk:', e);
            }
        }
        // CRITICAL: Mark this as a remote update to prevent syncing back to cloud
        // ONLY if it's a remote update. If it's a local file import, we WANT to mark as dirty.
        if (isRemote) {
            isRemoteUpdate.current = true;
            // Automatically reset after 1000ms (increased from 500ms) to allow all effects to settle
            setTimeout(() => {
                isRemoteUpdate.current = false;
            }, 1000);
        }

        const importedSettings = data.settings;
        // IMPORTANT: Context is determined by academicYear and academicTerm ONLY.
        // schoolName is intentionally excluded because it is a user-editable field.
        // Including it would incorrectly flag a school name edit as a school context shift,
        // causing all local data to be discarded. Actual school-level switching is handled
        // by the schoolId-based context reset in the useEffect below.
        const currentCtx = `${settings.academicYear || ''}-${settings.academicTerm || ''}`;
        const newCtx = `${importedSettings?.academicYear || ''}-${importedSettings?.academicTerm || ''}`;

        // CRITICAL: If context (Year/Term) changed, we skip preservation
        const isContextShift = currentCtx !== newCtx && settings.academicYear !== '';
        if (isContextShift) {
            console.log(`[DataContext] 🔄 Context shift detected (${currentCtx} -> ${newCtx}). Skipping preservation.`);
        }

        // SMART MERGING: Only update state if imported data is ACTUALLY provided and not empty
        // This prevents replacing valid local data with undefined/empty cloud data
        const {
            students: importedStudents,
            subjects: importedSubjects,
            classes: importedClasses,
            grades: importedGrades,
            assessments: importedAssessments,
            scores: importedScores,
            reportData: importedReportData,
            classData: importedClassData,
            users: importedUsers,
        } = data;

        console.log(`[DataContext] 📦 loadImportedData called (isRemote=${isRemote}) with:`, {
            hasSettings: !!importedSettings,
            studentsCount: importedStudents?.length || 0,
            subjectsCount: importedSubjects?.length || 0,
            classesCount: importedClasses?.length || 0,
            gradesCount: importedGrades?.length || 0,
            assessmentsCount: importedAssessments?.length || 0,
            scoresCount: importedScores?.length || 0,
            reportDataCount: importedReportData?.length || 0,
            classDataCount: importedClassData?.length || 0,
            usersCount: importedUsers?.length || 0
        });

        // CRITICAL: Update lastContextKey ref to match THE INCOMING DATA
        // This prevents the useEffect reset from firing and wiping out
        // the data we are about to load.
        if (isRemote && importedSettings && lastContextKey.current !== null) {
            const nextCtx = `${schoolId}-${importedSettings.academicYear || ''}-${importedSettings.academicTerm || ''}`;
            console.log(`[DataContext] 🧠 Pre-empting context reset for: ${nextCtx}`);
            lastContextKey.current = nextCtx;
        }

        // ✅ DETERMINING INITIAL LAUNCH: 
        // A launch is "initial" if originalData is empty OR if we are still in the initial syncing phase.
        // Once isInitialSyncing is set to false (at end of refreshFromCloud), standard mid-session diffing begins.
        const isInitialLaunch = isRemote && (Object.keys(originalData.current).length === 0 || isInitialSyncing.current);

        // If it's the initial launch, ensure the global dirty list is clear to enable standard diffing.
        // HOWEVER: We no longer wipe pendingChangesMap.current here, as it was blowing away
        // the persistent intentionality restored from localStorage.
        if (isInitialLaunch) {
            dirtyFields.current.clear();
            setHasLocalChanges(false);
        }

        const nextState: Partial<AppDataType> = {
            settings, students, subjects, classes, grades, assessments, scores, reportData, classData, users, userLogs, activeSessions
        };

        const updateCollection = (field: keyof AppDataType, imported: any[] | undefined, current: any[], setter: (data: any) => void) => {
            if (imported === undefined) return;
            
            // ATOMIC BASELINE SYNC: Update originalData first so following checks detect correct delta
            if (isRemote) {
                originalData.current[field] = [...imported];
            }

            const reconciled = (isRemote && !isContextShift)
                ? reconcileCollection(field, imported, current)
                : imported; // Local imports (JSON) or academic Year/Term Context Shift overwrite everything

            if (!isDataEqual(reconciled, current)) {
                console.log(`[DataContext] ✅ ${isRemote ? 'Merged' : 'Imported'} collection: ${field}`);
                
                // If it's a local import, tag all items with _isLocallyCreated so they get uploaded
                let dataToSet = reconciled;
                if (!isRemote && Array.isArray(reconciled)) {
                    dataToSet = reconciled.map((item: any) => ({ ...item, _isLocallyCreated: true }));
                }

                setter(dataToSet);
                (nextState as any)[field] = dataToSet;
                if (!isRemote) markDirty(field, true);
            }
        };

        const processField = (field: keyof AppDataType, imported: any, current: any, setter: any) => {
            if (imported === undefined) return;
            if (isRemote) {
                originalData.current[field] = Array.isArray(imported) ? [...imported] : { ...imported } as any;
            }
            if (!isDataEqual(imported, current)) {
                console.log(`[DataContext] ✅ Updating ${String(field)}`);
                setter(imported);
                (nextState as any)[field] = imported;
                if (!isRemote) markDirty(field, true);
            }
        };

        if (importedSettings) {
            processField('settings', importedSettings, settings, setSettings);
        }

        updateCollection('students', importedStudents, students, setStudents);
        updateCollection('subjects', importedSubjects, subjects, setSubjects);
        updateCollection('classes', importedClasses, classes, setClasses);
        updateCollection('grades', importedGrades, grades, setGrades);
        updateCollection('assessments', importedAssessments, assessments, setAssessments);
        updateCollection('reportData', importedReportData, reportData, setReportData);
        updateCollection('classData', importedClassData, classData, setClassData);
        
        processField('userLogs', data.userLogs, userLogs, setUserLogs);
        processField('activeSessions', data.activeSessions, activeSessions, setActiveSessions);
        updateCollection('users', importedUsers, users, setUsers);

        // SCORES: Custom Logic using the same Smart Merge pattern
        if (importedScores !== undefined) {
            // ATOMIC BASELINE SYNC: Update originalData first
            if (isRemote) {
                originalData.current.scores = [...importedScores];
            }

            const reconciledScores = (isRemote && !isContextShift)
                ? reconcileCollection('scores', importedScores, scores)
                : importedScores;

            if (!isDataEqual(reconciledScores, scores)) {
                console.log(`[DataContext] ✅ ${isRemote ? 'Merged' : 'Imported'} scores`);
                setScores(reconciledScores);
                (nextState as any).scores = reconciledScores;
                
                if (!isRemote) {
                    markDirty('scores', true);
                } else if (isInitialLaunch && pendingChangesMap.current.scores.size > 0) {
                    // During initial load, if we preserved local scores, the field remains dirty
                    markDirty('scores', true);
                }
            }
        } else if (isRemote && importedScores && importedScores.length === 0) {
            // Explicit empty array update from cloud
            if (scores.length > 0) {
                setScores([]);
                nextState.scores = [];
                // Update baseline as well
                originalData.current.scores = [];
            }
        }

        // Sync users if present
        if (importedUsers) {
            SyncLogger.log(`loadImportedData: Loading users from document. Count: ${importedUsers.length}`);
            const shouldPreserveUsers = isInitialLaunch
                && pendingChangesMap.current.users.size > 0
                && users.length > 0
                && !isDataEqual(importedUsers, users);

            if (shouldPreserveUsers) {
                console.log(`[DataContext] 🛡️ Preservation: Local user changes exist; keeping local users during initial sync. dirtyUserCount=${pendingChangesMap.current.users.size}`);
            } else if (!isDataEqual(importedUsers, users)) {
                console.log('[DataContext] ✅ Updating users:', importedUsers.length);
                setUsers(importedUsers);
                nextState.users = importedUsers; // Track next state
            }
        }

        if (isRemote) {
            // FIX: SELECTIVE CLEARING of dirty fields
            // We only clear the dirty flag for a field if we actually received data for it from the cloud.
            // This prevents "Ghost" updates or partial syncs from wiping out valid local changes in unrelated fields.
            // REFINED: We clear the flag if data arrived, even if empty (since cloud is baseline), 
            // especially if we are in the initial sync phase.

            if (importedSettings) dirtyFields.current.delete('settings');
            if (importedStudents !== undefined) dirtyFields.current.delete('students');
            if (importedSubjects !== undefined) dirtyFields.current.delete('subjects');
            if (importedClasses !== undefined) dirtyFields.current.delete('classes');
            if (importedGrades !== undefined) dirtyFields.current.delete('grades');
            if (importedAssessments !== undefined) dirtyFields.current.delete('assessments');
            if (importedScores !== undefined) {
                // For scores, we only clear if NOT preserving pending local edits
                if (!isInitialLaunch || pendingChangesMap.current.scores.size === 0) {
                    dirtyFields.current.delete('scores');
                }
            }
            if (importedReportData !== undefined) dirtyFields.current.delete('reportData');
            if (importedClassData !== undefined) dirtyFields.current.delete('classData');
            if (importedUsers !== undefined) dirtyFields.current.delete('users');
            if (data.userLogs !== undefined) dirtyFields.current.delete('userLogs');
            if (data.activeSessions !== undefined) dirtyFields.current.delete('activeSessions');

            console.log('[DataContext] 🧹 Selectively cleared dirty fields after remote data load');
            // Recalculate global dirty state
            setHasLocalChanges(dirtyFields.current.size > 0);

            // Store original cloud data for smart dirty detection
            // We ONLY update originalData if it came from the cloud!
            // If we import a file, that file is effectively "New Local Changes" vs "Old Cloud Data"

            // SECURITY: Deep clone/Immutable merge for arrays to prevent reference sharing
            const mergeArrays = (field: keyof AppDataType, incoming: any[]) => {
                if (!incoming) return;
                // Since this is called when loading remote data, the cloud is the source of truth.
                // We should NOT merge with the existing local baseline, because that preserves items deleted from the cloud.
                const map = new Map();
                incoming.forEach(item => {
                    const id = getItemId(item);
                    if (id) map.set(id, item);
                });
                originalData.current[field] = Array.from(map.values()) as any;
            };

            if (importedSettings) originalData.current.settings = importedSettings;
            if (importedStudents) mergeArrays('students', importedStudents);
            if (importedSubjects) mergeArrays('subjects', importedSubjects);
            if (importedClasses) mergeArrays('classes', importedClasses);
            if (importedGrades) mergeArrays('grades', importedGrades);
            if (importedAssessments) mergeArrays('assessments', importedAssessments);
            if (importedScores) mergeArrays('scores', importedScores);
            if (importedReportData) mergeArrays('reportData', importedReportData);
            if (importedClassData) mergeArrays('classData', importedClassData);
            if (importedUsers) mergeArrays('users', importedUsers);
            if (data.userLogs) originalData.current.userLogs = data.userLogs;
            if (data.activeSessions) originalData.current.activeSessions = data.activeSessions;

            console.log('[DataContext] 💾 Updated originalData baseline with merge strategy');

            // Perform a full dirty recheck after remote data is loaded and originalData is updated.
            // We pass nextState to ensure the check uses the newly loaded/merged data rather than stale React state.
            recheckAllDirtyStatus(nextState);

            // Also force a delayed recheck just in case any effects had side effects
            setTimeout(() => {
                recheckAllDirtyStatus();
            }, 1000);
        } else {
            console.log('[DataContext] 💾 Local file import: Marking fields as dirty for verification');
            // We intentionally do NOT update originalData.current here.
            // Why? Because we want the Diff Logic (saveToCloud) to compare our NEW imported data
            // against the OLD originalData from the server, and detect EVERYTHING as "Changed".
            // However, our Diff Logic relies on IDs. 
            // If the imported file is identical to the server, Diff = 0.
            // If the imported file is totally different, Diff = Huge.
            // But wait, if we markDirty, saveToCloud will run.
            // saveToCloud calls getPendingUploadData which uses originalData to diff.
            // If originalData is empty (first load), it detects changes.
            // If originalData is populated, it will diff.
            // This is exactly what we want.
        }
    }, [schoolId, settings, students, subjects, classes, grades, assessments, scores, reportData, classData, users, userLogs, activeSessions, reconcileCollection, recheckAllDirtyStatus, unmarkDirty, markDirty, persistedPendingMap]);
    // END_LOAD_IMPORTED_DATA

const refreshFromCloud = React.useCallback(async (ignoreSyncLock: boolean = false, keysToRefresh?: (keyof AppDataType)[]): Promise<'throttled' | 'success' | 'error'> => {
        if (!schoolId) return 'error';

        // THROTTLING: Prevent spamming refresh (10s cooldown) unless specific keys are requested (programmatic refresh)
        const now = Date.now();
        if (!keysToRefresh && (now - lastGlobalRefresh.current < 10000)) {
            console.log(`[DataContext] 🛑 Refresh throttled. Please wait ${Math.ceil((10000 - (now - lastGlobalRefresh.current)) / 1000)}s.`);
            return 'throttled';
        }

        if (isSyncingRef.current && !ignoreSyncLock) {
            console.log("Sync already in progress, skipping manual refresh");
            return 'throttled';
        }

        if (!keysToRefresh) lastGlobalRefresh.current = now;

        try {
            isSyncingRef.current = true;
            setIsFetching(true);
            const refreshType = keysToRefresh ? `Partial (${keysToRefresh.join(', ')})` : 'FULL';
            console.log(`[DataContext] 📥 Manual refresh initiated - fetching data from cloud [${refreshType}]...`);

            // Capture loaded subjects before any clearing occurs
            const subjectsToFetch = Array.from(loadedSubjects.current) as number[];

            // Revert all local pending changes before fetching fresh data
            revertAllPendingChanges();

            // 1. Fetch Main Document (settings, users, access codes)
            const data = await getSchoolData(schoolId, keysToRefresh);

            if (data) {
                console.log('[DataContext] ✅ Main document fetched, applying updates...');

                // 2. Clear relevant pending states
                if (!keysToRefresh) {
                    Object.keys(pendingChangesMap.current).forEach(k => {
                        pendingChangesMap.current[k].clear();
                    });
                    loadedSubjects.current.clear();
                    console.log('[DataContext] 🧹 Cleared all pending changes and score cache for manual refresh');
                } else if (keysToRefresh.includes('scores')) {
                    pendingChangesMap.current.scores.clear();
                    // CRITICAL FIX: Clear the score cache so fresh scores are fetched when user navigates back
                    loadedSubjects.current.clear();
                    console.log('[DataContext] 🧹 Cleared score subject cache to force fresh fetch on next load');
                }

                // 3. Mark as remote update & Apply Main Doc Data
                isRemoteUpdate.current = true;
                loadImportedData(data, true);

                // 4. Force Fetch Subcollections (The "Missing Link" for Global Refresh)
                // This ensures we actually download fresh Students, Classes, etc.
                const promises: Promise<any>[] = [];

                // A) Metadata (Classes, Subjects, Assessments)
                if (!keysToRefresh || keysToRefresh.some(k => ['classes', 'subjects', 'assessments'].includes(k))) {
                    console.log('[DataContext] 🔄 Force refreshing Metadata (Classes, Subjects, Assessments)...');
                    promises.push(loadMetadata(true, true));
                }

                // B) Students (Only if requested or FULL refresh)
                if (!keysToRefresh || keysToRefresh.includes('students')) {
                    console.log('[DataContext] 🔄 Force refreshing Students subcollection...');
                    promises.push(loadStudents(undefined, true, true));
                }

                // C) Scores - Reload any currently viewed scores to show fresh data immediately
                if (!keysToRefresh || keysToRefresh.includes('scores')) {
                    console.log('[DataContext] 🔄 Force refreshing Score Buckets for loaded subjects...');
                    const loadedSubjectsArray = subjectsToFetch;
                    if (loadedSubjectsArray.length > 0) {
                        console.log(`[DataContext] 📊 Reloading ${loadedSubjectsArray.length} subject score buckets`);
                        const scoreRefreshPromises = loadedSubjectsArray.map((subjectId: number) =>
                            loadScores(undefined, subjectId, true, true)
                        );
                        promises.push(Promise.all(scoreRefreshPromises));
                    }
                }

                // D) Users - Loaded via Main Document (No Subcollection)


                await Promise.all(promises);

                console.log('[DataContext] 🎉 Manual refresh complete');

                // 5. Cleanup Local State
                draftScores.current.clear();
                if (keysToRefresh) {
                    keysToRefresh.forEach(k => dirtyFields.current.delete(k));
                } else {
                    dirtyFields.current.clear();
                }

                setHasLocalChanges(dirtyFields.current.size > 0);
                setDraftVersion(v => v + 1);

                if (!keysToRefresh) {
                    setRefreshVersion(v => v + 1); // Trigger UI hard reset for manual refresh
                    
                    // CRITICAL: Initial sync is now definitively complete.
                    // Subsequent snapshots or edits will follow mid-session diffing rules.
                    isInitialSyncing.current = false;
                    console.log('[DataContext] ⭐ Initial Sync Phase COMPLETE. Transitioning to mid-session diff mode.');
                }

                return 'success';
            } else {
                console.log('[DataContext] ⚠️ No data found for this school ID');
                return 'error';
            }
        } catch (error) {
            console.error('[DataContext] ❌ Failed to refresh data from cloud:', error);
            showDatabaseError(error, 'read');
            return 'error';
        } finally {
            setIsFetching(false);
            isSyncingRef.current = false;
        }
    }, [schoolId, loadImportedData, loadMetadata, loadStudents, loadScores, revertAllPendingChanges, showDatabaseError]);

    const mergeSubjects = React.useCallback((targetId: number, duplicateIds: number[]) => {
        if (!schoolId) return;

        console.log(`[DataContext] 🧬 Merging subjects ${duplicateIds.join(', ')} into target ${targetId}`);

        // 1. Merge Scores
        setScores(prev => {
            const next = [...prev];
            const duplicateIdStrings = duplicateIds.map(String);
            
            // Find all scores for the duplicate subjects
            const scoresToMerge = next.filter(s => duplicateIds.includes(s.subjectId));
            
            scoresToMerge.forEach(dupScore => {
                const studentId = dupScore.studentId;
                const targetScoreId = `${studentId}-${targetId}`;
                
                // Find if target already has a score for this student
                let targetScoreIdx = next.findIndex(s => s.id === targetScoreId);
                
                if (targetScoreIdx !== -1) {
                    const targetScore = next[targetScoreIdx];
                    // Merge assessmentScores
                    const mergedAssessmentScores = { ...targetScore.assessmentScores };
                    
                    Object.entries(dupScore.assessmentScores).forEach(([assessmentId, val]) => {
                        const aid = Number(assessmentId);
                        const existingVal = (mergedAssessmentScores[aid] || []) as any[];
                        // Combine non-empty unique values
                        let combined = Array.from(new Set([...existingVal, ...(val as any[])])).filter(v => v !== '');
                        
                        // If multi-score is not enabled, average the results
                        if (!MULTI_SCORE_ENTRY_ENABLED && combined.length > 1) {
                            const assessment = assessments.find(a => a.id === aid);
                            const defaultBasis = assessment?.weight || 100;
                            
                            let totalPct = 0;
                            let count = 0;
                            let lastBasis = defaultBasis;
                            
                            combined.forEach(s => {
                                if (!s) return;
                                const parts = s.split('/');
                                const num = Number(parts[0]);
                                if (isNaN(num)) return;
                                const den = parts[1] ? Number(parts[1]) : defaultBasis;
                                totalPct += (num / den);
                                count++;
                                lastBasis = den;
                            });
                            
                            if (count > 0) {
                                const avgPct = totalPct / count;
                                const avgScore = Number((avgPct * lastBasis).toFixed(1));
                                combined = [`${avgScore}/${lastBasis}`];
                            }
                        }
                        
                        mergedAssessmentScores[aid] = combined;
                    });
                    
                    // Update targetScore in place
                    next[targetScoreIdx] = { ...targetScore, assessmentScores: mergedAssessmentScores };
                    markItemDirty('scores', targetScoreId);
                } else {
                    // Target doesn't have a score, so just move this score to target
                    // But we still need to average if dupScore has multiple values and multi-score is off
                    const mergedAssessmentScores = { ...dupScore.assessmentScores };
                    
                    if (!MULTI_SCORE_ENTRY_ENABLED) {
                        Object.entries(mergedAssessmentScores).forEach(([assessmentId, val]) => {
                            const aid = Number(assessmentId);
                            const scores = (val || []) as any[];
                            if (scores.length > 1) {
                                const assessment = assessments.find(a => a.id === aid);
                                const defaultBasis = assessment?.weight || 100;
                                
                                let totalPct = 0;
                                let count = 0;
                                let lastBasis = defaultBasis;
                                
                                scores.forEach(s => {
                                    if (!s) return;
                                    const parts = s.split('/');
                                    const num = Number(parts[0]);
                                    if (isNaN(num)) return;
                                    const den = parts[1] ? Number(parts[1]) : defaultBasis;
                                    totalPct += (num / den);
                                    count++;
                                    lastBasis = den;
                                });
                                
                                if (count > 0) {
                                    const avgPct = totalPct / count;
                                    const avgScore = Number((avgPct * lastBasis).toFixed(1));
                                    mergedAssessmentScores[aid] = [`${avgScore}/${lastBasis}`];
                                }
                            }
                        });
                    }

                    const newScore = { 
                        ...dupScore, 
                        id: targetScoreId, 
                        subjectId: targetId,
                        assessmentScores: mergedAssessmentScores,
                        _isLocallyCreated: true // Mark as new so it uploads
                    };
                    next.push(newScore);
                    markItemDirty('scores', targetScoreId);
                }
            });
            
            // Remove duplicate scores from the state
            const final = next.filter(s => !duplicateIds.includes(s.subjectId));
            
            return final;
        });

        // 2. Update User Permissions
        setUsers(prev => {
            const nextUsers = prev.map(user => {
                let changed = false;
                
                // allowedSubjects
                let allowedSubjects = user.allowedSubjects || [];
                // Support both ID and Name (legacy)
                const targetSubject = subjects.find(s => s.id === targetId);
                const duplicateSubjects = subjects.filter(s => duplicateIds.includes(s.id));
                const duplicateNames = duplicateSubjects.map(s => s.subject);
                
                let newAllowed = allowedSubjects.map(s => {
                    if (typeof s === 'number' && duplicateIds.includes(s)) {
                        changed = true;
                        return targetId;
                    }
                    if (typeof s === 'string' && duplicateNames.includes(s)) {
                        changed = true;
                        return targetId; // Map to ID
                    }
                    return s;
                });
                // De-duplicate
                newAllowed = Array.from(new Set(newAllowed));
                
                // classSubjects
                let classSubjects = user.classSubjects || {};
                let newClassSubjects = { ...classSubjects };
                let classSubjectsChanged = false;

                Object.keys(newClassSubjects).forEach(cls => {
                    let subjectsList = newClassSubjects[cls] || [];
                    let updated = subjectsList.map(s => {
                        if (typeof s === 'number' && duplicateIds.includes(s)) {
                            changed = true;
                            classSubjectsChanged = true;
                            return targetId;
                        }
                        if (typeof s === 'string' && duplicateNames.includes(s)) {
                            changed = true;
                            classSubjectsChanged = true;
                            return targetId; // Map to ID
                        }
                        return s;
                    });
                    newClassSubjects[cls] = Array.from(new Set(updated));
                });
                
                if (changed) {
                    markItemDirty('users', user.id);
                    return { 
                        ...user, 
                        allowedSubjects: newAllowed as number[], 
                        classSubjects: newClassSubjects as Record<string, number[]> 
                    };
                }
                return user;
            });
            return nextUsers;
        });

        // 3. Delete Duplicate Subjects (Soft delete)
        duplicateIds.forEach(id => {
            deleteSubject(id);
        });

        markDirty('scores', true);
        markDirty('users', true);
        markDirty('subjects', true);
        setHasLocalChanges(true);

        console.log(`[DataContext] ✅ Subject merge complete locally. ${duplicateIds.length} subjects consolidated.`);
    }, [schoolId, subjects, markDirty, markItemDirty, deleteSubject]);

    const value: DataContextType = {
        users, setUsers,
        settings, setSettings, updateSettings,
        revertPendingChanges,
        revertAllPendingChanges,
        students: useMemo(() => students.filter(s => !s.deleted), [students]),
        deletedStudents: useMemo(() => students.filter(s => s.deleted), [students]),
        subjects: useMemo(() => subjects.filter(s => !s.deleted), [subjects]),
        deletedSubjects: useMemo(() => subjects.filter(s => s.deleted), [subjects]),
        classes: useMemo(() => classes.filter(c => !c.deleted), [classes]),
        deletedClasses: useMemo(() => classes.filter(c => c.deleted), [classes]),
        grades: useMemo(() => grades.filter(g => !g.deleted), [grades]),
        deletedGrades: useMemo(() => grades.filter(g => g.deleted), [grades]),
        assessments: useMemo(() => assessments.filter(a => !a.deleted), [assessments]),
        deletedAssessments: useMemo(() => assessments.filter(a => a.deleted), [assessments]),
        scores,
        reportData,
        classData,
        setAssessments,
        addStudent: addStudent,
        updateStudent: updateStudent,
        deleteStudent: deleteStudent,
        addSubject: addSubject,
        updateSubject: updateSubject,
        deleteSubject: deleteSubject,
        addClass: addClass,
        updateClass: updateClass,
        deleteClass: deleteClass,
        addGrade: gradeCrud.add,
        updateGrade: gradeCrud.update,
        deleteGrade: gradeCrud.delete,
        addAssessment,
        updateAssessment,
        deleteAssessment,
        updateStudentScores,
        getStudentScores,
        getReportData,
        updateReportData,
        getClassData,
        updateClassData,
        loadImportedData,
        saveToCloud,
        saveSettings,
        saveStudents,
        saveTeachers,
        saveSubjects,
        saveClasses,
        saveGrades,
        saveAssessments,
        saveScores,
        loadStudents,
        loadScores,
        loadMetadata, // Exposed Metadata Loader
        refreshFromCloud,
        schoolId,
        setSchoolId,
        // Network status
        isOnline,
        isSyncing,
        isFetching,
        queuedCount,
        // Sync control
        pauseSync,
        resumeSync,
        blockRemoteUpdates,
        allowRemoteUpdates,
        // User logs and sessions
        userLogs,
        activeSessions,
        // New exports
        onlineUsers,
        logUserAction,
        sendHeartbeat,
        hasLocalChanges,
        setHasLocalChanges,

        isDirty,
        getPendingUploadData,
        updateDraftScore,
        removeDraftScore,
        getComputedScore,
        draftVersion,
        pendingCount,
        isPageDirty,
        isItemDirty,
        subscription,
        isSettingDirty,
        isScoreDirty,
        isDraftScore,
        restoreDefaultGrades,
        refreshVersion,
        getOriginalItem: (field: keyof AppDataType, id: string | number) => {
            const collection = originalData.current[field];
            if (!Array.isArray(collection)) return null;
            return collection.find((item: any) => String(getItemId(item)) === String(id)) || null;
        },
        unreadNotificationCount: useMemo(() => {
            return userLogs.filter(log => !log.isRead && log.action !== 'Login').length;
        }, [userLogs]),
        markNotificationAsRead: (id: number) => {
            setUserLogs(prev => prev.map(log => log.id === id ? { ...log, isRead: true } : log));
            setHasLocalChanges(true);
            // We also need to ensure userLogs is considered dirty
            // In our system, markDirty is usually implicit in the update function
            // but we don't have a specific update method for userLogs yet.
            // Let's ensure markDirty if we had it, but for now hasLocalChanges triggers save logic
        },
        markAllNotificationsAsRead: () => {
            setUserLogs(prev => prev.map(log => ({ ...log, isRead: true })));
            setHasLocalChanges(true);
        },
        restoreItem: (field: keyof AppDataType, id: number) => {
            const userId = Number(localStorage.getItem('sba_user_id') || localStorage.getItem('emulator-sba_user_id'));
            const user = users?.find(u => u.id === userId);
            const isAdmin = user?.role === 'Admin';

            // Generic restoration logic
            const restore = (prev: any[]) => prev.map(item => {
                if (item.id === id) {
                    // Permission check
                    if (!isAdmin && item.deletedBy !== userId) {
                        console.error(`[DataContext] 🚫 Restoration blocked: User ${userId} is not an admin nor the original deleter of item ${id}`);
                        return item;
                    }
                    return { ...item, deleted: false, deletedAt: null, deletedBy: null };
                }
                return item;
            });

            if (field === 'students') setStudents(restore);
            else if (field === 'subjects') setSubjects(restore);
            else if (field === 'classes') setClasses(restore);
            else if (field === 'grades') setGrades(restore);
            else if (field === 'assessments') setAssessments(restore);
            else return;

            markDirty(field, true);
            markItemDirty(field as string, id);
        },
        permanentlyDeleteItem: (field: keyof AppDataType, id: number) => {
            const userId = Number(localStorage.getItem('sba_user_id') || localStorage.getItem('emulator-sba_user_id'));
            const user = users?.find(u => u.id === userId);
            const isAdmin = user?.role === 'Admin';

            if (!isAdmin) {
                console.error(`[DataContext] 🚫 Permanent deletion blocked: User ${userId} is not an admin.`);
                return;
            }

            // Generic permanent deletion logic (filtering out from state)
            const remove = (prev: any[]) => prev.filter(item => item.id !== id);

            if (field === 'students') setStudents(remove);
            else if (field === 'subjects') setSubjects(remove);
            else if (field === 'classes') setClasses(remove);
            else if (field === 'grades') setGrades(remove);
            else if (field === 'assessments') setAssessments(remove);
            else return;

            markDirty(field, true);
            markItemDirty(field as string, id);

            console.log(`[DataContext] 🗑️ Permanently deleted ${String(field)} item ${id}`);
        },
        mergeSubjects,
    };

    // Initialize originalData from local storage on load/schoolId change
    // This ensures that on F5 reload, we have a baseline for "clean" state
    // Clear drafts ONLY when school changes
    // Context reset effect: Clear transient states when School, Year, or Term changes
    useEffect(() => {
        draftScores.current.clear();
        setDraftVersion(0);
        loadedSubjects.current.clear(); // Clear cached subjects

        // Performance note: We don't clear settings/students here because they are
        // managed by schoolId-namespaced localStorage keys, but we DO clear
        // things that aren't namespaced or are cached in memory.
    }, [schoolId, settings.academicYear, settings.academicTerm]);

    // CRITICAL FIX: Do NOT initialize originalData from localStorage!
    // This was causing the "first change not detected" bug.
    // originalData should ONLY be set when cloud data is loaded via loadImportedData(),
    // which happens during initial cloud fetch and manual refresh.
    // If originalData is empty and user makes a change, markDirty will still work because
    // the smart dirty check in updateStudentScores (line 916-921) compares against
    // originalData.current.scores which will be undefined/empty, thus detecting the change.

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider. If you see this error during development, try refreshing the page to resolve hot module reload issues.');
    }
    return context;
};
