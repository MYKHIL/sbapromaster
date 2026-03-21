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
    addStudent: (student: Omit<Student, 'id'>) => void;
    updateStudent: (student: Student) => void;
    deleteStudent: (id: number) => void;
    // Subject CRUD
    addSubject: (subject: Omit<Subject, 'id'>) => void;
    updateSubject: (subject: Subject) => void;
    deleteSubject: (id: number) => void;
    // Class CRUD
    addClass: (cls: Omit<Class, 'id'>) => void;
    updateClass: (cls: Class) => void;
    deleteClass: (id: number) => void;
    // Grade CRUD
    addGrade: (grade: Omit<Grade, 'id'>) => void;
    updateGrade: (grade: Grade) => void;
    deleteGrade: (id: number) => void;
    // Assessment CRUD
    addAssessment: (assessment: Omit<Assessment, 'id'>) => void;
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
    loadScores: (classId: number, subjectId: number) => Promise<void>;

    // UI Feedback
    hasLocalChanges: boolean;
    setHasLocalChanges: (hasChanges: boolean) => void;
    isDirty: (...fields: (keyof AppDataType)[]) => boolean; // Check if specific fields have unsaved changes

    // Debug
    getPendingUploadData: () => Partial<AppDataType>;

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
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// Helper to extract primary key from collection items (handles id, studentId, classId)
export const getItemId = (item: any): string | undefined => {
    if (!item || typeof item !== 'object') return undefined;
    const id = item.id ?? item.studentId ?? item.subjectId ?? item.classId;
    return id !== undefined ? String(id) : undefined;
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
        const LATEST_VERSION = "1.0.152"; // Updated automatically by build script
        
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
    const originalData = React.useRef<Partial<AppDataType>>({
        settings: INITIAL_SETTINGS,
        students: undefined,
        subjects: undefined,
        classes: undefined,
        grades: undefined,
        assessments: undefined,
        scores: undefined,
        reportData: undefined,
        classData: undefined,
        users: undefined,
        userLogs: undefined,
        activeSessions: {}
    });

    // Track pending (uncommitted) changes for individual items in collections
    // Format: Record<field, Set<item_id>>
    const pendingChangesMap = React.useRef<Record<string, Set<string>>>({
        students: new Set(),
        subjects: new Set(),
        classes: new Set(),
        grades: new Set(),
        assessments: new Set(),
        scores: new Set(),
        reportData: new Set(),
        classData: new Set(),
        users: new Set(),
        settings: new Set(),
    });

    const markItemDirty = React.useCallback((field: string, itemOrId: any) => {
        const id = typeof itemOrId === 'object' ? getItemId(itemOrId) : String(itemOrId);
        if (!id || id === 'undefined' || id === 'null') return;
        if (!pendingChangesMap.current[field]) pendingChangesMap.current[field] = new Set();
        pendingChangesMap.current[field].add(id);
        markDirty(field as keyof AppDataType, true);
    }, []);

    const markItemClean = React.useCallback((field: string, itemOrId: any) => {
        const id = typeof itemOrId === 'object' ? getItemId(itemOrId) : String(itemOrId);
        if (!id || !pendingChangesMap.current[field]) return;
        pendingChangesMap.current[field].delete(id);
        if (pendingChangesMap.current[field].size === 0) {
            unmarkDirty(field as keyof AppDataType);
        }
    }, []);

    const isItemDirty = React.useCallback((field: keyof AppDataType, id: string | number) => {
        const currentItems = stateRef.current[field];
        const originalItems = originalData.current[field];

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

    // Track last loaded collection timestamps to prevent redundant fetches
    const lastLoadedTimestamps = React.useRef<Record<string, any>>({});
    const inflightPromises = React.useRef<Map<string, Promise<any>>>(new Map());

    const loadImportedData = (data: Partial<AppDataType>, isRemote: boolean = false, sub?: any) => {
        if (sub) setSubscription(sub);
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

        // ✅ ONLY update if imported data is ACTUALLY provided, not empty, AND different from current state
        const isInitialLaunch = isRemote && Object.keys(originalData.current).length === 0;

        const nextState: Partial<AppDataType> = {
            settings, students, subjects, classes, grades, assessments, scores, reportData, classData, users, userLogs, activeSessions
        };

        const processField = (field: keyof AppDataType, imported: any, current: any, setter: any) => {
            if (imported === undefined) return; // Only process if imported data is provided

            // PROTECTION: If this is a remote sync (not initial launch) and the field
            // already has local pending changes, DO NOT overwrite local state.
            // originalData will be updated to the cloud version below, so recheckAllDirtyStatus
            // will correctly detect and retain the dirty flag on the next run.
            if (isRemote && !isInitialLaunch && dirtyFields.current.has(field)) {
                console.log(`[DataContext] 🛡️ Remote Sync: Preserving local changes to '${String(field)}' — field is dirty. Skipping overwrite.`);
                return;
            }

            // Regular update or remote sync
            if (!isDataEqual(imported, current)) {
                console.log(`[DataContext] ✅ Updating ${String(field)}`);
                let dataToSet = imported;
                // If it's a local import, tag all items with _isLocallyCreated so they get uploaded
                if (!isRemote && Array.isArray(imported)) {
                    dataToSet = imported.map((item: any) => ({ ...item, _isLocallyCreated: true }));
                }
                setter(dataToSet);
                (nextState as any)[field] = dataToSet; // Track next state for recheck

                // CRITICAL: Only mark dirty if it's NOT a remote sync.
                // Remote syncs are the baseline, not "new local changes".
                if (!isRemote) {
                    markDirty(field, true);
                }
            }
        };

        processField('settings', importedSettings, settings, setSettings);
        processField('students', importedStudents, students, setStudents);
        processField('subjects', importedSubjects, subjects, setSubjects);
        processField('classes', importedClasses, classes, setClasses);
        processField('grades', importedGrades, grades, setGrades);
        processField('assessments', importedAssessments, assessments, setAssessments);
        processField('reportData', importedReportData, reportData, setReportData);
        processField('classData', importedClassData, classData, setClassData);
        processField('userLogs', data.userLogs, userLogs, setUserLogs);
        processField('activeSessions', data.activeSessions, activeSessions, setActiveSessions);
        processField('users', importedUsers, users, setUsers);

        // SCORES: Custom Logic to handle preservation of specific IDs
        if (importedScores && importedScores.length > 0) {
            let finalScores = importedScores;

            if (isInitialLaunch) {
                console.log('[DataContext] 🔍 Initial Cloud Load: Checking for uncommitted local scores...');
                finalScores = importedScores.map(cloudScore => {
                    const sid = getItemId(cloudScore);
                    const local = scores.find(s => getItemId(s) === sid);
                    if (local && !isDataEqual(local, cloudScore) && !isContextShift) {
                        // Only preserve if local has actual uncommitted data
                        const hasData = local.assessmentScores && Object.values(local.assessmentScores).some(s => Array.isArray(s) && s.some(v => v && String(v).trim() !== ''));

                        if (hasData) {
                            console.log(`[DataContext] 🛡️ Preservation: Keeping local uncommitted version of score ${sid}`);
                            if (sid) markItemDirty('scores', sid);
                            return local;
                        }
                    }
                    return cloudScore;
                });

                // Add any Local-Only scores (not in cloud yet)
                // BUT skip if context shifted (don't bring Term 1 scores to Term 2)
                const cloudIds = new Set(importedScores.map(s => getItemId(s)));
                if (!isContextShift) {
                    scores.forEach(localScore => {
                        const sid = getItemId(localScore);
                        if (sid && !cloudIds.has(sid)) {
                            const hasData = localScore.assessmentScores && Object.values(localScore.assessmentScores).some(s => Array.isArray(s) && s.some(v => v && String(v).trim() !== ''));
                            if (hasData) {
                                console.log(`[DataContext] ➕ Preservation: Keeping local-only score ${sid}`);
                                finalScores.push(localScore);
                                markItemDirty('scores', sid);
                            }
                        }
                    });
                }
            } else if (isRemote && pendingChangesMap.current.scores.size > 0) {
                // Standard Smart Merge for mid-session remote updates
                console.log(`[DataContext] 🛡️ Smart Merge: Preserving ${pendingChangesMap.current.scores.size} local score edits`);

                // Map Cloud scores but override with Local if pending
                finalScores = importedScores.map(cloudScore => {
                    if (pendingChangesMap.current.scores.has(String(cloudScore.id))) {
                        // Keep local version (find it in current state)
                        const local = scores.find(s => String(s.id) === String(cloudScore.id));
                        return local || cloudScore; // Fallback to cloud if local missing
                    }
                    return cloudScore;
                });

                // Add any Local-Only scores
                const cloudIds = new Set(importedScores.map(s => s.id));
                scores.forEach(localScore => {
                    if (pendingChangesMap.current.scores.has(String(localScore.id)) && !cloudIds.has(localScore.id)) {
                        finalScores.push(localScore);
                    }
                });
            }

            if (!isDataEqual(finalScores, scores)) {
                console.log(`[DataContext] ✅ Updating scores: ${finalScores.length} (Merged)`);
                setScores(finalScores);
                nextState.scores = finalScores; // Track next state
                if (!isRemote) markDirty('scores');
                else if (isInitialLaunch && pendingChangesMap.current.scores.size > 0) markDirty('scores', true);
            }
        } else if (importedScores && importedScores.length === 0) {
            // Explicit empty array update
            if (scores.length > 0) {
                setScores([]);
                nextState.scores = []; // Track next state
                if (!isRemote) markDirty('scores');
            }
        }

        // Sync users if present
        if (importedUsers) {
            SyncLogger.log(`loadImportedData: Loading users from document. Count: ${importedUsers.length}`);
            if (isInitialLaunch && !isDataEqual(importedUsers, users)) {
                console.log(`[DataContext] 🛡️ Preservation: Discrepancy in users. Keeping local.`);
                // markDirty('users', true);
                // nextState.users remains current
            } else if (!isDataEqual(importedUsers, users)) {
                console.log('[DataContext] ✅ Updating users:', importedUsers.length);
                setUsers(importedUsers);
                nextState.users = importedUsers; // Track next state
                // if (!isRemote) markDirty('users');
            }
        }

        if (isRemote) {
            // FIX: SELECTIVE CLEARING of dirty fields
            // We only clear the dirty flag for a field if we actually received data for it from the cloud.
            // This prevents "Ghost" updates or partial syncs from wiping out valid local changes in unrelated fields.

            if (importedSettings && !deepEqual(importedSettings, settings)) dirtyFields.current.delete('settings');
            if (importedStudents && importedStudents.length > 0 && !deepEqual(importedStudents, students)) dirtyFields.current.delete('students');
            if (importedSubjects && importedSubjects.length > 0 && !deepEqual(importedSubjects, subjects)) dirtyFields.current.delete('subjects');
            if (importedClasses && importedClasses.length > 0 && !deepEqual(importedClasses, classes)) dirtyFields.current.delete('classes');
            if (importedGrades && importedGrades.length > 0 && !deepEqual(importedGrades, grades)) dirtyFields.current.delete('grades');
            if (importedAssessments && importedAssessments.length > 0 && !deepEqual(importedAssessments, assessments)) dirtyFields.current.delete('assessments');
            if (importedScores && importedScores.length > 0) {
                // Only clear dirty flags if we DON'T have pending local changes to preserve
                if (pendingChangesMap.current.scores.size === 0) {
                    if (!deepEqual(importedScores, scores)) {
                        dirtyFields.current.delete('scores');
                    }
                } else {
                    console.log('[DataContext] ⚠️ Retaining dirty flag for scores due to pending local changes');
                }
            }
            if (importedReportData && importedReportData.length > 0 && !deepEqual(importedReportData, reportData)) dirtyFields.current.delete('reportData');
            if (importedClassData && importedClassData.length > 0 && !deepEqual(importedClassData, classData)) dirtyFields.current.delete('classData');
            if (importedUsers && importedUsers.length > 0 && !deepEqual(importedUsers, users)) dirtyFields.current.delete('users');
            if (data.userLogs) dirtyFields.current.delete('userLogs');
            if (data.activeSessions) dirtyFields.current.delete('activeSessions');

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
    };

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
            if (isLocallyChangingContext) {
                console.log("[DataContext] Context shift detected but marked as local edit. Skipping reset during typing.");
                return;
            }

            console.log(`[DataContext] 🔄 Context Change Detected: ${lastContextKey.current} -> ${currentContextKey}. Resetting collections.`);

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
            
            // 3. Wipe non-settings baseline data to force a fresh cloud fetch
            const settingsBaseline = originalData.current.settings;
            originalData.current = {
                settings: settingsBaseline
            };
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

    // Deep comparison helper to check if two values are equal
    const deepEqual = (a: any, b: any): boolean => {
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

    /**
     * Normalizes data for semantic comparison.
     * Trims strings, removes undefined/null keys, sorts arrays by ID,
     * and ensures consistent key types in assessment objects.
     */
    const normalizeData = (data: any): any => {
        if (data === null || data === undefined) return null;

        // 1. Strings: Trim
        if (typeof data === 'string') return data.trim();

        // 2. Arrays: Normalize elements and sort
        if (Array.isArray(data)) {
            const normalized = data.map(normalizeData).filter(item => item !== null);
            // Sort by ID using getItemId to ensure order-independence across all collection types
            if (normalized.length > 0 && normalized[0] && typeof normalized[0] === 'object') {
                return normalized.sort((a, b) => {
                    const idA = String(getItemId(a) || '');
                    const idB = String(getItemId(b) || '');
                    return idA.localeCompare(idB);
                });
            }
            return normalized;
        }

        // 3. Objects
        if (typeof data === 'object') {
            const normalized: any = {};
            // Filter out system-generated keys that shouldn't trigger "unsaved changes"
            const keys = Object.keys(data)
                .filter(k => !['_seconds', '_nanoseconds', 'createdAt', 'updatedAt', '__v', '_firestore'].includes(k))
                .sort();

            for (const key of keys) {
                // EXCEPTION: Convert 'id', 'studentId', 'classId', and 'age' to string to ensure consistent comparison
                const lowerKey = key.toLowerCase();
                if (lowerKey === 'id' || lowerKey.endsWith('id') || lowerKey === 'studentid' || lowerKey === 'classid' || lowerKey === 'age') {
                    normalized[key] = data[key] !== null && data[key] !== undefined ? String(data[key]) : data[key];
                    continue;
                }

                const value = normalizeData(data[key]);
                // Only include meaningful values (not null, undefined, or empty string)
                // Filter out empty arrays and objects as well to ensure semantic equality
                const isMeaningfulValue = (v: any) => {
                    if (v === null || v === undefined || v === '') return false;
                    if (Array.isArray(v) && v.length === 0) return false;
                    if (typeof v === 'object' && Object.keys(v).length === 0) return false;
                    return true;
                };

                if (isMeaningfulValue(value)) {
                    normalized[key] = value;
                }
            }

            // Special handling for Scores to normalize assessmentScores keys
            if ('assessmentScores' in data && typeof data.assessmentScores === 'object') {
                const normScores: any = {};
                const sKeys = Object.keys(data.assessmentScores).sort();
                for (const skey of sKeys) {
                    const sVal = normalizeData(data.assessmentScores[skey]);
                    // Only include non-empty arrays of scores
                    if (sVal && Array.isArray(sVal) && sVal.some(v => v !== '')) {
                        normScores[String(skey)] = sVal.filter(v => v !== '');
                    }
                }

                if (Object.keys(normScores).length > 0) {
                    normalized.assessmentScores = normScores;
                }
            }

            // Pruning: If object is empty after cleanup, treat as null for comparison
            // However, don't prune if the original object was already empty (base case)
            if (Object.keys(normalized).length === 0 && Object.keys(data).length > 0) {
                // Special case: don't prune if 'id' was the only property
                if (Object.keys(data).length === 1 && 'id' in data) {
                    return normalized;
                }
                return null;
            }
            return normalized;
        }

        return data;
    };

    /**
     * Checks if two data sets are semantically equal by normalizing them first.
     */
    const isDataEqual = (a: any, b: any, field?: keyof AppDataType): boolean => {
        if (a === b) return true;

        // 1. Treat null, undefined, and empty arrays as equivalent for collection fields
        const isEmpty = (v: any) => v === null || v === undefined || (Array.isArray(v) && v.length === 0);
        if (isEmpty(a) && isEmpty(b)) return true;

        const normA = normalizeData(a);
        const normB = normalizeData(b);
        const result = deepEqual(normA, normB);

        if (!result && field) {
            console.log(`[DataContext] 🔍 isDataEqual(${String(field)}): MISMATCH after normalization`, {
                normA,
                normB
            });
        }

        return result;
    };

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

        // If local data is semantically equal to the initial state, it's not a meaningful discrepancy
        // (i.e., it's just a fresh login/reload with no real uncommitted changes)
        const isDefault = isDataEqual(local, initialState);

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

    // Check if current data actually differs from original cloud data
    const recheckDirtyStatus = React.useCallback((field: keyof AppDataType, currentValue: any) => {
        const originalValue = originalData.current[field];

        // CRITICAL: If originalValue is undefined, we haven't loaded the cloud version for this field yet.
        // In this case, we cannot safely say the field is "dirty" compared to the cloud.
        if (originalValue === undefined) return;

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
            // Values differ, ensure it's marked dirty
            markDirty(field, true);
        }
    }, [markDirty]);

    const rebuildItemDirtyMap = React.useCallback((dataOverride?: Partial<AppDataType>) => {
        console.log('[DataContext] ⚒️ Rebuilding item-level dirty map...');
        const collections: (keyof AppDataType)[] = [
            'students', 'subjects', 'classes', 'grades', 'assessments', 'reportData', 'classData'
        ];

        let anyItemDirty = false;

        collections.forEach(field => {
            const current = dataOverride?.[field] || stateRef.current[field];
            const original = originalData.current[field];

            if (!Array.isArray(current) || !Array.isArray(original)) return;

            // Clear previous map for this field
            if (!pendingChangesMap.current[field]) pendingChangesMap.current[field] = new Set();
            pendingChangesMap.current[field].clear();

            current.forEach((item: any) => {
                const itemId = getItemId(item);
                if (!itemId) return;
                const origItem = original.find((o: any) => getItemId(o) === itemId);

                if (!origItem || !isDataEqual(item, origItem)) {
                    pendingChangesMap.current[field].add(itemId);
                    anyItemDirty = true;
                }
            });
        });

        // 2. Settings (Non-array granular tracking)
        const currentSettings = dataOverride?.settings || stateRef.current.settings;
        const originalSettings = originalData.current.settings;
        if (currentSettings && originalSettings) {
             if (!pendingChangesMap.current.settings) pendingChangesMap.current.settings = new Set();
             pendingChangesMap.current.settings.clear();
             
             Object.keys(currentSettings).forEach(key => {
                 const k = key as keyof SchoolSettings;
                 const isEq = deepEqual(currentSettings[k], originalSettings[k]);
                 if (!isEq) {
                     pendingChangesMap.current.settings.add(key);
                     anyItemDirty = true;
                 }
             });
        }

        if (anyItemDirty) {
            setDirtyVersion(v => v + 1);
        }
    }, [isDataEqual]);

    const recheckAllDirtyStatus = React.useCallback((dataOverride?: Partial<AppDataType>) => {
        console.log('[DataContext] 🔍 Performing full dirty recheck against cloud baseline...');
        const fieldsToCheck: (keyof AppDataType)[] = [
            'settings', 'students', 'subjects', 'classes', 'grades', 'assessments',
            'scores', 'reportData', 'classData', 'userLogs', 'activeSessions'
        ];

        for (const field of fieldsToCheck) {
            const val = dataOverride?.[field] !== undefined ? dataOverride[field] : stateRef.current[field];
            recheckDirtyStatus(field, val);
        }

        // Also rebuild item-level map
        rebuildItemDirtyMap(dataOverride);
    }, [recheckDirtyStatus, rebuildItemDirtyMap]);

    // Reactive effect to auto-recheck dirty status when data changes
    React.useEffect(() => {
        // Skip if we don't have original data loaded yet
        if (Object.keys(originalData.current).length === 0) return;

        // Perform full dirty recheck using LATEST state to avoid race conditions with stateRef
        recheckAllDirtyStatus({
            settings, students, subjects, classes, grades, assessments, scores, reportData, classData, users, userLogs, activeSessions
        });
    }, [settings, students, subjects, classes, grades, assessments, scores, reportData, classData, users, userLogs, activeSessions]);

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
                
                // Mark as remote update to prevent loopback marking it dirty
                isRemoteUpdate.current = true;
                stateSetter(data);
                
                // Update baseline for dirty tracking
                if (originalData.current) {
                    originalData.current[key as keyof AppDataType] = Array.isArray(data) ? [...data] : {...data} as any;
                }
                
                setTimeout(() => { isRemoteUpdate.current = false; }, 100);
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
                loadImportedData(data, true);
                if (data.metadata?.lastUpdated) {
                    lastLoadedTimestamps.current = { ...data.metadata.lastUpdated };
                }
                setTimeout(() => { isRemoteUpdate.current = false; }, 100);
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

        // FIX: Arrays on the main document are completely overwritten by Firebase merge.
        // If they are in the payload (meaning they have changes), we MUST send the FULL array.
        const MAIN_ARRAY_KEYS = ['reportData', 'classData', 'users', 'userLogs'];
        MAIN_ARRAY_KEYS.forEach(k => {
            if (transactionPayload[k] !== undefined) {
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
                
                // Uses the new generalized transaction helper
                await saveDataTransaction(schoolId, transactionPayload, transactionDeletions, stateRef.current.students);
            } else {
                console.log('[DataContext] ℹ️ No actionable updates or deletions found for transaction.');
            }

            console.log('[DataContext] ✅ Data saved to cloud successfully!');

            // OPTIMIZED: Skip refresh if we already have the data locally and just saved it.
            // This prevents the redundant "Get" immediately after "Create/Update".
            // The local state is and originalData are already updated below.
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

                // CRITICAL: Update originalData to match the new server state
                // This prevents the "Preview" from showing these items as changed in future saves
                const key = field as keyof AppDataType;
                // CRITICAL: Update originalData to match the new server state.
                // We MUST check transactionDeletions as well, because if a field has ONLY deletions,
                // transactionPayload[key] will be undefined, but we still need to update the baseline.
                const hasUpdates = transactionPayload[key] !== undefined;
                const hasDeletions = transactionDeletions[key] !== undefined;

                if (hasUpdates || hasDeletions) {
                    const dataToClone = currentData[key];
                    if (Array.isArray(dataToClone)) {
                        // For arrays (collections)
                        originalData.current[key] = [...dataToClone] as any;
                    } else if (dataToClone && typeof dataToClone === 'object') {
                        // For objects (settings, activeSessions)
                        originalData.current[key] = { ...dataToClone as any } as any;
                    } else {
                        // For primitives (if any)
                        originalData.current[key] = dataToClone as any;
                    }

                    // CRITICAL: Update the "Last Loaded" metadata timestamp to match the new server state.
                    // This prevents loadStudents/loadMetadata from thinking the local data is stale 
                    // and triggering a redundant fetch immediately after save.
                    if (lastLoadedTimestamps.current[key]) {
                        lastLoadedTimestamps.current[`_loaded_${String(key)}`] = lastLoadedTimestamps.current[key];
                    }
                }
            });

            // Update hasLocalChanges based on remaining dirty fields
            setHasLocalChanges(dirtyFields.current.size > 0);

            // FIX: Explicitly clear pending score changes and force pendingCount update
            // This ensures that scores are no longer marked as "Pending" even if deepEqual logic has edge cases
            if (fieldsToSave.includes('scores')) {
                pendingChangesMap.current.scores.clear();
            }
            // Clear other maps if field was saved
            fieldsToSave.forEach(field => {
                if (pendingChangesMap.current[field]) pendingChangesMap.current[field].clear();
            });
            setDirtyVersion(v => v + 1);

            setIsSyncing(false);
            isSyncingRef.current = false;
        } catch (error) {
            console.error('[DataContext] ❌ Failed to save data to cloud:', error);

            // Show database error modal for critical errors
            // Pass 'write' context so App.tsx knows to show Toast for quota errors
            showDatabaseError(error, 'write');

            // FIX: Don't add to offline queue if it's a permanent error like Quota Exceeded or Permission Denied
            // These will never resolve by retrying immediately, and we don't want to clutter the queue
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

    const refreshFromCloud = async (ignoreSyncLock: boolean = false, keysToRefresh?: (keyof AppDataType)[]): Promise<'throttled' | 'success' | 'error'> => {
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
    };

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
        setStudents(prev => {
            const sequentialIds = prev.map(i => typeof i.id === 'number' ? i.id : 0).filter(id => id < 1000000);
            const maxId = sequentialIds.length > 0 ? Math.max(...sequentialIds) : 0;
            const newId = maxId + 1;
            markItemDirty('students', newId);
            const newItem = { ...student, id: newId, _isLocallyCreated: true } as Student;
            const next = [...prev, newItem];
            return next;
        });
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
        setSubjects(prev => {
            const sequentialIds = prev.map(i => typeof i.id === 'number' ? i.id : 0).filter(id => id < 1000000);
            const maxId = sequentialIds.length > 0 ? Math.max(...sequentialIds) : 0;
            const newId = maxId + 1;
            markItemDirty('subjects', newId);
            const newItem = { ...subject, id: newId, _isLocallyCreated: true } as Subject;
            const next = [...prev, newItem];
            return next;
        });
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
        setClasses(prev => {
            const sequentialIds = prev.map(i => typeof i.id === 'number' ? i.id : 0).filter(id => id < 1000000);
            const maxId = sequentialIds.length > 0 ? Math.max(...sequentialIds) : 0;
            const newId = maxId + 1;
            markItemDirty('classes', newId);
            const newItem = { ...cls, id: newId, _isLocallyCreated: true } as Class;
            const next = [...prev, newItem];
            return next;
        });
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

            // FIX: Arrays on the main document are completely overwritten by Firebase merge.
            // If they are in the payload (meaning they have changes), we MUST send the FULL array.
            const MAIN_ARRAY_KEYS = ['reportData', 'classData', 'users', 'userLogs'];
            MAIN_ARRAY_KEYS.forEach(k => {
                if (updates[k] !== undefined) {
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
                originalData.current.settings = { ...settings };
            } else if (Array.isArray(data)) {
                // Replace the baseline with the current live state after a successful save.
                // CRITICAL: We must NOT use a merge-only Map here because deleted items would
                // remain in originalData, causing them to re-appear on the next remote sync
                // (the smart merge would see them as "local-only unsaved items" and re-add them).
                // stateRef.current[field] reflects the true post-deletion state.
                originalData.current[field] = [...(stateRef.current[field] as any[])] as any;
            }

            // Clear granular dirty map for this field
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
    const getPendingUploadData = React.useCallback((limitToFields?: (keyof AppDataType)[]): any => {
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

        // Use current state variables directly instead of Ref to ensure Render-Cycle freshness
        const currentData: AppDataType = {
            settings, students, subjects, classes, grades, assessments, scores, reportData, classData, users, userLogs, activeSessions
        };
        const payload: any = {};
        const deletions: any = {};

        // GRANULAR ROLE-BASED GUARD
        // Fetch current user from localStorage/state to verify permissions
        const storedUserId = localStorage.getItem('sba_user_id') || localStorage.getItem('emulator-sba_user_id');
        const currentUser = (storedUserId && users) ? users.find(u => String(u.id) === storedUserId) : null;
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
                        // PREVIEW FIX: If it's explicitly in the pendingChangesMap, include it
                        // This handles cases like "Restore System Default" where data might match cloud but is statefully unsaved
                        const pendingSet = pendingChangesMap.current[field];
                        if (pendingSet && pendingSet.has(itemId)) return true;

                        const originalItem = originalVal.find((o: any) => getItemId(o) === itemId);

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
                        settingsPayload[k] = settings[k];
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
    }, [schoolId, users, settings, students, subjects, classes, grades, assessments, scores, reportData, classData, userLogs, activeSessions]);

    // Draft Score State
    const draftScores = useRef<Map<string, string>>(new Map());
    const [draftVersion, setDraftVersion] = useState(0); // Used to force updates in subscribers

    // Cache for loaded subjects to prevent redundant fetches
    const loadedSubjects = useRef<Set<number>>(new Set());

    // Update the draft value for a score (marks it as dirty)
    const updateDraftScore = (studentId: number, subjectId: number, assessmentId: number, value: string) => {
        const key = `${studentId}-${subjectId}-${assessmentId}`;
        draftScores.current.set(key, value);

        // Update derived state
        setHasLocalChanges(true);
        // Notify subscribers (inputs) that drafts have changed
        setDraftVersion(prev => prev + 1);
    };

    // Remove a score from draft (marks it as clean/reverted or saved)
    const removeDraftScore = (studentId: number, subjectId: number, assessmentId: number) => {
        const key = `${studentId}-${subjectId}-${assessmentId}`;
        if (draftScores.current.delete(key)) {
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
        const payload = getPendingUploadData();
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
    }, [getPendingUploadData, dirtyVersion, draftVersion]);

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

    // -------------------------------------------------------------------------
    // PAGE-SPECIFIC DIRTY CHECKER
    // -------------------------------------------------------------------------
    const isPageDirty = React.useCallback((pageName: Page): boolean => {
        const PAGE_DATA_MAPPING: Record<string, (keyof AppDataType)[]> = {
            'School Setup': ['settings'],
            'Teachers': ['users'],
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
        // This is more accurate than checking dirtyFields.current.has(field)
        // because it filters out reverted or non-meaningful changes.
        const pendingData = getPendingUploadData(fields);
        const hasActualChanges = Object.keys(pendingData).length > 0;
        if (hasActualChanges) return true;

        // 2. Special check for Score Entry (draft scores)
        if (pageName === 'Score Entry' || pageName === 'Score Summary') {
            if (draftScores.current.size > 0) return true;
        }

        return false;
    }, [getPendingUploadData, draftVersion]);

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
    }, [schoolId]); // STABILIZED: Removed students.length dependency

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
                    setScores(prev => {
                        // 1. Update originalData first (Baseline)
                        // CRITICAL: We must remove any scores for this subject from the baseline first,
                        // because initializeOriginalData might have prepopulated it with offline edits.
                        const currentOriginal = (originalData.current.scores || []) as Score[];
                        const originalMap = new Map<string, Score>(currentOriginal.map(s => [String(getItemId(s)), s]));

                        // Remove all scores for this subject
                        for (const [key, score] of originalMap.entries()) {
                            if (score.subjectId === subjectId) {
                                originalMap.delete(key);
                            }
                        }

                        // Add the true cloud scores
                        newScores.forEach(s => {
                            const sid = getItemId(s);
                            if (sid) originalMap.set(sid, s);
                        });
                        originalData.current.scores = Array.from(originalMap.values());

                        // 2. DISCARD LOCAL CHANGES if ignorePreservation is set (Global Refresh)
                        if (ignorePreservation) {
                            // Only replace scores for THIS subject to avoid wiped state on lazy loads
                            const otherSubjectScores = prev.filter(s => s.subjectId !== subjectId);
                            return [...otherSubjectScores, ...newScores];
                        }

                        // 3. Perform Smart Merge to preserve local changes
                        const prevMap = new Map(prev.map(s => [String(getItemId(s)), s]));

                        newScores.forEach(cloudScore => {
                            const sid = getItemId(cloudScore);
                            if (!sid) return;
                            const local = prevMap.get(sid) as Score | undefined;

                            // Preserve local if it differs from cloud AND is meaningful
                            if (local && !isDataEqual(local, cloudScore)) {
                                const hasMeaningfulLocalChange = Object.values(local.assessmentScores || {}).some(
                                    s => Array.isArray(s) && s.some(v => v !== null && v !== undefined && String(v).trim() !== '')
                                );

                                if (hasMeaningfulLocalChange) {
                                    console.log(`[DataContext] 🛡️ Preservation: Keeping local version of score ${cloudScore.id} during lazy load`);
                                    markItemDirty('scores', cloudScore.id);
                                    return; // Don't overwrite local with cloud
                                }
                            }

                            // Otherwise adoption cloud version
                            prevMap.set(String(cloudScore.id), cloudScore);
                        });

                        // Ensure local-only scores are also marked dirty
                        const cloudIds = new Set(newScores.map(s => String(s.id)));
                        prev.forEach(localScore => {
                            // Only process scores for the current subject being verified
                            if (localScore.subjectId === subjectId && !cloudIds.has(String(localScore.id))) {
                                const hasData = localScore.assessmentScores && Object.values(localScore.assessmentScores).some(s => Array.isArray(s) && s.some(v => v !== null && v !== undefined && String(v).trim() !== ''));
                                if (hasData) {
                                    console.log(`[DataContext] ➕ Preservation: Keeping local-only score ${localScore.id} during lazy load`);
                                    markItemDirty('scores', localScore.id);
                                }
                            }
                        });

                        return Array.from(prevMap.values());
                    });

                    // Recalculate dirty states now that originalData is updated
                    recheckAllDirtyStatus();
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
    }, [schoolId]);

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
        subscription,
        isItemDirty,
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
            // We don't need markItemDirty for deletion as getPendingUploadData detects missing IDs
            console.log(`[DataContext] 🗑️ Permanently deleted ${String(field)} item ${id}`);
        },
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
