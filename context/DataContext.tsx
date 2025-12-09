import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { saveUserDatabase, subscribeToSchoolData, AppDataType, updateHeartbeat, logUserActivity } from '../services/firebaseService';
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
    schoolId: string | null;
    setSchoolId: (id: string | null) => void;
    // Network status
    isOnline: boolean;
    isSyncing: boolean;
    queuedCount: number;

    // New Actions
    logUserAction: (userId: number, userName: string, role: string, action: 'Login' | 'Logout') => Promise<void>;
    sendHeartbeat: (userId: number) => Promise<void>;
    logPageVisit: (userId: number, userName: string, role: string, currentPage: string, previousPage: string | null) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useLocalStorage<SchoolSettings>('sba-settings', INITIAL_SETTINGS);
    const [students, setStudents] = useLocalStorage<Student[]>('sba-students', INITIAL_STUDENTS);
    const [subjects, setSubjects] = useLocalStorage<Subject[]>('sba-subjects', INITIAL_SUBJECTS);
    const [classes, setClasses] = useLocalStorage<Class[]>('sba-classes', INITIAL_CLASSES);
    const [grades, setGrades] = useLocalStorage<Grade[]>('sba-grades', INITIAL_GRADES);
    const [assessments, setAssessments] = useLocalStorage<Assessment[]>('sba-assessments', INITIAL_ASSESSMENTS);
    const [scores, setScores] = useLocalStorage<Score[]>('sba-scores', INITIAL_SCORES);
    const [reportData, setReportData] = useLocalStorage<ReportSpecificData[]>('sba-report-data', INITIAL_REPORT_DATA);
    const [classData, setClassData] = useLocalStorage<ClassSpecificData[]>('sba-class-data', INITIAL_CLASS_DATA);
    const [schoolId, setSchoolId] = useLocalStorage<string | null>('sba-school-id', null); // FIX: Persist schoolId
    const isRemoteUpdate = React.useRef(false);
    const lastLocalUpdate = React.useRef(Date.now());



    // Network and sync state
    const isOnline = useNetworkStatus();
    const [isSyncing, setIsSyncing] = useState(false);
    const [queuedCount, setQueuedCount] = useState(offlineQueue.getQueueSize());

    // Sync lock to prevent concurrent syncs
    const isSyncingRef = React.useRef(false);

    // FIX: Add users to DataContextstate so it's included in sync/saves
    const [users, setUsers] = useState<User[]>([]);
    const [userLogs, setUserLogs] = useState<UserLog[]>([]);
    const [activeSessions, setActiveSessions] = useState<Record<string, string>>({});

    // FIX: Implement function to overwrite all data from an imported file.
    const loadImportedData = (data: Partial<AppDataType>) => {
        // This function overwrites existing data with data from an imported file.
        // If a key is missing in the imported data, it resets to the initial default state
        // to ensure a clean slate, matching user expectations of a full data replacement.
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

        setSettings(importedSettings || INITIAL_SETTINGS);
        setStudents(importedStudents || INITIAL_STUDENTS);
        setSubjects(importedSubjects || INITIAL_SUBJECTS);
        setClasses(importedClasses || INITIAL_CLASSES);
        setGrades(importedGrades || INITIAL_GRADES);
        setAssessments(importedAssessments || INITIAL_ASSESSMENTS);
        setScores(importedScores || INITIAL_SCORES);
        setReportData(importedReportData || INITIAL_REPORT_DATA);
        setClassData(importedClassData || INITIAL_CLASS_DATA);
        // Sync users if present
        if (importedUsers) {
            setUsers(importedUsers);
        }
        if (data.userLogs) setUserLogs(data.userLogs);
        if (data.activeSessions) setActiveSessions(data.activeSessions);
    };

    const saveToCloud = async () => {
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

        // Capture CURRENT state at sync time (not stale state from when timeout started)
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
            users, // Include users in the save
            userLogs,
            activeSessions
        };

        // Check network status
        if (!isOnline) {
            console.log("Offline - adding to queue");
            offlineQueue.addToQueue(currentData);
            setQueuedCount(offlineQueue.getQueueSize());
            return;
        }

        try {
            isSyncingRef.current = true;
            setIsSyncing(true);
            await saveUserDatabase(schoolId, currentData);
            console.log("Data saved to cloud successfully.");
            setIsSyncing(false);
            isSyncingRef.current = false;
        } catch (error) {
            console.error("Failed to save data to cloud:", error);
            // Add to queue on failure
            offlineQueue.addToQueue(currentData);
            setQueuedCount(offlineQueue.getQueueSize());
            setIsSyncing(false);
            isSyncingRef.current = false;
        }
    };

    // Real-time sync listener
    useEffect(() => {
        if (!schoolId) return;

        const unsubscribe = subscribeToSchoolData(schoolId, (data) => {
            // Intelligent Sync:
            // If the user has interacted locally within the last 10 seconds,
            // we ignore the remote update to prevent overwriting their active work.
            // This also effectively ignores the "echo" from our own saves.
            const timeSinceLastLocalUpdate = Date.now() - lastLocalUpdate.current;
            if (timeSinceLastLocalUpdate < 10000) {
                console.log(`Skipping remote update due to local activity (${timeSinceLastLocalUpdate}ms ago).`);
                return;
            }

            console.log("Received remote update");
            isRemoteUpdate.current = true;
            loadImportedData(data);
        });

        return () => unsubscribe();
    }, [schoolId]);

    // Background sync effect (Debounced Auto-Save)
    useEffect(() => {
        if (!schoolId) return;

        // If this change came from a remote update, skip saving
        if (isRemoteUpdate.current) {
            console.log("Skipping save due to remote update");
            isRemoteUpdate.current = false;
            return;
        }

        // It's a local update, mark the timestamp
        lastLocalUpdate.current = Date.now();

        const handler = setTimeout(() => {
            // saveToCloud will capture CURRENT state when it runs
            saveToCloud();
        }, 5000); // Auto-save 5 seconds after the last change (increased from 2s to reduce mid-entry syncs)

        return () => clearTimeout(handler);
    }, [schoolId, settings, students, subjects, classes, grades, assessments, scores, reportData, classData]);

    const createCrud = <T extends { id: number }>(
        items: T[],
        setItems: React.Dispatch<React.SetStateAction<T[]>>
    ) => ({
        add: (item: Omit<T, 'id'>) => {
            setItems(prev => [...prev, { ...item, id: Date.now() } as T]);
        },
        update: (updatedItem: T) => {
            setItems(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
        },
        delete: (id: number) => {
            setItems(prev => prev.filter(item => item.id !== id));
        },
    });

    const studentCrud = createCrud(students, setStudents);
    const subjectCrud = createCrud(subjects, setSubjects);
    const classCrud = createCrud(classes, setClasses);
    const gradeCrud = createCrud(grades, setGrades);

    // Custom Assessment CRUD to handle exam ordering
    const addAssessment = (assessment: Omit<Assessment, 'id'>) => {
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
        setAssessments(prev => prev.map(item => item.id === updatedAssessment.id ? updatedAssessment : item));
    };
    const deleteAssessment = (id: number) => {
        setAssessments(prev => prev.filter(item => item.id !== id));
    };

    const updateStudentScores = (studentId: number, subjectId: number, assessmentId: number, newScores: string[]) => {
        const scoreId = `${studentId}-${subjectId}`;
        setScores(prevScores => {
            const existingScoreIndex = prevScores.findIndex(s => s.id === scoreId);
            if (existingScoreIndex > -1) {
                // Update existing score object
                return prevScores.map((score, index) => {
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
                const newScoreEntry: Score = {
                    id: scoreId,
                    studentId,
                    subjectId,
                    assessmentScores: {
                        [assessmentId]: newScores,
                    },
                };
                return [...prevScores, newScoreEntry];
            }
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
                        lastActive: timestamp
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
            // Use imported service (we need to import it properly at top)
            // We can use a dynamic import or assuming it's available.
            // Ideally we move updateHeartbeat to services/firebaseService if it's there.
            // It is there.
            await updateHeartbeat(schoolId, userId);
        }
    };

    const logUserAction = async (userId: number, userName: string, role: string, action: 'Login' | 'Logout') => {
        if (!schoolId) return;

        const log: UserLog = {
            id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            userId,
            userName,
            role: role as any,
            action,
            timestamp: new Date().toISOString(),
        };

        await logUserActivity(schoolId, log);
    };

    const logPageVisit = async (
        userId: number,
        userName: string,
        role: string,
        currentPage: string,
        previousPage: string | null
    ) => {
        if (!schoolId) return;

        const log: UserLog = {
            id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            userId,
            userName,
            role: role as any,
            action: 'Page Visit',
            timestamp: new Date().toISOString(),
            pageName: currentPage,
            previousPage: previousPage || undefined,
        };

        await logUserActivity(schoolId, log);
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
        schoolId,
        setSchoolId,
        // Network status
        isOnline,
        isSyncing,
        queuedCount,
        userLogs,
        activeSessions,
        // New exports
        onlineUsers,
        logUserAction,
        sendHeartbeat,
        logPageVisit,
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
