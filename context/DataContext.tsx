import React, { createContext, useContext, ReactNode, useState, useEffect, useRef, useMemo } from 'react';
import { subscribeToSchoolData, AppDataType, updateHeartbeat, logUserActivity, getSchoolData, saveDataTransaction, fetchStudents, fetchScoresForClass, subscribeToResource, fetchSubcollection } from '../services/firebaseService';
import * as SyncLogger from '../services/syncLogger';
import useLocalStorage from '../hooks/useLocalStorage';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { offlineQueue } from '../services/offlineQueue';
import { useDatabaseError } from './DatabaseErrorContext';
import { isQuotaExhaustedError } from '../utils/databaseErrorHandler';
import type { Student, Subject, Class, Grade, Assessment, Score, SchoolSettings, ReportSpecificData, ClassSpecificData, User, UserLog, OnlineUser } from '../types';
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

    refreshFromCloud: () => Promise<void>;
    schoolId: string | null;
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
    loadStudents: (limit?: number) => Promise<void>;
    loadScores: (classId: number, subjectId: number) => Promise<void>;
    loadMetadata: () => Promise<void>;

    // UI Feedback
    hasLocalChanges: boolean;
    setHasLocalChanges: (hasChanges: boolean) => void;
    isDirty: (...fields: (keyof AppDataType)[]) => boolean; // Check if specific fields have unsaved changes

    // Debug
    getPendingUploadData: () => Partial<AppDataType>;

    // Draft score synchronization
    updateDraftScore: (studentId: number, assessmentId: number, value: string) => void;
    removeDraftScore: (studentId: number, assessmentId: number) => void;
    getComputedScore: (studentId: number, assessmentId: number, subjectId: number) => string;
    draftVersion: number; // Increment to trigger re-renders of inputs
    pendingCount: number;
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

    // Wrapped setUsers with logging to track all changes
    const setUsers = (value: React.SetStateAction<User[]>) => {
        const newValue = typeof value === 'function' ? value(users) : value;
        SyncLogger.log(`setUsers called. Current count: ${users.length}, New count: ${newValue.length}`);
        SyncLogger.log(`Stack trace: ${new Error().stack}`);
        setUsersInternal(newValue);
    };

    // Track overall local changes for UI feedback (e.g. enabling Upload button)
    const [hasLocalChanges, setHasLocalChanges] = useState(false);
    // Force re-renders when dirty state changes (since dirtyFields is a ref)
    const [dirtyVersion, setDirtyVersion] = useState(0);

    // Track original cloud data to compare against current state
    const originalData = React.useRef<Partial<AppDataType>>({
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
    });

    // Track pending (uncommitted) score changes - fields that have been modified but not saved
    const pendingScoreChanges = React.useRef<Set<string>>(new Set()); // Format: "studentId-assessmentId"

    // FIX: Use a Ref to hold the latest state for saveToCloud to access during retries
    // This prevents the "stale closure" bug where a postponed save uses old data
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

    // FIX: Implement function to overwrite all data from an imported file or cloud sync
    const loadImportedData = (data: Partial<AppDataType>, isRemote: boolean = true) => {
        // CRITICAL: Mark this as a remote update to prevent syncing back to cloud
        // ONLY if it's a remote update. If it's a local file import, we WANT to mark as dirty.
        if (isRemote) {
            isRemoteUpdate.current = true;
            // Automatically reset after 500ms to allow all effects to settle
            setTimeout(() => {
                isRemoteUpdate.current = false;
            }, 500);
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
        if (importedSettings && !deepEqual(importedSettings, settings)) {
            console.log('[DataContext] ✅ Updating settings');
            setSettings(prev => ({ ...prev, ...importedSettings }));
            if (!isRemote) markDirty('settings');
        }
        if (importedStudents && importedStudents.length > 0 && !deepEqual(importedStudents, students)) {
            console.log('[DataContext] ✅ Updating students:', importedStudents.length);
            setStudents(importedStudents);
            if (!isRemote) markDirty('students');
        }
        if (importedSubjects && importedSubjects.length > 0 && !deepEqual(importedSubjects, subjects)) {
            console.log('[DataContext] ✅ Updating subjects:', importedSubjects.length);
            setSubjects(importedSubjects);
            if (!isRemote) markDirty('subjects');
        }
        if (importedClasses && importedClasses.length > 0 && !deepEqual(importedClasses, classes)) {
            console.log('[DataContext] ✅ Updating classes:', importedClasses.length);
            setClasses(importedClasses);
            if (!isRemote) markDirty('classes');
        }
        if (importedGrades && importedGrades.length > 0 && !deepEqual(importedGrades, grades)) {
            console.log('[DataContext] ✅ Updating grades:', importedGrades.length);
            setGrades(importedGrades);
            if (!isRemote) markDirty('grades');
        }
        if (importedAssessments && importedAssessments.length > 0 && !deepEqual(importedAssessments, assessments)) {
            console.log('[DataContext] ✅ Updating assessments:', importedAssessments.length);
            setAssessments(importedAssessments);
            if (!isRemote) markDirty('assessments');
        }
        // SCORES: Smart Merge with Pending Data
        if (importedScores && importedScores.length > 0) {
            let finalScores = importedScores;
            // If we have pending changes, we MUST preserve them against the cloud update
            if (isRemote && pendingScoreChanges.current.size > 0) {
                console.log(`[DataContext] 🛡️ Smart Merge: Preserving ${pendingScoreChanges.current.size} local score edits`);

                // Map Cloud scores but override with Local if pending
                finalScores = importedScores.map(cloudScore => {
                    if (pendingScoreChanges.current.has(cloudScore.id)) {
                        // Keep local version (find it in current state)
                        const local = scores.find(s => s.id === cloudScore.id);
                        return local || cloudScore; // Fallback to cloud if local missing
                    }
                    return cloudScore;
                });

                // Add any Local-Only scores (newly created items not in cloud yet)
                const cloudIds = new Set(importedScores.map(s => s.id));
                scores.forEach(localScore => {
                    if (pendingScoreChanges.current.has(localScore.id) && !cloudIds.has(localScore.id)) {
                        finalScores.push(localScore);
                    }
                });
            }

            if (!deepEqual(finalScores, scores)) {
                console.log(`[DataContext] ✅ Updating scores: ${finalScores.length} (Merged)`);
                setScores(finalScores);
                if (!isRemote) markDirty('scores');
            }
        } else {
            console.log('[DataContext] 🚫 Skipping scores update - data is empty/undefined');
        }
        if (importedReportData && importedReportData.length > 0 && !deepEqual(importedReportData, reportData)) {
            console.log('[DataContext] ✅ Updating reportData:', importedReportData.length);
            setReportData(importedReportData);
            if (!isRemote) markDirty('reportData');
        }
        if (importedClassData && importedClassData.length > 0 && !deepEqual(importedClassData, classData)) {
            console.log('[DataContext] ✅ Updating classData:', importedClassData.length);
            setClassData(importedClassData);
            if (!isRemote) markDirty('classData');
        }

        // Sync users if present
        SyncLogger.log(`loadImportedData: Loading users. Count: ${importedUsers?.length || 0}`);
        // CRITICAL LOOP PREVENTION: AuthOverlay syncs back to us. Check equality.
        if (importedUsers && importedUsers.length > 0 && !deepEqual(importedUsers, users)) {
            console.log('[DataContext] ✅ Updating users:', importedUsers.length);
            setUsers(importedUsers);
            if (!isRemote) markDirty('users');
        } else {
            console.log('[DataContext] 🚫 Skipping users update - data is empty/undefined');
        }

        if (data.userLogs) {
            setUserLogs(data.userLogs);
            if (!isRemote) markDirty('userLogs');
        }
        if (data.activeSessions) {
            setActiveSessions(data.activeSessions);
            if (!isRemote) markDirty('activeSessions');
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
                if (pendingScoreChanges.current.size === 0) {
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
            originalData.current = {
                ...originalData.current,
                ...(importedSettings && { settings: importedSettings }),
                ...(importedStudents && { students: importedStudents }),
                ...(importedSubjects && { subjects: importedSubjects }),
                ...(importedClasses && { classes: importedClasses }),
                ...(importedGrades && { grades: importedGrades }),
                ...(importedAssessments && { assessments: importedAssessments }),
                ...(importedScores && { scores: importedScores }),
                ...(importedReportData && { reportData: importedReportData }),
                ...(importedClassData && { classData: importedClassData }),
                ...(importedUsers && { users: importedUsers }),
                ...(data.userLogs && { userLogs: data.userLogs }),
                ...(data.activeSessions && { activeSessions: data.activeSessions }),
            };
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
            pendingScoreChanges.current.clear();
            setHasLocalChanges(false);

            // Clear draft scores to prevent stale UI state
            draftScores.current.clear();
            setDraftVersion(0);

            // Clear original data on logout
            originalData.current = {};
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
        const isEqual = deepEqual(currentValue, originalValue);

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
            markDirty(field);
        }
    }, [markDirty]);

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
        // NEW LOGIC: Only save dirty fields
        // ---------------------------------------------------------------------
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

            // NEW: Fetch latest data from cloud to ensure UI is up-to-date and to confirm sync
            // This satisfies the requirement: "after a save action, the system should download the latest data"
            // OPTIMIZED: Granular Refresh - Only fetch what we saved + critical metadata
            if (!skipRefresh) {
                console.log('[DataContext] 🔄 Auto-refreshing data from cloud (Granular)...');
                // CRITICAL: Pass true to ignore the sync lock since WE are holding the lock
                // We convert dirty fields to keysToFetch.
                const fieldsToRefresh = fieldsToSave as (keyof AppDataType)[];
                await refreshFromCloud(true, fieldsToRefresh);
            } else {
                console.log('[DataContext] ⏭️ Skipping auto-refresh as requested (Optimized for large imports)');
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
                            // filtering out deleted IDs 
                            // (Wait, transactionDeletions.scores is array of IDs to delete)
                            const deletedIds = new Set(transactionDeletions.scores);
                            // mutation is fine here since we cloned above, but filter is cleaner
                            // effectively: newOriginalScores = newOriginalScores.filter(...)
                            // But we need to assign it back
                            originalData.current.scores = newOriginalScores.filter(s => !deletedIds.has(s.id));
                        } else {
                            originalData.current.scores = newOriginalScores;
                        }
                    } else {
                        // For other fields, we sent the FULL data (Strategy 1/2/3)
                        // So we can just overwrite originalData with currentData[key]
                        // Note: transactionPayload[key] might be partial? 
                        // Actually in saveToCloud logic:
                        // "For other fields, we currently send the full list/object."
                        // So safe to take from currentData
                        originalData.current[key] = currentData[key] as any;
                    }
                }
            });

            // Update hasLocalChanges based on remaining dirty fields
            setHasLocalChanges(dirtyFields.current.size > 0);

            setIsSyncing(false);
            isSyncingRef.current = false;
        } catch (error) {
            console.error('[DataContext] ❌ Failed to save data to cloud:', error);

            // Show database error modal for critical errors
            // Show database error modal for critical errors
            showDatabaseError(error);

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

    const refreshFromCloud = async (ignoreSyncLock: boolean = false, keysToRefresh?: (keyof AppDataType)[]) => {
        if (!schoolId) return;
        if (isSyncingRef.current && !ignoreSyncLock) {
            console.log("Sync already in progress, skipping manual refresh");
            return;
        }

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
                    pendingScoreChanges.current.clear();
                }

                // 3. Mark as remote update & Apply Main Doc Data
                isRemoteUpdate.current = true;
                loadImportedData(data);

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

                // C) Scores (Granular only, usually) 
                // We don't force load ALL scores on global refresh to avoid huge reads.
                // But if specific Class/Subject is active, loadScores might be triggered by UI.

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
            } else {
                console.log('[DataContext] ⚠️ No data found for this school ID');
            }
        } catch (error) {
            console.error('[DataContext] ❌ Failed to refresh data from cloud:', error);
            showDatabaseError(error);
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

        const fetchInitialData = async () => {
            try {
                console.log('[DataContext] 📥 Fetching initial data from cloud (Auto-Sync Disabled)...');
                const data = await getSchoolData(schoolId);
                if (data) {
                    console.log('[DataContext] ✅ Initial data received via one-time fetch');
                    SyncLogger.log(`Initial data loaded. Users: ${data.users?.length || 0}, Scores: ${data.scores?.length || 0}`);

                    // Mark as remote update to allow processing
                    loadImportedData(data);

                    // -----------------------------------------------------------------
                    // CRITICAL: Eager fetch subcollections on LOGIN to satisfy user request:
                    // "loaded once when i log in... switching... should not reload"
                    // -----------------------------------------------------------------
                    console.log('[DataContext] 🚀 Eagerly loading Metadata & Students for "Load Once" optimization...');

                    // Fire and forget (or await if we want to block UI - firing parallel is faster)
                    // We don't block locally because imported data is already available for basic UI
                    loadMetadata();
                    loadStudents();
                } else {
                    console.log('[DataContext] ⚠️ No initial data found for school');
                }
            } catch (error) {
                console.error('[DataContext] ❌ Failed to fetch initial data:', error);
                // Do not show modal on initial load failure to allow offline usage if needed?
                // Or maybe just log it.
            }
        };

        fetchInitialData();
        // No cleanup needed/subscription to unsubscribe
    }, [schoolId]);

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
            setItems(prev => [...prev, { ...item, id: Date.now() } as T]);
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

    const updateStudentScores = (studentId: number, subjectId: number, assessmentId: number, newScores: string[]) => {
        const scoreId = `${studentId}-${subjectId}`;

        // FIX: Check if scores actually changed to prevent false dirty flags
        // Access 'scores' from closure which is fresh on every render
        const existingScore = scores.find(s => s.id === scoreId);
        const currentScores = existingScore?.assessmentScores?.[assessmentId] || [];

        if (deepEqual(currentScores, newScores)) {
            // console.log('[DataContext] updateStudentScores: No change detected, skipping update');
            return;
        }

        // SMART DIRTY CHECK
        // Instead of blindly marking dirty, we check if this change actually differs from the cloud state
        const originalScore = originalData.current.scores?.find(s => s.id === scoreId);
        const originalAssessmentScores = originalScore?.assessmentScores?.[assessmentId] || [];

        // Normalize: Treat [''] same as []
        const cleanScores = (s: string[]) => s.filter(val => val.trim() !== '');
        const isActuallyChanged = !deepEqual(cleanScores(newScores), cleanScores(originalAssessmentScores));

        console.log('[DataContext] 🕵️ Smart Dirty Check DEBUG:', {
            id: scoreId,
            new: cleanScores(newScores),
            orig: cleanScores(originalAssessmentScores),
            changed: isActuallyChanged,
            originalFound: !!originalScore
        });

        if (isActuallyChanged) {
            markDirty('scores', true);
            pendingScoreChanges.current.add(scoreId);
        } else {
            // Current item matches original.
            // We technically could unmark 'scores', but only if NO OTHER scores are different.
            // We will attempt to check our local Pending Set to be smart.
            // If pendingScoreChanges only contains this ScoreId (or is empty), we can unmark.
            // BUT pendingScoreChanges is just a set of "touched" items, not necessarily dirty ones.

            // To be absolutely correct without iterating effectively everything:
            // We can check if pendingScoreChanges has only 1 item (this one).
            // If so, and this one is clean -> unmark.
            // If pendingScoreChanges has multiple, we'd have to check all of them.

            // Let's iterate pendingScoreChanges. Typically user changes < 50 items in a session.
            // This is fast enough.
            pendingScoreChanges.current.delete(scoreId); // This one is clean now.

            let anyOtherDirty = false;
            for (const otherScoreId of pendingScoreChanges.current) {
                // Re-verify if other touched scores are still dirty
                const s = scores.find(x => x.id === otherScoreId);
                if (s) {
                    const orig = originalData.current.scores?.find(o => o.id === otherScoreId);
                    // Note: We need to check ALL assessments for that score, not just current assessmentId.
                    // Score object contains assessmentScores map.
                    if (!deepEqual(s.assessmentScores, orig?.assessmentScores || {})) {
                        anyOtherDirty = true;
                        break;
                    }
                }
            }

            if (!anyOtherDirty) {
                unmarkDirty('scores');
            }
        }

        console.log('[DataContext] 📥 updateStudentScores called:', {
            studentId,
            subjectId,
            assessmentId,
            scoreId,
            newScores,
            timestamp: new Date().toISOString()
        });

        setScores(prevScores => {
            const existingScoreIndex = prevScores.findIndex(s => s.id === scoreId);

            let updatedScores;
            if (existingScoreIndex > -1) {
                // Update existing score object
                console.log('[DataContext] 🔄 Updating existing score entry');
                updatedScores = prevScores.map((score, index) => {
                    if (index === existingScoreIndex) {
                        return {
                            ...score,
                            assessmentScores: {
                                ...score.assessmentScores,
                                [assessmentId]: newScores,
                            },
                        };
                    }
                    return score;
                });
            } else {
                // Add new score object
                console.log('[DataContext] ➕ Adding new score entry');
                const newScoreEntry: Score = {
                    id: scoreId,
                    studentId,
                    subjectId,
                    assessmentScores: {
                        [assessmentId]: newScores,
                    },
                };
                updatedScores = [...prevScores, newScoreEntry];
            }

            console.log('[DataContext] ✅ Score saved to local cache (React state)');
            console.log('[DataContext] 📝 Note: This will be persisted to localStorage automatically by useLocalStorage hook');

            // CRITICAL: Increment draftVersion to notify all listeners (inputs) that data has changed
            // This ensures InlineScoreInput re-reads the new "saved" value
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
            showDatabaseError(error);
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
            (['students', 'scores', 'assessments'] as const).forEach(key => {
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
                    showDatabaseError(error);

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
    };

    const resumeSync = () => {
        console.log('[DataContext] Sync RESUMED');
        isSyncPaused.current = false;

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
                        const originalItem = originalVal.find((o: any) => o.id === item.id);

                        // Special handling for SCORES to match saveToCloud logic
                        if (field === 'scores') {
                            if (!originalItem) {
                                // NEW ITEM CHECK: Prevent "Ghost" overwrites
                                // Exception: If the user explicitly modified this score (it's in pendingScoreChanges),
                                // we MUST send it, even if it appears to be a "Ghost" (e.g. they cleared a stale original).
                                const isPending = pendingScoreChanges.current.has(String(item.id));
                                if (isPending) return true;

                                // If it's a new item (or one we didn't know about), check if it's effectively empty.
                                // If it is empty, DO NOT SEND IT. This prevents overwriting valid server data with empty local placeholders.
                                // @ts-ignore
                                const hasData = item.assessmentScores && Object.values(item.assessmentScores).some(scores => Array.isArray(scores) && scores.some(s => s.trim() !== ''));
                                if (!hasData) return false;
                                return true;
                            }

                            // Normalize: Treat [''] same as []
                            // We can't easily modify the item structure here for deepEqual without cloning.
                            const cleanScores = (s: string[]) => s.filter(val => val.trim() !== '');
                            // @ts-ignore
                            const itemScores = item.assessmentScores || {};
                            // @ts-ignore
                            const origScores = originalItem.assessmentScores || {};

                            // Check deep equality on cleaned scores
                            // This is expensive but necessary for accurate preview
                            // Simplified: Just compare the assessment keys present
                            const allKeys = new Set([...Object.keys(itemScores), ...Object.keys(origScores)]);
                            for (const key of allKeys) {
                                const s1 = cleanScores(itemScores[key] || []);
                                const s2 = cleanScores(origScores[key] || []);
                                if (!deepEqual(s1, s2)) return true;
                            }
                            return false; // No changes found after normalization
                        }

                        if (!originalItem) return true; // New item
                        return !deepEqual(item, originalItem); // Modified item
                    }
                    // Fallback for non-ID arrays (if any)
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

    // Update the draft value for a score (marks it as dirty)
    const updateDraftScore = (studentId: number, assessmentId: number, value: string) => {
        const key = `${studentId}-${assessmentId}`;
        draftScores.current.set(key, value);

        // Update derived state
        setHasLocalChanges(true);
        // Notify subscribers (inputs) that drafts have changed
        setDraftVersion(prev => prev + 1);
    };

    // Remove a score from draft (marks it as clean/reverted or saved)
    const removeDraftScore = (studentId: number, assessmentId: number) => {
        const key = `${studentId}-${assessmentId}`;
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
        return count;
    }, [dirtyVersion, settings, students, subjects, classes, grades, assessments, scores, reportData, classData, users, userLogs, activeSessions]);

    // Get the score to display: prefer draft, fallback to saved
    const getComputedScore = (studentId: number, assessmentId: number, subjectId: number): string => {
        const draftKey = `${studentId}-${assessmentId}`;
        if (draftScores.current.has(draftKey)) {
            return draftScores.current.get(draftKey) || '';
        }
        // Fallback to saved data
        const savedScores = getStudentScores(studentId, subjectId, assessmentId);
        return savedScores[0] || '';
    };

    // -------------------------------------------------------------------------
    // LAZY LOADING IMPLEMENTATION
    // -------------------------------------------------------------------------

    const loadStudents = React.useCallback(async (limit?: number, force: boolean = false) => {
        if (!schoolId) return;
        // Optimization: If we already have students and aren't forcing a refresh, skip the read.
        if (!force && students.length > 0) {
            console.log(`[DataContext] 🧠 Using Cached Students (${students.length})`);
            return;
        }

        setIsFetching(true);
        try {
            console.log(`[DataContext] 📥 Lazy Loading ALL Students...`);
            const newStudents = await fetchSubcollection<Student>(schoolId, 'students');

            if (newStudents && newStudents.length > 0) {
                console.log(`[DataContext] ✅ Loaded ${newStudents.length} students.`);
                setStudents(prev => {
                    const prevMap = new Map(prev.map(s => [s.id, s]));
                    newStudents.forEach(s => prevMap.set(s.id, s));
                    return Array.from(prevMap.values());
                });
            } else {
                console.log(`[DataContext] ⚠️ No students found in subcollection.`);
            }
        } catch (e) {
            console.error("Failed to load students", e);
        } finally {
            setIsFetching(false);
        }
    }, [schoolId, students.length]);

    const loadScores = React.useCallback(async (classId: number, subjectId: number, force: boolean = false) => {
        if (!schoolId) return;
        // For scores, we might want to be more aggressive about fetching to ensure we have the latest,
        // but we can implement similar logic if we track which buckets we've loaded.
        // For now, simpler is better: we fetch when context changes (Class/Subject change).

        setIsFetching(true);
        try {
            console.log(`[DataContext] 📥 Lazy Loading Scores for Class ${classId}, Subject ${subjectId}...`);
            const newScores = await fetchScoresForClass(schoolId, classId, subjectId);

            if (newScores && newScores.length > 0) {
                console.log(`[DataContext] ✅ Loaded ${newScores.length} scores from bucket.`);
                setScores(prev => {
                    const prevMap = new Map(prev.map(s => [s.id, s]));
                    newScores.forEach(s => prevMap.set(s.id, s));
                    return Array.from(prevMap.values());
                });
            } else {
                console.log(`[DataContext] ⚠️ No scores found in bucket or legacy docs.`);
            }
        } catch (e) {
            console.error("Failed to load scores", e);
        } finally {
            setIsFetching(false);
        }
    }, [schoolId]);

    // Load Critical Metadata (Classes, Subjects, Assessments)
    const loadMetadata = React.useCallback(async (force: boolean = false) => {
        if (!schoolId) return;

        // Caching Check
        if (!force && classes.length > 0 && subjects.length > 0 && assessments.length > 0) {
            console.log(`[DataContext] 🧠 Using Cached Metadata`);
            return;
        }

        setIsFetching(true);
        try {
            console.log(`[DataContext] 📥 Loading Metadata (Classes, Subjects, Assessments)...`);
            const [fetchedClasses, fetchedSubjects, fetchedAssessments] = await Promise.all([
                fetchSubcollection<Class>(schoolId, 'classes'),
                fetchSubcollection<Subject>(schoolId, 'subjects'),
                fetchSubcollection<Assessment>(schoolId, 'assessments')
            ]);

            if (fetchedClasses.length > 0) setClasses(fetchedClasses);
            if (fetchedSubjects.length > 0) setSubjects(fetchedSubjects);
            if (fetchedAssessments.length > 0) setAssessments(fetchedAssessments);

            console.log(`[DataContext] ✅ Metadata Loaded: ${fetchedClasses.length} Classes, ${fetchedSubjects.length} Subjects, ${fetchedAssessments.length} Assessments`);
        } catch (e) {
            console.error("Failed to load metadata", e);
        } finally {
            setIsFetching(false);
        }
    }, [schoolId, classes.length, subjects.length, assessments.length]);

    // Load Critical Metadata (Classes, Subjects, Assessments)
    // Should be called on Dashboard or App Init

    const value: DataContextType = {
        settings, setSettings, updateSettings,
        students,
        subjects,
        classes,
        grades,
        assessments,
        scores,
        reportData,
        classData,
        setAssessments,
        addStudent: studentCrud.add,
        updateStudent: studentCrud.update,
        deleteStudent: studentCrud.delete,
        addSubject: subjectCrud.add,
        updateSubject: subjectCrud.update,
        deleteSubject: subjectCrud.delete,
        addClass: classCrud.add,
        updateClass: classCrud.update,
        deleteClass: classCrud.delete,
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
    };

    // Initialize originalData from local storage on load/schoolId change
    // This ensures that on F5 reload, we have a baseline for "clean" state
    // Clear drafts ONLY when school changes
    useEffect(() => {
        draftScores.current.clear();
        setDraftVersion(0);
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
