import React, { createContext, useContext, ReactNode, useState, useEffect, useRef, useMemo } from 'react';
import { subscribeToSchoolData, AppDataType, updateHeartbeat, logUserActivity, getSchoolData, saveDataTransaction, fetchStudents, fetchScoresForClass, subscribeToResource, fetchSubcollection, fetchMetadataBundle, updateMetadataBundle, updateStudentBucket, ensureStudentBucketExists } from '../services/firebaseService';
import * as SyncLogger from '../services/syncLogger';
import useLocalStorage from '../hooks/useLocalStorage';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { offlineQueue } from '../services/offlineQueue';
import { useDatabaseError } from './DatabaseErrorContext';
import { useFirebaseAnalytics } from './FirebaseAnalyticsContext';
import { isQuotaExhaustedError } from '../utils/databaseErrorHandler';
import type { Student, Subject, Class, Grade, Assessment, Score, SchoolSettings, ReportSpecificData, ClassSpecificData, User, UserLog, OnlineUser, Page } from '../types';
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
    subjects: Subject[];
    classes: Class[];
    grades: Grade[];
    assessments: Assessment[];
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
    updateDraftScore: (studentId: number, assessmentId: number, subjectId: number, value: string) => void;
    removeDraftScore: (studentId: number, assessmentId: number, subjectId: number) => void;
    getComputedScore: (studentId: number, assessmentId: number, subjectId: number) => string;
    draftVersion: number; // Increment to trigger re-renders of inputs
    pendingCount: number;
    isPageDirty: (pageName: Page) => boolean;
    revertPendingChanges: (field: keyof AppDataType, id?: number | string) => void;
    revertAllPendingChanges: () => void;
    isItemDirty: (field: keyof AppDataType, id: string | number) => boolean;
    isSettingDirty: (field: keyof SchoolSettings) => boolean;
    isScoreDirty: (studentId: number, subjectId: number, assessmentId: number) => boolean;
    isDraftScore: (studentId: number, subjectId: number, assessmentId: number) => boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);


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
    const [students, setStudents] = useLocalStorage<Student[]>(getKey('students'), INITIAL_STUDENTS);
    const [subjects, setSubjects] = useLocalStorage<Subject[]>(getKey('subjects'), INITIAL_SUBJECTS);
    const [classes, setClasses] = useLocalStorage<Class[]>(getKey('classes'), INITIAL_CLASSES);
    const [grades, setGrades] = useLocalStorage<Grade[]>(getKey('grades'), INITIAL_GRADES);
    const [assessments, setAssessments] = useLocalStorage<Assessment[]>(getKey('assessments'), INITIAL_ASSESSMENTS);
    const [scores, setScores] = useLocalStorage<Score[]>(getKey('scores'), INITIAL_SCORES);
    const [reportData, setReportData] = useLocalStorage<ReportSpecificData[]>(getKey('report-data'), INITIAL_REPORT_DATA);
    const [classData, setClassData] = useLocalStorage<ClassSpecificData[]>(getKey('class-data'), INITIAL_CLASS_DATA);
    const isRemoteUpdate = React.useRef(false);
    const lastLocalUpdate = React.useRef(Date.now());



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

    // Track original cloud data to compare against current state
    const originalData = React.useRef<Partial<AppDataType>>({});

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
    });

    const markItemDirty = React.useCallback((field: string, id: string | number) => {
        if (!pendingChangesMap.current[field]) pendingChangesMap.current[field] = new Set();
        pendingChangesMap.current[field].add(String(id));
        markDirty(field as keyof AppDataType, true);
    }, []);

    const markItemClean = React.useCallback((field: string, id: string | number) => {
        if (pendingChangesMap.current[field]) {
            pendingChangesMap.current[field].delete(String(id));
            // Optional: If set becomes empty, we COULD unmark the field as dirty?
            // But recheckDirtyStatus handles that more robustly.
        }
    }, []);

    const isItemDirty = React.useCallback((field: keyof AppDataType, id: string | number) => {
        const fieldStr = String(field);
        if (pendingChangesMap.current[fieldStr]) {
            return pendingChangesMap.current[fieldStr].has(String(id));
        }
        return false;
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

        // SMART MERGING: Only update state if imported data is ACTUALLY provided and not empty
        // This prevents replacing valid local data with undefined/empty cloud data
        const {
            settings: importedSettings,
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

        // ✅ ONLY update if imported data is ACTUALLY provided, not empty, AND different from current state
        const isInitialLaunch = isRemote && Object.keys(originalData.current).length === 0;

        const processField = (field: keyof AppDataType, imported: any, current: any, setter: any) => {
            if (imported === undefined) return; // Only process if imported data is provided

            // For initial launch, we PREFER local uncommitted changes IF they are meaningful
            if (isInitialLaunch) {
                if (!isDataEqual(imported, current)) {
                    // Check if the local discrepancy is "meaningful" (i.e. not just default initial state)
                    if (isMeaningfulDiscrepancy(field, current)) {
                        console.log(`[DataContext] 🛡️ Preservation: Meaningful discrepancy in ${field} on initial load. Keeping local version.`);
                        markDirty(field, true);
                        return; // Keep local state
                    } else {
                        console.log(`[DataContext] 🔄 Initial Load: Local ${field} is just default state. Adopting cloud version.`);
                        // Continue to setter(imported) below...
                    }
                }
            }

            // Regular update or remote sync
            if (!isDataEqual(imported, current)) {
                console.log(`[DataContext] ✅ Updating ${field}`);
                setter(imported);

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

        // SCORES: Custom Logic to handle preservation of specific IDs
        if (importedScores && importedScores.length > 0) {
            let finalScores = importedScores;

            if (isInitialLaunch) {
                console.log('[DataContext] 🔍 Initial Cloud Load: Checking for uncommitted local scores...');
                finalScores = importedScores.map(cloudScore => {
                    const local = scores.find(s => s.id === cloudScore.id);
                    if (local && !isDataEqual(local, cloudScore)) {
                        // Only preserve if local has actual uncommitted data
                        const hasData = local.assessmentScores && Object.values(local.assessmentScores).some(s => Array.isArray(s) && s.some(v => v && String(v).trim() !== ''));

                        if (hasData) {
                            console.log(`[DataContext] 🛡️ Preservation: Keeping local uncommitted version of score ${cloudScore.id}`);
                            markItemDirty('scores', cloudScore.id);
                            return local;
                        }
                    }
                    return cloudScore;
                });

                // Add any Local-Only scores (not in cloud yet)
                const cloudIds = new Set(importedScores.map(s => s.id));
                scores.forEach(localScore => {
                    if (localScore.id && !cloudIds.has(localScore.id)) {
                        const hasData = localScore.assessmentScores && Object.values(localScore.assessmentScores).some(s => Array.isArray(s) && s.some(v => v && String(v).trim() !== ''));
                        if (hasData) {
                            console.log(`[DataContext] ➕ Preservation: Keeping local-only score ${localScore.id}`);
                            finalScores.push(localScore);
                            markItemDirty('scores', localScore.id);
                        }
                    }
                });
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
                if (!isRemote) markDirty('scores');
                else if (isInitialLaunch && pendingChangesMap.current.scores.size > 0) markDirty('scores', true);
            }
        } else if (importedScores && importedScores.length === 0) {
            // Explicit empty array update
            if (scores.length > 0) {
                setScores([]);
                if (!isRemote) markDirty('scores');
            }
        }

        // Sync users if present
        if (importedUsers) {
            SyncLogger.log(`loadImportedData: Loading users from document. Count: ${importedUsers.length}`);
            if (isInitialLaunch && !isDataEqual(importedUsers, users)) {
                console.log(`[DataContext] 🛡️ Preservation: Discrepancy in users. Keeping local.`);
                markDirty('users', true);
            } else if (!isDataEqual(importedUsers, users)) {
                console.log('[DataContext] ✅ Updating users:', importedUsers.length);
                setUsers(importedUsers);
                if (!isRemote) markDirty('users');
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
                const existing = (originalData.current[field] as any[]) || [];
                const map = new Map(existing.map((item: any) => [String(item.id), item]));
                incoming.forEach(item => map.set(String(item.id), item));
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

            // CRITICAL: Perform a full dirty recheck after remote data is loaded and originalData is updated.
            // This catches cases where local data (from previous offline session or localStorage)
            // differs from what was just downloaded from the cloud.
            recheckAllDirtyStatus();
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

    // CRITICAL: When schoolId changes, reset all data to prevent cross-school contamination
    const previousSchoolId = React.useRef<string | null>(schoolId);
    React.useEffect(() => {
        if (previousSchoolId.current !== null && previousSchoolId.current !== schoolId) {
            console.log(`SchoolId changed from ${previousSchoolId.current} to ${schoolId}, resetting all data`);

            // Clear all state to prevent old school data from lingering
            setSettings(INITIAL_SETTINGS);
            setStudents(INITIAL_STUDENTS);
            setSubjects(INITIAL_SUBJECTS);
            setClasses(INITIAL_CLASSES);
            setGrades(INITIAL_GRADES);
            setAssessments(INITIAL_ASSESSMENTS);
            setScores(INITIAL_SCORES);
            setReportData(INITIAL_REPORT_DATA);
            setClassData(INITIAL_CLASS_DATA);
            // CRITICAL FIX: Do NOT reset users here! Users are loaded from cloud via loadImportedData
            // Resetting them to [] triggers auto-save which deletes all users from cloud database
            // setUsers([]);
            setUserLogs([]);
            setActiveSessions({});

            // CRITICAL: Clear dirty fields to prevent stale save state
            dirtyFields.current.clear();
            setHasLocalChanges(false);

            // Clear draft scores to prevent stale UI state
            draftScores.current.clear();
            setDraftVersion(0);

            // Clear original data on logout
            originalData.current = {};
        } else if (previousSchoolId.current === null && schoolId !== null) {
            // Fresh login: SchoolId just became set.
            // OPTIMIZATION: We removed the duplicate refreshFromCloud() call here.
            // The separate useEffect below (fetchInitialData) handles the initial load.
        }
        previousSchoolId.current = schoolId;
    }, [schoolId]);

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

        // 2. Arrays: Normalize elements and sort if they have IDs
        if (Array.isArray(data)) {
            const normalized = data.map(normalizeData).filter(item => item !== null);
            // Sort by ID if present to ensure order-independence
            if (normalized.length > 0 && normalized[0] && typeof normalized[0] === 'object' && ('id' in normalized[0])) {
                // Ensure IDs are compared as strings for sorting
                return normalized.sort((a, b) => String(a.id).localeCompare(String(b.id)));
            }
            return normalized;
        }

        // 3. Objects
        if (typeof data === 'object') {
            const normalized: any = {};
            const keys = Object.keys(data).sort();

            for (const key of keys) {
                // EXCEPTION: Convert 'id' and any key ending in 'Id' to string to ensure consistent comparison
                // (Firestore number vs LocalStorage string)
                if (key.toLowerCase() === 'id' || key.toLowerCase().endsWith('id')) {
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
    const isDataEqual = (a: any, b: any): boolean => {
        if (a === b) return true;
        const normA = normalizeData(a);
        const normB = normalizeData(b);
        return deepEqual(normA, normB);
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
        if (isDataEqual(local, initialState)) return false;

        // Otherwise, if it differs from cloud (checked elsewhere), it's a real change to preserve
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
                setHasLocalChanges(dirtyFields.current.size > 0);
                setDirtyVersion(v => v + 1); // Force re-render
            }
        } else {
            // Values differ, ensure it's marked dirty
            markDirty(field, true);
        }
    }, [markDirty]);

    const recheckAllDirtyStatus = React.useCallback(() => {
        console.log('[DataContext] 🔍 Performing full dirty recheck against cloud baseline...');
        const fieldsToCheck: (keyof AppDataType)[] = [
            'settings', 'students', 'subjects', 'classes', 'grades', 'assessments',
            'scores', 'reportData', 'classData', 'users', 'userLogs', 'activeSessions'
        ];

        const currentData: AppDataType = {
            settings, students, subjects, classes, grades, assessments, scores, reportData, classData, users, userLogs, activeSessions
        };

        for (const field of fieldsToCheck) {
            recheckDirtyStatus(field, currentData[field]);
        }
    }, [settings, students, subjects, classes, grades, assessments, scores, reportData, classData, users, userLogs, activeSessions, recheckDirtyStatus]);

    // Reactive effect to auto-recheck dirty status when data changes
    React.useEffect(() => {
        // Skip if we don't have original data loaded yet
        if (Object.keys(originalData.current).length === 0) return;

        // Recheck each field in dirtyFields to see if it's still actually different
        // FIX: Include all fields to ensure robust dirty checking
        const fieldsToCheck: (keyof AppDataType)[] = [
            'settings', 'students', 'subjects', 'classes', 'grades', 'assessments',
            'scores', 'reportData', 'classData', 'users', 'userLogs', 'activeSessions'
        ];

        for (const field of fieldsToCheck) {
            if (dirtyFields.current.has(field)) {
                let currentValue;
                switch (field) {
                    case 'settings': currentValue = settings; break;
                    case 'students': currentValue = students; break;
                    case 'subjects': currentValue = subjects; break;
                    case 'classes': currentValue = classes; break;
                    case 'grades': currentValue = grades; break;
                    case 'assessments': currentValue = assessments; break;
                    case 'scores': currentValue = scores; break;
                    case 'reportData': currentValue = reportData; break;
                    case 'classData': currentValue = classData; break;
                    case 'users': currentValue = users; break;
                    case 'userLogs': currentValue = userLogs; break;
                    case 'activeSessions': currentValue = activeSessions; break;
                    default: continue;
                }
                recheckDirtyStatus(field, currentValue);
            }
        }
    }, [settings, students, subjects, classes, grades, assessments, scores, reportData, classData, users, userLogs, activeSessions]);

    // AUTO-SYNC REMOVED: All saves are now manual and page-specific

    const saveToCloud = async (isManualSave: boolean = false, skipRefresh: boolean = false) => {
        // CRITICAL: Check if sync is paused (during authentication)
        if (isSyncPaused.current) {
            console.log("Sync is paused (likely during authentication), skipping save");
            return;
        }

        if (!schoolId) {
            console.log("No school ID, skipping cloud save.");
            return;
        }

        // Prevent concurrent syncs
        if (isSyncingRef.current) {
            console.log("Sync already in progress, skipping duplicate sync");
            return;
        }

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
                await saveDataTransaction(schoolId, transactionPayload, transactionDeletions);
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
                if (transactionPayload[key]) {
                    // For scores, we need to merge because we only sent a partial update
                    if (key === 'scores' && Array.isArray(transactionPayload.scores)) {
                        const updatedScores = transactionPayload.scores as Score[];
                        const currentOriginal = (originalData.current.scores as Score[]) || [];

                        // Merge strategy: Replace items with matching IDs, add new ones
                        const newOriginalScores = [...currentOriginal];
                        updatedScores.forEach(update => {
                            const index = newOriginalScores.findIndex(s => s.id === update.id);
                            if (index > -1) {
                                newOriginalScores[index] = update;
                            } else {
                                newOriginalScores.push(update);
                            }
                        });
                        // Handle deletes if any
                        if (transactionDeletions.scores) {
                            const deletedIds = new Set(transactionDeletions.scores);
                            originalData.current.scores = newOriginalScores.filter(s => !deletedIds.has(s.id));
                        } else {
                            originalData.current.scores = newOriginalScores;
                        }
                    } else {
                        // For other fields, we sent the FULL data
                        originalData.current[key] = currentData[key] as any;
                    }

                    // CRITICAL: Update the "Last Loaded" metadata timestamp to match the new server state.
                    // This prevents loadStudents/loadMetadata from thinking the local data is stale 
                    // and triggering a redundant fetch immediately after save.
                    if (lastLoadedTimestamps.current[key]) {
                        lastLoadedTimestamps.current[`_loaded_${key}`] = lastLoadedTimestamps.current[key];
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
            setIsSyncing(true);
            const refreshType = keysToRefresh ? `Partial (${keysToRefresh.join(', ')})` : 'FULL';
            console.log(`[DataContext] 📥 Manual refresh initiated - fetching data from cloud [${refreshType}]...`);

            // 1. Fetch Main Document (settings, users, access codes)
            const data = await getSchoolData(schoolId, keysToRefresh);

            if (data) {
                console.log('[DataContext] ✅ Main document fetched, applying updates...');

                // 2. Clear relevant pending states
                if (!keysToRefresh || keysToRefresh.includes('scores')) {
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
                    promises.push(loadMetadata(true));
                }

                // B) Students (Only if requested or FULL refresh)
                if (!keysToRefresh || keysToRefresh.includes('students')) {
                    console.log('[DataContext] 🔄 Force refreshing Students subcollection...');
                    promises.push(loadStudents(undefined, true));
                }

                // C) Scores - Reload any currently viewed scores to show fresh data immediately
                if (!keysToRefresh || keysToRefresh.includes('scores')) {
                    console.log('[DataContext] 🔄 Force refreshing Score Buckets for loaded subjects...');
                    // For each subject that was already loaded, force reload its scores
                    const loadedSubjectsArray = Array.from(loadedSubjects.current) as number[];
                    if (loadedSubjectsArray.length > 0) {
                        console.log(`[DataContext] 📊 Reloading ${loadedSubjectsArray.length} subject score buckets`);
                        const scoreRefreshPromises = loadedSubjectsArray.map((subjectId: number) =>
                            fetchScoresForClass(schoolId, 0, subjectId)
                                .then(freshScores => {
                                    // Merge fresh scores into state
                                    if (freshScores && freshScores.length > 0) {
                                        setScores(prev => {
                                            const scoreMap = new Map(prev.map(s => [s.id, s]));
                                            freshScores.forEach(s => scoreMap.set(s.id, s));
                                            return Array.from(scoreMap.values());
                                        });
                                    }
                                    return freshScores;
                                })
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
            setIsSyncing(false);
            isSyncingRef.current = false;
        }
    };

    // Real-time sync listener
    // INITIAL DATA LOAD ONLY (Auto-Sync Disabled by User Request)
    // We fetch data once when the school loads, but do NOT listen for real-time updates.
    useEffect(() => {
        if (!schoolId) return;

        // OPTIMIZATION: Prevention of Double-Fetch on Login
        // Gate 1: Session must be unlocked (Login completed)
        if (!isSessionUnlocked) {
            console.log(`[DataContext] 🔒 Session locked. Deferring initial data fetch for ${schoolId}...`);
            return;
        }

        // Gate 2: If we already have data (already loaded or offline persistence), 
        // we should NOT fetch again.
        // We check 'settings.schoolName' as a proxy for valid loaded data.
        if (settings.schoolName && users.length > 0) {
            console.log(`[DataContext] 🛑 Initial data already present (School: ${settings.schoolName}). Skipping auto-fetch to prevent leaks.`);

            // Even if we skip fetch, we might want to ensure metadata timestamps are set if they are missing
            // But usually loadImportedData sets them.

            // Ensure metadata is loaded if missing (lazy load check)
            loadMetadata();
            return;
        }

        const fetchInitialData = async () => {
            try {
                console.log('[DataContext] 📥 Fetching initial data from cloud (Auto-Sync Disabled)...');
                const data = await getSchoolData(schoolId);
                if (data) {
                    console.log('[DataContext] ✅ Initial data received via one-time fetch');
                    SyncLogger.log(`Initial data loaded. Users: ${data.users?.length || 0}, Scores: ${data.scores?.length || 0}`);

                    // Mark as remote update to allow processing (IsRemote = true)
                    loadImportedData(data, true);

                    // Store metadata timestamps for lazy loading
                    if (data.metadata?.lastUpdated) {
                        lastLoadedTimestamps.current = { ...data.metadata.lastUpdated };
                    }

                    // -----------------------------------------------------------------
                    // OPTIMIZED: Metadata is light, fetch it. Students are heavy, WAIT.
                    // -----------------------------------------------------------------
                    console.log('[DataContext] 🚀 Eagerly loading Metadata for app initialization...');
                    loadMetadata();

                    // Students are now TRULY Lazy Loaded ONLY when the page is visited.
                    // loadStudents(); // REMOVED
                } else {
                    console.log('[DataContext] ⚠️ No initial data found for school');
                }
            } catch (error) {
                console.error('[DataContext] ❌ Failed to fetch initial data:', error);
                showDatabaseError(error, 'read');
            }
        };

        fetchInitialData();
    }, [schoolId, isSessionUnlocked]);

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
            setItems(prev => [...prev, { ...item, id: maxId + 1 } as T]);
        },
        update: (updatedItem: T) => {
            markDirty(fieldKey, true);
            setItems(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
        },
        delete: (id: number) => {
            markDirty(fieldKey, true);
            setItems(prev => prev.filter(item => item.id !== id));
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
            const newItem = { ...student, id: maxId + 1 } as Student;
            const next = [...prev, newItem];
            if (schoolId) {
                updateStudentBucket(schoolId, next).catch(e => console.error('Failed to update student bucket after addStudent', e));
            }
            return next;
        });
    };

    const updateStudent = (updatedStudent: Student) => {
        markDirty('students', true);
        setStudents(prev => {
            const next = prev.map(item => item.id === updatedStudent.id ? updatedStudent : item);
            if (schoolId) {
                updateStudentBucket(schoolId, next).catch(e => console.error('Failed to update student bucket after updateStudent', e));
            }
            return next;
        });
    };

    const deleteStudent = (id: number) => {
        markDirty('students', true);
        setStudents(prev => {
            const next = prev.filter(item => item.id !== id);
            if (schoolId) {
                updateStudentBucket(schoolId, next).catch(e => console.error('Failed to update student bucket after deleteStudent', e));
            }
            return next;
        });
    };

    // Custom Assessment CRUD to handle exam ordering
    const addAssessment = (assessment: Omit<Assessment, 'id'>) => {
        markDirty('assessments', true);
        const newAssessment = { ...assessment, id: Date.now() };
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
        setAssessments(prev => prev.map(item => item.id === updatedAssessment.id ? updatedAssessment : item));
    };
    const deleteAssessment = (id: number) => {
        markDirty('assessments', true);
        setAssessments(prev => prev.filter(item => item.id !== id));
    };

    // Wrapped subject CRUD that also updates the metadata bundle on changes
    const addSubject = (subject: Omit<Subject, 'id'>) => {
        markDirty('subjects', true);
        setSubjects(prev => {
            const sequentialIds = prev.map(i => typeof i.id === 'number' ? i.id : 0).filter(id => id < 1000000);
            const maxId = sequentialIds.length > 0 ? Math.max(...sequentialIds) : 0;
            const newItem = { ...subject, id: maxId + 1 } as Subject;
            const next = [...prev, newItem];
            if (schoolId) {
                updateMetadataBundle(schoolId, { subjects: next }).catch(e => console.error('Failed to update metadata bundle after addSubject', e));
            }
            return next;
        });
    };

    const updateSubject = (updatedSubject: Subject) => {
        markDirty('subjects', true);
        setSubjects(prev => {
            const next = prev.map(item => item.id === updatedSubject.id ? updatedSubject : item);
            if (schoolId) {
                updateMetadataBundle(schoolId, { subjects: next }).catch(e => console.error('Failed to update metadata bundle after updateSubject', e));
            }
            return next;
        });
    };

    const deleteSubject = (id: number) => {
        markDirty('subjects', true);
        setSubjects(prev => {
            const next = prev.filter(item => item.id !== id);
            if (schoolId) {
                updateMetadataBundle(schoolId, { subjects: next }).catch(e => console.error('Failed to update metadata bundle after deleteSubject', e));
            }
            return next;
        });
    };

    // Wrapped class CRUD that also updates the metadata bundle on changes
    const addClass = (cls: Omit<Class, 'id'>) => {
        markDirty('classes', true);
        setClasses(prev => {
            const sequentialIds = prev.map(i => typeof i.id === 'number' ? i.id : 0).filter(id => id < 1000000);
            const maxId = sequentialIds.length > 0 ? Math.max(...sequentialIds) : 0;
            const newItem = { ...cls, id: maxId + 1 } as Class;
            const next = [...prev, newItem];
            if (schoolId) {
                updateMetadataBundle(schoolId, { classes: next }).catch(e => console.error('Failed to update metadata bundle after addClass', e));
            }
            return next;
        });
    };

    const updateClass = (updatedClass: Class) => {
        markDirty('classes', true);
        setClasses(prev => {
            const next = prev.map(item => item.id === updatedClass.id ? updatedClass : item);
            if (schoolId) {
                updateMetadataBundle(schoolId, { classes: next }).catch(e => console.error('Failed to update metadata bundle after updateClass', e));
            }
            return next;
        });
    };

    const deleteClass = (id: number) => {
        markDirty('classes', true);
        setClasses(prev => {
            const next = prev.filter(item => item.id !== id);
            if (schoolId) {
                updateMetadataBundle(schoolId, { classes: next }).catch(e => console.error('Failed to update metadata bundle after deleteClass', e));
            }
            return next;
        });
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
                };
                return [...prev, newEntry];
            }
        });
    };

    const updateSettings = (updates: Partial<SchoolSettings>) => {
        markDirty('settings', true);
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

            // Use transaction for all saves to ensure consistency
            await saveDataTransaction(schoolId, updates, _deletions);

            // Clear dirty flag for this field
            dirtyFields.current.delete(field);
            setHasLocalChanges(dirtyFields.current.size > 0);

            console.log(`[savePageData] ✅ ${String(field)} saved successfully!`);
            setIsSyncing(false);
            isSyncingRef.current = false;
        } catch (error) {
            console.error(`[savePageData] ❌ Failed to save ${field}:`, error);
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
            // Or we could trust the queue. The queue contains partials now.
            // But 'currentData' here is the FULL state.
            // The `saveDataTransaction` function performs the smart merge:
            // 1. Adds/Updates items from `currentData`
            // 2. Removes items specified in `deletions` (if safe)

            // Use the transactional save to perform a SMART MERGE of the offline state
            // This prevents overwriting server data (like the "Data Wipe" bug caused by setDoc/merge:true on arrays)
            saveDataTransaction(schoolId, currentData, deletions)
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
    }, [isOnline, schoolId, settings, students, subjects, classes, grades, assessments, scores, reportData, classData]);

    // FIX: Add logic to process activeSessions and determine online users
    // An online user is one who has a heartbeat within the last 5 minutes (300000ms)
    // We update our own heartbeat every minute if active
    const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

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
                        lastActive: timestamp as string
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
            id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            userId,
            userName,
            role: role as any,
            action,
            timestamp: new Date().toISOString(),
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
        console.log(`[DataContext] 🔄 Reverting pending change for ${field} (ID: ${id})`);

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

                // If no more dirty fields, clear global flag
                if (dirtyFields.current.size === 0) setHasLocalChanges(false);
                setDirtyVersion(v => v + 1);
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
            const originalItem = originalVal.find(i => String(i.id) === String(id));

            let newArray = [...currentVal];

            if (originalItem) {
                // RESTORE: Replace current item with original
                // @ts-ignore
                const idx = newArray.findIndex(i => String(i.id) === String(id));
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
                newArray = newArray.filter(i => String(i.id) !== String(id));
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
    const getPendingUploadData = (limitToFields?: (keyof AppDataType)[]): any => {
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
        // This fixes the "First Edit" lag where the Ref wasn't updated yet during the render cycle
        const currentData: AppDataType = {
            settings, students, subjects, classes, grades, assessments, scores, reportData, classData, users, userLogs, activeSessions
        };
        const payload: any = {};
        const deletions: any = {};

        fieldsToSave.forEach(f => {
            const field = f as keyof AppDataType;
            // @ts-ignore
            const currentVal = currentData[field];
            const originalVal = originalData.current[field];

            // Perform smart diff for arrays to only show changed items in preview
            if (Array.isArray(currentVal) && Array.isArray(originalVal)) {

                // 1. Check for Deletions
                const deletedIds = originalVal
                    .filter((o: any) => o && o.id && !currentVal.find((c: any) => c && c.id === o.id))
                    .map((o: any) => String(o.id));

                if (deletedIds.length > 0) {
                    console.log(`[DataContext] 🗑️ Detected Deletions for ${field}:`, deletedIds);
                    deletions[field] = deletedIds;
                }

                // 2. Check for Adds/Updates
                // @ts-ignore
                const updates = currentVal.filter(item => {
                    // Start by checking if item has an ID (most of our data types do)
                    if (item && typeof item === 'object' && 'id' in item) {
                        // Use loose ID comparison to prevent type mismatch issues (string vs number)
                        const originalItem = originalVal.find((o: any) => String(o.id) === String(item.id));

                        // If it's a new item, check if it's explicitly marked as a local addition/preserved change
                        if (!originalItem) {
                            const pendingSet = pendingChangesMap.current[field];
                            return pendingSet && pendingSet.has(String(item.id));
                        }

                        // Existing item: Semantic comparison
                        return !isDataEqual(item, originalItem);
                    }
                    // Fallback for non-ID arrays: Semantic comparison of whole array? 
                    // Usually we don't hit this for our top-level fields
                    return true;
                });

                if (updates.length > 0) {
                    payload[field] = updates;
                }

            } else {
                // @ts-ignore
                payload[field] = currentVal;
            }
        });

        if (Object.keys(deletions).length > 0) {
            payload._deletions = deletions;
        }

        return payload;
    };

    // Draft Score State
    const draftScores = useRef<Map<string, string>>(new Map());
    const [draftVersion, setDraftVersion] = useState(0); // Used to force updates in subscribers

    // Cache for loaded subjects to prevent redundant fetches
    const loadedSubjects = useRef<Set<number>>(new Set());

    // Update the draft value for a score (marks it as dirty)
    const updateDraftScore = (studentId: number, assessmentId: number, subjectId: number, value: string) => {
        const key = `${studentId}-${subjectId}-${assessmentId}`;
        draftScores.current.set(key, value);

        // Update derived state
        setHasLocalChanges(true);
        // Notify subscribers (inputs) that drafts have changed
        setDraftVersion(prev => prev + 1);
    };

    // Remove a score from draft (marks it as clean/reverted or saved)
    const removeDraftScore = (studentId: number, assessmentId: number, subjectId: number) => {
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
            if (Array.isArray(val)) {
                count += val.length;
            } else if (val && typeof val === 'object' && Object.keys(val).length > 0) {
                count += 1;
            }
        });

        // CRITICAL FIX: Add draft scores count to pending count
        // This ensures the Save button is enabled while typing
        count += draftScores.current.size;

        return count;
    }, [dirtyVersion, draftVersion, settings, students, subjects, classes, grades, assessments, scores, reportData, classData, users, userLogs, activeSessions]);

    // Get the score to display: prefer draft, fallback to saved
    const getComputedScore = (studentId: number, assessmentId: number, subjectId: number): string => {
        const draftKey = `${studentId}-${subjectId}-${assessmentId}`;
        if (draftScores.current.has(draftKey)) {
            return draftScores.current.get(draftKey) || '';
        }
        // Fallback to saved data
        const savedScores = getStudentScores(studentId, subjectId, assessmentId);
        return savedScores[0] || '';
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

        // 1. Check if any mapped field is in dirtyFields
        const hasDirtyField = fields.some(field => dirtyFields.current.has(field));
        if (hasDirtyField) return true;

        // 2. Special check for Score Entry (draft scores)
        if (pageName === 'Score Entry' || pageName === 'Score Summary') {
            if (draftScores.current.size > 0) return true;
        }

        return false;
    }, []);

    // -------------------------------------------------------------------------
    // LAZY LOADING IMPLEMENTATION
    // -------------------------------------------------------------------------

    const loadStudents = React.useCallback(async (limit: number = 0, force: boolean = false) => {
        if (!schoolId) return;

        // Metadata Check: Only fetch if server has newer data than what we last loaded
        const serverTimestamp = lastLoadedTimestamps.current['students'];
        const loadedTimestamp = lastLoadedTimestamps.current['_loaded_students'];

        // Refined isUpToDate:
        // 1. If forced, always fetch.
        // 2. If no students loaded, always fetch.
        // 3. If we have students AND (no server timestamp OR local matches server), we are up to date.
        const isUpToDate = !force &&
            students.length > 0 &&
            (!serverTimestamp || deepEqual(serverTimestamp, loadedTimestamp));

        console.log(`[DataContext] 🔍 loadStudents Check:`, {
            studentsCount: students.length,
            serverTS: serverTimestamp,
            loadedTS: loadedTimestamp,
            isUpToDate,
            hasInflight: inflightPromises.current.has(`students-${limit}`)
        });

        // PROTECTION: Never overwrite local data if we have unsaved students
        const isDirty = dirtyFields.current.has('students');
        if (isDirty && !force) {
            console.log(`[DataContext] 🛡️ Students have unsaved local changes. Skipping fetch to prevent data loss.`);
            return;
        }

        if (isUpToDate) {
            console.log(`[DataContext] 🧠 Students up-to-date. Skipping read.`);
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
                        // 1. Update originalData (Baseline)
                        const currentOriginal = originalData.current.students || [];
                        const originalMap = new Map(currentOriginal.map(s => [String(s.id), s]));
                        newStudents.forEach(s => originalMap.set(String(s.id), s));
                        originalData.current.students = Array.from(originalMap.values());

                        // 2. Smart Merge to preserve local edits
                        const prevMap = new Map(prev.map(s => [String(s.id), s]));
                        newStudents.forEach(cloudStudent => {
                            const local = prevMap.get(String(cloudStudent.id));

                            // If local has real changes (not default state) and cloud is different, preserve local
                            if (local && !isDataEqual(local, cloudStudent) && isMeaningfulDiscrepancy('students', local)) {
                                console.log(`[DataContext] 🛡️ Preservation: Keeping local version of student ${cloudStudent.id}`);
                                markDirty('students', true);
                                return;
                            }
                            prevMap.set(String(cloudStudent.id), cloudStudent);
                        });

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

    const loadScores = React.useCallback(async (classId: number, subjectId: number, force: boolean = false) => {
        if (!schoolId) return;

        // Cache Check - We track loaded subjects, not class-subjects
        if (!force && loadedSubjects.current.has(subjectId)) {
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
                    if (newScores.length > 0) {
                        console.log(`[DataContext] ✅ Loaded ${newScores.length} scores for Subject ${subjectId}.`);
                        setScores(prev => {
                            // 1. Update originalData first (Baseline)
                            const currentOriginal = originalData.current.scores || [];
                            const originalMap = new Map(currentOriginal.map(s => [String(s.id), s]));
                            newScores.forEach(s => originalMap.set(String(s.id), s));
                            originalData.current.scores = Array.from(originalMap.values());

                            // 2. Perform Smart Merge to preserve local changes
                            const prevMap = new Map(prev.map(s => [String(s.id), s]));

                            newScores.forEach(cloudScore => {
                                const local = prevMap.get(String(cloudScore.id)) as Score | undefined;

                                // Preserve local if it differs from cloud AND is meaningful
                                // (meaningful = has data that cloud doesn't have or differs)
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

                            return Array.from(prevMap.values());
                        });

                        // Recalculate dirty states now that originalData is updated
                        recheckAllDirtyStatus();
                    } else {
                        console.log(`[DataContext] ⚠️ No scores found for Subject ${subjectId}.`);
                    }
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
    const loadMetadata = React.useCallback(async (force: boolean = false) => {
        if (!schoolId) return;

        // Metadata Check
        const sTS = lastLoadedTimestamps.current['subjects'];
        const cTS = lastLoadedTimestamps.current['classes'];
        const aTS = lastLoadedTimestamps.current['assessments'];

        // Check if we already have data or if we've successfully loaded at least once
        const hasData = classes.length > 0 || subjects.length > 0 || assessments.length > 0;
        const previouslyLoaded = lastLoadedTimestamps.current['_loaded_classes'] !== undefined;

        const isUpToDate = !force && (
            (hasData || previouslyLoaded) &&
            (!cTS || deepEqual(cTS, lastLoadedTimestamps.current['_loaded_classes'])) &&
            (!sTS || deepEqual(sTS, lastLoadedTimestamps.current['_loaded_subjects'])) &&
            (!aTS || deepEqual(aTS, lastLoadedTimestamps.current['_loaded_assessments']))
        );

        console.log(`[DataContext] 🔍 loadMetadata Check:`, {
            hasData,
            previouslyLoaded,
            isUpToDate,
            inflight: inflightPromises.current.has('metadata')
        });

        // PROTECTION: Skip if metadata fields are dirty
        const isDirty = dirtyFields.current.has('classes') || dirtyFields.current.has('subjects') || dirtyFields.current.has('assessments');
        if (isDirty && !force) {
            console.log(`[DataContext] 🛡️ Metadata has unsaved local changes. Skipping fetch to prevent data loss.`);
            return;
        }

        if (isUpToDate) {
            console.log(`[DataContext] 🧠 Metadata up-to-date (Metadata Match). Skipping read.`);
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

                // Use composite bundle strategy: 1 read for all metadata vs 3 separate reads
                const { classes: fetchedClasses, subjects: fetchedSubjects, assessments: fetchedAssessments } = await fetchMetadataBundle(schoolId);

                setClasses(fetchedClasses);
                setSubjects(fetchedSubjects);
                setAssessments(fetchedAssessments);

                // Update originalData (Baseline)
                originalData.current.classes = fetchedClasses;
                originalData.current.subjects = fetchedSubjects;
                originalData.current.assessments = fetchedAssessments;

                lastLoadedTimestamps.current['_loaded_classes'] = cTS || 'loaded_once';
                lastLoadedTimestamps.current['_loaded_subjects'] = sTS || 'loaded_once';
                lastLoadedTimestamps.current['_loaded_assessments'] = aTS || 'loaded_once';

                // Recalculate dirty states
                recheckAllDirtyStatus();

                console.log(`[DataContext] ✅ Metadata Loaded: ${fetchedClasses.length} Classes, ${fetchedSubjects.length} Subjects, ${fetchedAssessments.length} Assessments`);
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
        students,
        subjects,
        classes,
        grades,
        assessments,
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
        users, // Added users
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
    };

    // Initialize originalData from local storage on load/schoolId change
    // This ensures that on F5 reload, we have a baseline for "clean" state
    // Clear drafts ONLY when school changes
    useEffect(() => {
        draftScores.current.clear();
        setDraftVersion(0);
        loadedSubjects.current.clear(); // Clear cached subjects
    }, [schoolId]);

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
