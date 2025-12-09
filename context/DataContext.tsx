import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { saveUserDatabase, subscribeToSchoolData, AppDataType, updateHeartbeat, logUserActivity, getSchoolData } from '../services/firebaseService';
import * as SyncLogger from '../services/syncLogger';
import useLocalStorage from '../hooks/useLocalStorage';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { offlineQueue } from '../services/offlineQueue';
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
    loadImportedData: (data: Partial<AppDataType>) => void;
    saveToCloud: () => Promise<void>;
    refreshFromCloud: () => Promise<void>;
    schoolId: string | null;
    setSchoolId: (id: string | null) => void;
    // Network status
    isOnline: boolean;
    isSyncing: boolean;
    queuedCount: number;
    // Sync control
    pauseSync: () => void;
    resumeSync: () => void;
    blockRemoteUpdates: () => void;
    allowRemoteUpdates: () => void;

    // New Actions
    logUserAction: (userId: number, userName: string, role: string, action: 'Login' | 'Logout') => Promise<void>;
    sendHeartbeat: (userId: number) => Promise<void>;

    // UI Feedback
    hasLocalChanges: boolean;
    setHasLocalChanges: (hasChanges: boolean) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);


export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // CRITICAL: Get schoolId first (non-namespaced)
    const [schoolId, setSchoolId] = useLocalStorage<string | null>('sba-school-id', null);

    // Helper to create school-specific localStorage keys
    const getKey = (base: string) => schoolId ? `sba-${schoolId}-${base}` : `sba-${base}`;

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
    const [queuedCount, setQueuedCount] = useState(offlineQueue.getQueueSize());

    // Sync lock to prevent concurrent syncs
    const isSyncingRef = React.useRef(false);

    // Sync pause control - used during authentication to stop all auto-save
    const isSyncPaused = React.useRef(false);
    const pendingSaveTimeout = React.useRef<number | null>(null);

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

    // FIX: Use a Ref to hold the latest state for saveToCloud to access during retries
    // This prevents the "stale closure" bug where a postponed save uses old data
    const stateRef = React.useRef<AppDataType>({
        settings, students: [], subjects: [], classes: [], grades: [], assessments: [], scores: [], reportData: [], classData: [], users: [], userLogs: [], activeSessions: {}
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

    // FIX: Implement function to overwrite all data from an imported file.
    const loadImportedData = (data: Partial<AppDataType>) => {
        // CRITICAL: Mark this as a remote update to prevent syncing back to cloud
        // This prevents localStorage from overwriting imported/cloud data
        isRemoteUpdate.current = true;
        // Automatically reset after 500ms to allow all effects to settle
        setTimeout(() => {
            isRemoteUpdate.current = false;
        }, 500);

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

        console.log('[DataContext] 📦 loadImportedData called with:', {
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

        // ✅ ONLY update if imported data is ACTUALLY provided and not empty
        if (importedSettings) {
            console.log('[DataContext] ✅ Updating settings from cloud');
            setSettings(importedSettings);
        }
        if (importedStudents && importedStudents.length > 0) {
            console.log('[DataContext] ✅ Updating students from cloud:', importedStudents.length);
            setStudents(importedStudents);
        }
        if (importedSubjects && importedSubjects.length > 0) {
            console.log('[DataContext] ✅ Updating subjects from cloud:', importedSubjects.length);
            setSubjects(importedSubjects);
        }
        if (importedClasses && importedClasses.length > 0) {
            console.log('[DataContext] ✅ Updating classes from cloud:', importedClasses.length);
            setClasses(importedClasses);
        }
        if (importedGrades && importedGrades.length > 0) {
            console.log('[DataContext] ✅ Updating grades from cloud:', importedGrades.length);
            setGrades(importedGrades);
        }
        if (importedAssessments && importedAssessments.length > 0) {
            console.log('[DataContext] ✅ Updating assessments from cloud:', importedAssessments.length);
            setAssessments(importedAssessments);
        }
        if (importedScores && importedScores.length > 0) {
            console.log('[DataContext] ✅ Updating scores from cloud:', importedScores.length);
            setScores(importedScores);
        } else {
            console.log('[DataContext] 🚫 Skipping scores update - cloud data is empty/undefined');
        }
        if (importedReportData && importedReportData.length > 0) {
            console.log('[DataContext] ✅ Updating reportData from cloud:', importedReportData.length);
            setReportData(importedReportData);
        }
        if (importedClassData && importedClassData.length > 0) {
            console.log('[DataContext] ✅ Updating classData from cloud:', importedClassData.length);
            setClassData(importedClassData);
        }

        // Sync users if present
        SyncLogger.log(`loadImportedData: Loading users. Count: ${importedUsers?.length || 0}`);
        if (importedUsers && importedUsers.length > 0) {
            console.log('[DataContext] ✅ Updating users from cloud:', importedUsers.length);
            setUsers(importedUsers);
        } else {
            console.log('[DataContext] 🚫 Skipping users update - cloud data is empty/undefined');
        }

        if (data.userLogs) setUserLogs(data.userLogs);
        if (data.activeSessions) setActiveSessions(data.activeSessions);
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

    const markDirty = (field: keyof AppDataType) => {
        // Only mark dirty if it's NOT a remote update
        if (!isRemoteUpdate.current) {
            dirtyFields.current.add(field);
            setHasLocalChanges(true); // Enable Upload button globally
            // console.log(`[DataContext] 📝 Marked dirty: ${field}`);
        }
    };

    const saveToCloud = async () => {
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

        // CRITICAL: Don't sync if user was active very recently (within last 500ms)
        // This prevents syncing mid-keystroke or mid-interaction
        const timeSinceLastUpdate = Date.now() - lastLocalUpdate.current;
        if (timeSinceLastUpdate < 500) {
            console.log(`User actively working (${timeSinceLastUpdate}ms ago), postponing sync`);
            // Reschedule the sync for later
            setTimeout(() => saveToCloud(), 1000);
            return;
        }

        // ---------------------------------------------------------------------
        // NEW LOGIC: Only save dirty fields
        // ---------------------------------------------------------------------
        if (dirtyFields.current.size === 0) {
            console.log('[DataContext] 💤 No dirty fields to sync. Skipping save.');
            return;
        }

        const fieldsToSave = Array.from(dirtyFields.current);
        console.log(`[DataContext] ☁️ Syncing dirty fields: ${fieldsToSave.join(', ')}`);

        // Capture CURRENT state at sync time (not stale state from when timeout started)
        SyncLogger.log(`saveToCloud: Preparing to save. Users count: ${users.length}`);

        // CRITICAL: Log warning if saving empty users array
        // The sync pause mechanism should prevent this, but we log for visibility
        if (fieldsToSave.includes('users') && users.length === 0 && schoolId) {
            SyncLogger.log(`WARNING: Attempting to save with empty users array. This may indicate an issue.`);
            console.warn('[DataContext] Saving with empty users array - this should only happen for new school accounts');
        }

        // Use stateRef to get the ABSOLUTE LATEST data at the moment of execution
        const currentData = stateRef.current;

        // Construct the payload with ONLY the dirty fields
        const payload: Partial<AppDataType> = {};

        // Always ensure we have valid objects for the dirty keys
        fieldsToSave.forEach(field => {
            // @ts-ignore - Dynamic access is safe here because we iterate known keys
            payload[field] = currentData[field];
        });

        // Check network status
        if (!isOnline) {
            console.log("Offline - adding to queue");
            offlineQueue.addToQueue(payload); // Queue the partial payload
            setQueuedCount(offlineQueue.getQueueSize());
            return;
        }

        try {
            isSyncingRef.current = true;
            setIsSyncing(true);
            console.log('[DataContext] ☁️ Uploading partial data to cloud database...');
            await saveUserDatabase(schoolId, payload);
            console.log('[DataContext] ✅ Data saved to cloud successfully!');
            console.log('[DataContext] 🎉 Sync complete - cleared dirty fields');

            // Clear dirty fields only after successful save
            dirtyFields.current.clear();
            setHasLocalChanges(false); // Disable Upload button

            setIsSyncing(false);
            isSyncingRef.current = false;
        } catch (error) {
            console.error('[DataContext] ❌ Failed to save data to cloud:', error);
            console.log('[DataContext] 📦 Adding to offline queue for retry when online');
            // Add to queue on failure
            offlineQueue.addToQueue(payload);
            setQueuedCount(offlineQueue.getQueueSize());
            setIsSyncing(false);
            isSyncingRef.current = false;
        }
    };

    const refreshFromCloud = async () => {
        if (!schoolId) return;
        if (isSyncingRef.current) {
            console.log("Sync already in progress, skipping manual refresh");
            return;
        }

        try {
            isSyncingRef.current = true;
            setIsSyncing(true);
            console.log('[DataContext] 📥 Manual refresh initiated - fetching data from cloud...');

            const data = await getSchoolData(schoolId);
            if (data) {
                console.log('[DataContext] ✅ Data fetched successfully, applying updates...');
                // Mark as manual remote update
                isRemoteUpdate.current = true;
                loadImportedData(data);
                console.log('[DataContext] 🎉 Manual refresh complete');
                // Creating a manual refresh clears dirty flags to avoid conflicts? 
                // Actually, if we just fetched from cloud, our local state is now same as cloud.
                dirtyFields.current.clear();
            } else {
                console.log('[DataContext] ⚠️ No data found for this school ID');
            }
        } catch (error) {
            console.error('[DataContext] ❌ Failed to refresh data from cloud:', error);
        } finally {
            setIsSyncing(false);
            isSyncingRef.current = false;
        }
    };

    // Real-time sync listener
    useEffect(() => {
        if (!schoolId) return;

        const unsubscribe = subscribeToSchoolData(schoolId, (data) => {
            console.log('[DataContext] 🔔 Remote update received from cloud:', {
                hasScores: !!data.scores,
                scoresCount: data.scores?.length || 0,
                hasUsers: !!data.users,
                usersCount: data.users?.length || 0,
                hasStudents: !!data.students,
                studentsCount: data.students?.length || 0,
                timestamp: new Date().toISOString()
            });

            // CRITICAL: Block remote updates if a form is actively open
            if (isFormOpen.current) {
                console.log('[DataContext] 🚫 Blocking remote update - form is actively open');
                return;
            }

            // Intelligent Sync:
            // If the user has interacted locally within the last 60 seconds,
            // we ignore the remote update to prevent overwriting their active work.
            // This also effectively ignores the "echo" from our own saves.
            // Extended to 60s because rapid remote updates after 10s were clearing buffered inputs.
            const timeSinceLastLocalUpdate = Date.now() - lastLocalUpdate.current;
            if (timeSinceLastLocalUpdate < 60000) {
                console.log(`[DataContext] 🚫 Skipping remote update - local activity ${timeSinceLastLocalUpdate}ms ago (echo filter)`);
                return;
            }

            // CRITICAL: Reject stale remote data
            // Only accept remote updates that have MORE scores than we have locally.
            // This prevents old Firebase snapshots from wiping out fresh local entries.
            const remoteScoresCount = data.scores?.length || 0;
            const localScoresCount = scores.length;

            if (remoteScoresCount < localScoresCount) {
                console.log(`[DataContext] 🚫 Rejecting stale remote data - remote has ${remoteScoresCount} scores, local has ${localScoresCount} scores`);
                return;
            }

            // If counts are equal, check if remote data is actually different
            if (remoteScoresCount === localScoresCount) {
                console.log(`[DataContext] ℹ️ Remote and local have same score count (${remoteScoresCount}). Allowing update if content differs (handled by loadImportedData).`);
                // We DO NOT return here anymore. 
                // The echo filter (timeSinceLastLocalUpdate < 60000) above handles the "my own save" case.
                // If we passed the echo filter, this matching-count update is likely an EDIT from another device.
            }

            console.log('[DataContext] ✅ Processing remote update - applying cloud data');
            SyncLogger.log(`Received remote update from cloud. Users count in update: ${data.users?.length || 0}`);
            isRemoteUpdate.current = true;
            loadImportedData(data);
        });

        return () => unsubscribe();
    }, [schoolId]);

    // Track initial mount to prevent auto-save before data is loaded from cloud
    const isInitialMount = React.useRef(true);

    // Background sync effect (Debounced Auto-Save)
    useEffect(() => {
        if (!schoolId) return;

        // CRITICAL: Skip auto-save on initial mount to prevent syncing empty arrays before data loads from cloud
        if (isInitialMount.current) {
            console.log("Skipping auto-save on initial mount - waiting for data to load from cloud");
            isInitialMount.current = false;
            return;
        }

        // CRITICAL: If this change came from a remote update, skip the entire effect
        if (isRemoteUpdate.current) {
            console.log("Skipping save due to remote update");
            // Do NOT reset isRemoteUpdate.current here - let the timeout handle it
            // distinct from the batching issue.
            return;
        }

        // It's a local update, mark the timestamp
        lastLocalUpdate.current = Date.now();

        // Clear any existing timeout first
        if (pendingSaveTimeout.current) {
            clearTimeout(pendingSaveTimeout.current);
            pendingSaveTimeout.current = null;
        }

        // Skip if sync is paused
        if (isSyncPaused.current) {
            console.log("Skipping auto-save schedule - sync is paused");
            return;
        }

        pendingSaveTimeout.current = setTimeout(() => {
            pendingSaveTimeout.current = null;
            console.log('[DataContext] ⏰ Auto-sync timer triggered (5 seconds since last change)');
            console.log('[DataContext] 🔄 Initiating cloud sync...');
            // saveToCloud will capture CURRENT state when it runs
            saveToCloud();
        }, 5000); // Auto-save 5 seconds after the last change (increased from 2s to reduce mid-entry syncs)

        console.log('[DataContext] ⏱️ Auto-sync scheduled: Will sync to cloud in 5 seconds if no further changes');

        return () => {
            if (pendingSaveTimeout.current) {
                clearTimeout(pendingSaveTimeout.current);
                pendingSaveTimeout.current = null;
            }
        };
    }, [schoolId, settings, students, subjects, classes, grades, assessments, scores, reportData, classData]);

    // Helper to wrap state setters with dirty marking
    const createCrud = <T extends { id: number }>(
        items: T[],
        setItems: React.Dispatch<React.SetStateAction<T[]>>,
        fieldKey: keyof AppDataType
    ) => ({
        add: (item: Omit<T, 'id'>) => {
            markDirty(fieldKey);
            setItems(prev => [...prev, { ...item, id: Date.now() } as T]);
        },
        update: (updatedItem: T) => {
            markDirty(fieldKey);
            setItems(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
        },
        delete: (id: number) => {
            markDirty(fieldKey);
            setItems(prev => prev.filter(item => item.id !== id));
        },
    });

    const studentCrud = createCrud(students, setStudents, 'students');
    const subjectCrud = createCrud(subjects, setSubjects, 'subjects');
    const classCrud = createCrud(classes, setClasses, 'classes');
    const gradeCrud = createCrud(grades, setGrades, 'grades');

    // Custom Assessment CRUD to handle exam ordering
    const addAssessment = (assessment: Omit<Assessment, 'id'>) => {
        markDirty('assessments');
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
        markDirty('assessments');
        setAssessments(prev => prev.map(item => item.id === updatedAssessment.id ? updatedAssessment : item));
    };
    const deleteAssessment = (id: number) => {
        markDirty('assessments');
        setAssessments(prev => prev.filter(item => item.id !== id));
    };

    const updateStudentScores = (studentId: number, subjectId: number, assessmentId: number, newScores: string[]) => {
        markDirty('scores');
        const scoreId = `${studentId}-${subjectId}`;

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
        markDirty('reportData');
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
        markDirty('classData');
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
        markDirty('settings');
        setSettings(prev => ({ ...prev, ...updates }));
    };


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
                classData
            };

            // NOTE: Offline recovery should probably sync EVERYTHING just in case,
            // or we could inspect the queue. For simplicity, we sync full state on recovery for now.
            // Or we could trust the queue. The queue contains partials now.
            // But 'currentData' here is the FULL state.
            // Let's stick to full sync on recovery for safety.

            saveUserDatabase(schoolId, currentData)
                .then(() => {
                    // Success - clear the entire queue since we just synced current state
                    offlineQueue.clearQueue();
                    setQueuedCount(0);
                    setIsSyncing(false);
                    console.log('Current state synced successfully, queue cleared');
                })
                .catch(error => {
                    console.error('Error syncing current state:', error);
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

    const sendHeartbeat = async (userId: number) => {
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
    };

    const logUserAction = async (userId: number, userName: string, role: string, action: 'Login' | 'Logout') => {
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
    };

    // Removed logPageVisit to prevent excessive logging

    // Sync control functions
    const pauseSync = () => {
        console.log('[DataContext] Sync PAUSED - clearing all pending saves');
        isSyncPaused.current = true;

        // Clear any pending save timeout
        if (pendingSaveTimeout.current) {
            clearTimeout(pendingSaveTimeout.current);
            pendingSaveTimeout.current = null;
        }

        // Also clear the sync lock to allow fresh start
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
        refreshFromCloud,
        schoolId,
        setSchoolId,
        // Network status
        isOnline,
        isSyncing,
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
    };

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider. If you see this error during development, try refreshing the page to resolve hot module reload issues.');
    }
    return context;
};
