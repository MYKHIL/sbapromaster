import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { useUser } from '../../context/UserContext';
import { updateUsers, createDocumentId, initializeNewTermDatabase, getSchoolData, getSchoolList, getSchoolYearsAndTerms, fetchSubcollection, saveDataTransaction, type AppDataType } from '../../services/firebaseService';
import { exportDatabase, importDatabase } from '../../services/databaseService';
import { generateWpfProject } from '../../services/wpfProjectGenerator';
import ConfirmationModal from '../ConfirmationModal';
import AdminSetup from '../AdminSetup';
import { DEV_TOOLS_ENABLED, WHATSAPP_DEVELOPER_NUMBER, SHOW_USER_EXPORT_BUTTON } from '../../constants';
import type { User, SchoolPeriod } from '../../types';
import { generateIndexNumber, validateIndexNumberPattern } from '../../utils/indexNumberGenerator';
import IndexNumberConfig from '../IndexNumberConfig';


interface FeedbackState {
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    details?: string[];
    detailsTitle?: string;
}

interface CreateTermModalProps {
    isOpen: boolean;
    onClose: () => void;
    setFeedback: (feedback: FeedbackState | null) => void;
}

const CreateTermModal: React.FC<CreateTermModalProps> = ({ isOpen, onClose, setFeedback }) => {
    const dataContext = useData();
    const { settings, schoolId } = dataContext;
    // const { users } = useUser(); // Users accessed directly from dataContext now

    const [newYear, setNewYear] = useState('');
    const [newTerm, setNewTerm] = useState('');
    const [password, setPassword] = useState('');
    const [maintainPassword, setMaintainPassword] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [isFetchingPwd, setIsFetchingPwd] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [lockCurrentUsers, setLockCurrentUsers] = useState(false);
    const [createdTermId, setCreatedTermId] = useState<string | null>(null);
    const [vacationDate, setVacationDate] = useState('');
    const [reopeningDate, setReopeningDate] = useState('');

    useEffect(() => {
        if (isOpen) {

            let term = '';
            const current = (settings.academicTerm || '').toLowerCase().trim();

            if (current === 'first term') term = 'Second Term';
            else if (current === 'second term') term = 'Third Term';
            else if (current === 'third term') term = 'First Term';
            else term = 'First Term';
            setNewTerm(term);

            if (settings.isPromotionTerm) {
                const nextYear = settings.academicYear.replace(/\d+/g, (m) => (parseInt(m) + 1).toString().padStart(m.length, '0'));
                setNewYear(nextYear);
            } else {
                setNewYear(settings.academicYear);
            }

            setPassword('');
            setMaintainPassword(true);
            setLockCurrentUsers(false);
            setShowPassword(false);
            setCreatedTermId(null);
            setVacationDate('');
            setReopeningDate('');
        }
    }, [isOpen, settings]);

    useEffect(() => {
        const fetchPwd = async () => {
            if (maintainPassword && schoolId) {
                setIsFetchingPwd(true);
                try {
                    const data = await getSchoolData(schoolId);
                    if (data?.password) setPassword(data.password);
                } catch (e) {
                    setFeedback({ message: 'Could not fetch current password.', type: 'error' });
                    setMaintainPassword(false);
                } finally {
                    setIsFetchingPwd(false);
                }
            }
        };
        if (maintainPassword && !password) fetchPwd();
    }, [maintainPassword, schoolId, password, setFeedback]);

    if (!isOpen) return null;

    const handleCreate = async () => {
        if (!newYear || !newTerm || !password) {
            setFeedback({ message: 'Please fill in all fields.', type: 'error' });
            return;
        }

        setIsCreating(true);
        try {
            // 1. Prepare Data for New Term
            const newStudents = dataContext.students.map(s => {
                // Promotion Logic
                if (settings.isPromotionTerm) {
                    const report = dataContext.reportData.find(r => r.studentId === s.id);
                    if (report?.promotedTo) {
                        return { ...s, class: report.promotedTo }; // Update class to promoted class
                    }
                }
                // If not promoted, stay in current class (repeat)
                return s;
            });

            const newSettings = {
                ...settings,
                academicYear: newYear,
                academicTerm: newTerm,
                isPromotionTerm: false, // Reset promotion settings for the new term
                vacationDate: vacationDate || settings.vacationDate,
                reopeningDate: reopeningDate || settings.reopeningDate
            };

            // Create the sanitized ID for the new document
            // Use the existing school ID prefix (e.g. 'ayirebida') to maintain login consistency
            const schoolPrefix = schoolId ? schoolId.split('_')[0] : settings.schoolName;
            const newDocId = createDocumentId(schoolPrefix, newSettings.academicYear, newSettings.academicTerm);

            // 1.5. Lock Current Users (Optional)
            if (lockCurrentUsers && schoolId) {
                // Create a list of users with isReadOnly=true
                const lockedUsers = dataContext.users.map(u => ({ ...u, isReadOnly: true }));
                // Update CURRENT db locally and cloud
                // We should probably await this to ensure it's saved before we move on,
                // BUT if we fail to create the new term, we might have locked users prematurely?
                // Risk is low. Reverting is manual (admin unchecks box).
                await saveDataTransaction(schoolId, { users: lockedUsers });
                0 && console.log('Main term users locked.');
            }

            // 1.6 Ensure New Term Users are Unlocked
            const unlockedUsers = dataContext.users.map(u => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { isReadOnly, ...rest } = u; // Remove isReadOnly property
                return { ...rest, isReadOnly: false }; // Explicitly set to false to be safe
            });

            // Full data payload
            const newData: AppDataType = {
                settings: newSettings,
                students: newStudents,
                subjects: dataContext.subjects,
                classes: dataContext.classes,
                grades: dataContext.grades,
                assessments: dataContext.assessments,
                scores: [], // Clear scores
                reportData: [], // Clear comments/remarks
                classData: [], // Clear class stats
                users: unlockedUsers, // Copy existing users access (Unlocked)
                password: password,
                Access: true, // Enable access immediately
                activeSessions: {}, // Reset sessions
                userLogs: [] // Reset logs
            };

            // 2. Save to Firebase
            // SAFETY: We use initializeNewTermDatabase here because we are explicitly creating a NEW term
            // with a fresh document ID. This is the only valid use case for overwriting the DB.
            await initializeNewTermDatabase(newDocId, newData);

            // STOP HERE: Do not switch yet. Show confirmation.
            setCreatedTermId(newDocId);
            setFeedback({ message: `New term for ${newSettings.academicYear} - ${newSettings.academicTerm} created successfully!`, type: 'success' });

        } catch (error: any) {
            console.error("Failed to create term:", error);
            setFeedback({ message: 'Failed to create term: ' + error.message, type: 'error' });
        } finally {
            setIsCreating(false);
        }
    };

    const handleSwitchToNewTerm = async () => {
        if (!createdTermId) return;

        try {
            setFeedback({ message: `Switching to ${newYear} - ${newTerm}...`, type: 'info' });

            // 1. Update Persistent Storage (Critical for preventing fallback on refresh)
            localStorage.setItem('sba_school_id', createdTermId);
            // We use the password state variable which holds the password used to create the term
            if (password) {
                localStorage.setItem('sba_school_password', password);
            }

            // 2. Switch Context State
            // This will trigger reactivity in the app (clearing caches, etc.)
            dataContext.setSchoolId(createdTermId);

            // 3. Force Data Load for the new term
            // We need to ensure the app loads the new data immediately
            await dataContext.refreshFromCloud();

            // 4. Update Device Credential (for auto-login helper)
            const currentUserId = Number(localStorage.getItem('sba_user_id'));
            if (currentUserId) {
                const { saveDeviceCredential } = await import('../../services/authService');
                saveDeviceCredential(createdTermId, currentUserId);
            }

            setFeedback({ message: `Successfully switched to ${newYear} - ${newTerm}`, type: 'success' });

            // Close the modal
            onClose();

        } catch (e) {
            console.error("Switch failed", e);
            setFeedback({ message: "Failed to switch automatically.", type: 'error' });
        }
    };

    const handleClose = () => {
        onClose();
    };

    // RENDER: Confirmation State
    if (createdTermId) {
        return (
            <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 animate-fade-in-scale">
                <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md m-4 text-center">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                        <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Term Created Successfully!</h3>
                    <p className="text-gray-600 mb-6">
                        The new term <strong>{newYear} - {newTerm}</strong> is ready.<br />
                        Would you like to switch to it now?
                    </p>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={handleSwitchToNewTerm}
                            className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 font-medium"
                        >
                            Yes, Switch to New Term
                        </button>
                        <button
                            onClick={handleClose}
                            className="w-full bg-gray-100 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-200"
                        >
                            No, Stay Here
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 animate-fade-in-scale">
            <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md m-4">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Create New Term</h3>
                <p className="text-sm text-gray-600 mb-4">
                    This will create a new database for the next term. Students, Classes, and Subjects will be copied.
                    <strong>Scores and Remarks will be cleared.</strong> If promotion is enabled, students will be moved to their new classes.
                </p>

                <div className="space-y-4">
                    <div>
                        <label htmlFor="newAcademicYear" className="block text-sm font-medium text-gray-700">New Academic Year</label>
                        <input
                            id="newAcademicYear"
                            type="text"
                            value={newYear}
                            onChange={e => setNewYear(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g. 2024 - 2025"
                        />
                    </div>
                    <div>
                        <label htmlFor="newTerm" className="block text-sm font-medium text-gray-700">New Term</label>
                        <select
                            id="newTerm"
                            value={newTerm}
                            onChange={e => setNewTerm(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">Select Term...</option>
                            <option value="First Term">First Term</option>
                            <option value="Second Term">Second Term</option>
                            <option value="Third Term">Third Term</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">Set Password for New Term</label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                            <input
                                id="newPassword"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 pr-10"
                                placeholder="Enter password"
                                disabled={maintainPassword && isFetchingPwd}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600"
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                                        <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.742L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.064 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                                    </svg>
                                )}
                            </button>
                        </div>

                        <div className="flex flex-col gap-2 mt-4">
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="maintainPassword"
                                    checked={maintainPassword}
                                    onChange={(e) => setMaintainPassword(e.target.checked)}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor="maintainPassword" className="text-sm text-gray-600 select-none cursor-pointer">
                                    Maintain current school password
                                </label>
                                {isFetchingPwd && (
                                    <svg className="animate-spin h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                )}
                            </div>

                            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label htmlFor="vacationDate" className="block text-sm font-medium text-gray-700 mb-1">Selected Term's Vacation Date (Optional)</label>
                                    <input
                                        id="vacationDate"
                                        type="date"
                                        value={vacationDate}
                                        onChange={e => setVacationDate(e.target.value)}
                                        className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="reopeningDate" className="block text-sm font-medium text-gray-700 mb-1">Next Term's Reopening Date (Optional)</label>
                                    <input
                                        id="reopeningDate"
                                        type="date"
                                        value={reopeningDate}
                                        onChange={e => setReopeningDate(e.target.value)}
                                        className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="mt-3 flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="lockCurrentUsers"
                                    checked={lockCurrentUsers}
                                    onChange={(e) => setLockCurrentUsers(e.target.checked)}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor="lockCurrentUsers" className="text-sm text-gray-600 select-none cursor-pointer">
                                    Lock all users in current term
                                </label>
                                <span className="text-xs text-slate-400" title="Prevents changes to the current term's data after switching">(Read-only)</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex flex-row-reverse gap-3">
                    <button
                        onClick={handleCreate}
                        disabled={isCreating || isFetchingPwd}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center"
                    >
                        {isCreating && <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                        Create Term
                    </button>
                    <button
                        onClick={onClose}
                        className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- User Merging Tool (Debug) ---
interface MergeUsersModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUsers: User[];
    onMerge: (mergedUsers: User[]) => void;
    setFeedback: (feedback: FeedbackState | null) => void;
}

const MergeUsersModal: React.FC<MergeUsersModalProps> = ({ isOpen, onClose, currentUsers, onMerge, setFeedback }) => {
    const [schools, setSchools] = useState<{ docId: string; displayName: string }[]>([]);
    const [selectedDocId, setSelectedDocId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isMerging, setIsMerging] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const loadSchools = async () => {
                setIsLoading(true);
                try {
                    const list = await getSchoolList();
                    setSchools(list.map(s => ({ docId: s.docId, displayName: s.displayName })));
                } catch (e) {
                    setFeedback({ message: 'Failed to load schools for merging', type: 'error' });
                } finally {
                    setIsLoading(false);
                }
            };
            loadSchools();
        }
    }, [isOpen, setFeedback]);

    const handleMerge = async () => {
        if (!selectedDocId) return;
        setIsMerging(true);
        try {
            // 1. Fetch users from source term (Document Field)
            const sourceData = await getSchoolData(selectedDocId);
            const sourceUsers: User[] = (sourceData as any)?.users || [];

            if (!sourceUsers || sourceUsers.length === 0) {
                setFeedback({ message: 'No users found in the selected term', type: 'warning' });
                setIsMerging(false);
                return;
            }

            // 2. Perform Merge (Deduplicate by name + role)
            const mergedMap = new Map<string, User>();
            // Add current users first
            currentUsers.forEach(u => mergedMap.set(`${u.name}_${u.role}`, u));
            // Add source users (override/add new)
            sourceUsers.forEach(u => {
                const key = `${u.name}_${u.role}`;
                if (!mergedMap.has(key)) {
                    // New user: assign new ID to avoid collisions
                    mergedMap.set(key, { ...u, id: Date.now() + Math.floor(Math.random() * 1000) });
                }
            });

            onMerge(Array.from(mergedMap.values()));
            onClose();
        } catch (e) {
            setFeedback({ message: 'Merging failed: ' + (e as Error).message, type: 'error' });
        } finally {
            setIsMerging(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-[60] animate-fade-in-scale">
            <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md m-4">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Merge Users from Other Term</h3>
                <p className="text-sm text-gray-600 mb-4">
                    Select an existing term to pull users from. Only users with unique Name/Role combinations will be added.
                </p>

                {isLoading ? (
                    <div className="py-8 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-2 text-sm text-gray-500">Loading terms...</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Source Term</label>
                            <select
                                value={selectedDocId}
                                onChange={e => setSelectedDocId(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">Select a term...</option>
                                {schools.map(s => (
                                    <option key={s.docId} value={s.docId}>{s.displayName} ({s.docId})</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button
                                onClick={handleMerge}
                                disabled={!selectedDocId || isMerging}
                                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-semibold disabled:bg-blue-300"
                            >
                                {isMerging ? 'Merging...' : 'Merge Users'}
                            </button>
                            <button
                                onClick={onClose}
                                className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- User Export Tool (New Feature) ---
interface ExportUsersModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUsers: User[];
    setFeedback: (feedback: FeedbackState | null) => void;
}

const ExportUsersModal: React.FC<ExportUsersModalProps> = ({ isOpen, onClose, currentUsers, setFeedback }) => {
    const { settings, schoolId } = useData();
    const [periods, setPeriods] = useState<SchoolPeriod[]>([]);
    const [selectedDocId, setSelectedDocId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const loadPeriods = async () => {
                setIsLoading(true);
                try {
                    // Fetch all terms for the CURRENT school only (Scoped)
                    const docIdPrefix = schoolId ? schoolId.split('_')[0] : undefined;
                    const list = await getSchoolYearsAndTerms(settings.schoolName, undefined, docIdPrefix);
                    // Filter out the current active term (can't export to self)
                    const validPeriods = list.filter(p => p.docId !== schoolId);
                    setPeriods(validPeriods);
                } catch (e) {
                    setFeedback({ message: 'Failed to load terms for export', type: 'error' });
                } finally {
                    setIsLoading(false);
                }
            };
            loadPeriods();
        }
    }, [isOpen, settings.schoolName, schoolId, setFeedback]);

    const handleExport = async () => {
        if (!selectedDocId) return;
        setIsExporting(true);
        try {
            // 1. Fetch users from target term (Document Field)
            const targetData = await getSchoolData(selectedDocId);
            const targetUsers: User[] = (targetData as any)?.users || [];
            // Note: targetUsers is a reference, pushing to it simplifies merge? 
            // Better to keep it as read-only source for map initialization.

            // 2. Perform Merge (Current -> Target)
            const mergedMap = new Map<string, User>();
            // Add target users first
            targetUsers.forEach(u => mergedMap.set(`${u.name}_${u.role}`, u));

            let addedCount = 0;
            currentUsers.forEach(u => {
                const key = `${u.name}_${u.role}`;
                if (!mergedMap.has(key)) {
                    // New user to target: assign new ID to avoid collisions
                    mergedMap.set(key, { ...u, id: Date.now() + Math.floor(Math.random() * 1000) + addedCount });
                    addedCount++;
                }
            });

            if (addedCount === 0) {
                setFeedback({ message: 'No new users to export (all exist in target).', type: 'info' });
                setIsExporting(false);
                return;
            }

            const finalUsers = Array.from(mergedMap.values());

            // 3. Save to Target
            await saveDataTransaction(selectedDocId, { users: finalUsers });

            setFeedback({ message: `Successfully exported ${addedCount} user(s) to target term.`, type: 'success' });
            onClose();
        } catch (e) {
            setFeedback({ message: 'Export failed: ' + (e as Error).message, type: 'error' });
        } finally {
            setIsExporting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-[60] animate-fade-in-scale">
            <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md m-4">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Export Users to Term</h3>
                <p className="text-sm text-gray-600 mb-4">
                    Copy current users to another term within <strong>{settings.schoolName}</strong>.<br />
                    Existing users with the same Name/Role will be preserved.
                </p>

                {isLoading ? (
                    <div className="py-8 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-2 text-sm text-gray-500">Loading terms...</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Select Target Term</label>
                            {periods.length === 0 ? (
                                <p className="text-gray-500 text-sm mt-2 italic">No other terms found for this school.</p>
                            ) : (
                                <select
                                    value={selectedDocId}
                                    onChange={e => setSelectedDocId(e.target.value)}
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">Select a term...</option>
                                    {periods.map(p => (
                                        <option key={p.docId} value={p.docId}>
                                            {p.year} - {p.term}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button
                                onClick={handleExport}
                                disabled={!selectedDocId || isExporting}
                                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-semibold disabled:bg-green-300 disabled:cursor-not-allowed"
                            >
                                {isExporting ? 'Exporting...' : 'Export Users'}
                            </button>
                            <button
                                onClick={onClose}
                                className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const PasswordScopeModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (scope: 'current' | 'all') => void;
    termCount: number;
    currentTermName: string;
}> = ({ isOpen, onClose, onConfirm, termCount, currentTermName }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-[70] animate-fade-in-scale">
            <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md m-4">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-100 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Update Password Scope</h3>
                </div>

                <p className="text-gray-600 mb-6">
                    You have <strong>{termCount - 1}</strong> {termCount - 1 === 1 ? 'other term' : 'other terms'} for this school. How would you like to apply the new password?
                </p>

                <div className="space-y-3">


                    <button
                        onClick={() => onConfirm('all')}
                        className="w-full text-left p-4 border-2 border-blue-100 bg-blue-50 rounded-xl hover:bg-blue-100 hover:border-blue-400 transition-all group"
                    >
                        <div className="font-semibold text-blue-800">Apply to All Terms</div>
                        <div className="text-sm text-blue-600">Update for all {termCount} terms in history</div>
                    </button><button
                        onClick={() => onConfirm('current')}
                        className="w-full text-left p-4 border rounded-xl hover:bg-gray-50 hover:border-blue-300 transition-all group"
                    >
                        <div className="font-semibold text-gray-800 group-hover:text-blue-600">Current Term Only</div>
                        <div className="text-sm text-gray-500">Only update for {currentTermName}</div>
                    </button>
                </div>

                <div className="mt-6 text-center">
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 text-sm font-medium"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

const DataManagement: React.FC = () => {
    const dataContext = useData();
    const { settings, loadImportedData, saveToCloud, schoolId, updateSettings, isFetching } = dataContext;
    const { currentUser, users, setUsers } = useUser();
    const [processingAction, setProcessingAction] = useState<'import' | 'export' | 'generate_wpf' | 'share' | null>(null);
    const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning'; details?: string[]; detailsTitle?: string; } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [schoolPassword, setSchoolPassword] = useState('');
    const [showSchoolPassword, setShowSchoolPassword] = useState(false);
    const [isFetchingSchoolPassword, setIsFetchingSchoolPassword] = useState(false);
    const [isSavingSchoolPassword, setIsSavingSchoolPassword] = useState(false);

    // State for import confirmation modal
    const [fileToImport, setFileToImport] = useState<File | null>(null);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

    // State for share modal
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [customNumber, setCustomNumber] = useState('');

    // State for the post-download "Ready to Share" modal
    const [isReadyToShareModalOpen, setIsReadyToShareModalOpen] = useState(false);
    const [whatsAppUrlToOpen, setWhatsAppUrlToOpen] = useState('');
    const [shareFileName, setShareFileName] = useState('');

    // State for cloud save confirmation
    const [isCloudSaveModalOpen, setIsCloudSaveModalOpen] = useState(false);

    // State for user management
    const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
    const [isCreateTermModalOpen, setIsCreateTermModalOpen] = useState(false);
    const [isMergeUsersModalOpen, setIsMergeUsersModalOpen] = useState(false);
    const [isExportUsersModalOpen, setIsExportUsersModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'academic' | 'system' | 'backup'>('academic');


    const buttonStyles = "flex items-center justify-center bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-wait";

    const handleExport = async () => {
        setProcessingAction('export');
        setFeedback({ message: 'Generating database file...', type: 'info' });
        try {
            const fileData = await exportDatabase(dataContext);
            // @ts-ignore - Uint8Array from sql.js may have SharedArrayBuffer conflict with BlobPart
            const blob = new Blob([fileData as any], { type: 'application/x-sqlite3' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${settings.schoolName.replace(/ /g, '_')}_SBA_Backup.sdlx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setFeedback({ message: 'Database exported successfully!', type: 'success' });
        } catch (error) {
            console.error("Export failed:", error);
            setFeedback({ message: `Database export failed: ${(error as Error).message}`, type: 'error' });
        } finally {
            setProcessingAction(null);
        }
    };

    const handleImportClick = () => {
        setFeedback(null);
        fileInputRef.current?.click();
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (e.target) e.target.value = ''; // Reset input immediately to allow re-selection

        if (file) {
            setFileToImport(file);
            setIsConfirmModalOpen(true);
        }
    };

    const handleConfirmImport = () => {
        if (fileToImport) {
            processImport(fileToImport);
        }
        setIsConfirmModalOpen(false);
        setFileToImport(null);
    };

    const handleCancelImport = () => {
        setIsConfirmModalOpen(false);
        setFileToImport(null);
        setFeedback({ message: 'Import cancelled by user.', type: 'warning' });
        setTimeout(() => setFeedback(null), 3000);
    };

    const processImport = async (fileToImport: File) => {
        if (!fileToImport.name.toLowerCase().endsWith('.sdlx')) {
            setFeedback({ message: "Invalid file type. Please select an '.sdlx' file.", type: 'error' });
            return;
        }

        setProcessingAction('import');
        setFeedback({ message: 'Reading file...', type: 'info' });

        try {
            const arrayBuffer = await fileToImport.arrayBuffer();
            const dbFile = new Uint8Array(arrayBuffer);

            setFeedback({ message: 'Processing database... This may take a moment.', type: 'info' });
            await new Promise(resolve => setTimeout(resolve, 50)); // Allow UI to render feedback

            const { data: importedData, diagnostics } = await importDatabase(dbFile);

            setFeedback({ message: 'Updating application data...', type: 'info' });

            // CRITICAL FIX: Temporarily block remote updates to prevent listener spam
            // This prevents the app from trying to re-read data while we're bulk-importing
            dataContext.blockRemoteUpdates();

            // Pass 'false' for isRemote to trigger dirty detection and cloud save
            loadImportedData(importedData, false);

            const totalSkipped = diagnostics.records.skipped + diagnostics.comments.skipped;
            const totalRecords = diagnostics.records.total + diagnostics.comments.total;

            if (totalSkipped > 0) {
                setFeedback({
                    message: `Import partially successful. ${totalRecords - totalSkipped} of ${totalRecords} data points loaded. ${totalSkipped} were skipped.`,
                    type: 'warning',
                    detailsTitle: 'Details of skipped records:',
                    details: diagnostics.skippedReasons
                });
            } else {
                setFeedback({ message: 'Database imported successfully! All data has been updated.', type: 'success' });
            }

            // Prompt to save to cloud if logged in
            if (schoolId) {
                setIsCloudSaveModalOpen(true);
            } else {
                // Re-enable remote updates if not saving to cloud
                dataContext.allowRemoteUpdates();
            }
        } catch (error) {
            console.error("Import processing failed:", error);
            const errorMessage = error instanceof Error ? `Import failed: ${error.message}` : "An unknown error occurred during import.";
            setFeedback({ message: errorMessage, type: 'error' });
            // Re-enable remote updates on error
            dataContext.allowRemoteUpdates();
        } finally {
            setProcessingAction(null);
        }
    };

    const handleShare = async (phoneNumber: string) => {
        setIsShareModalOpen(false);
        setProcessingAction('share');
        setFeedback({ message: 'Generating database file for sharing...', type: 'info' });

        try {
            const fileData = await exportDatabase(dataContext);
            // @ts-ignore - Uint8Array from sql.js may have SharedArrayBuffer conflict with BlobPart
            const blob = new Blob([fileData as any], { type: 'application/x-sqlite3' });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const fileName = `${settings.schoolName.replace(/ /g, '_')}_SBA_Backup.sdlx`;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            const message = `Here is my SBA Pro Master database backup file. Please attach the file that was just downloaded.`;
            const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

            // Prepare for the "Ready to Share" modal
            setWhatsAppUrlToOpen(whatsappUrl);
            setShareFileName(fileName);
            setIsReadyToShareModalOpen(true);
            setFeedback(null); // Clear the "Generating..." feedback

        } catch (error) {
            console.error("Share failed:", error);
            setFeedback({ message: `Sharing failed: ${(error as Error).message}`, type: 'error' });
        } finally {
            setProcessingAction(null);
            setShowCustomInput(false);
            setCustomNumber('');
        }
    };

    const handleConfirmCloudSave = async () => {
        setIsCloudSaveModalOpen(false);
        setFeedback({ message: 'Saving imported data to cloud...', type: 'info' });
        try {
            // PASS TRUE to skip the auto-refresh.
            // When importing a full DB, we trust the import data we just loaded into memory.
            // Fetching it back from the cloud immediately is a waste of Quota (Reads).
            await saveToCloud(true, true);
            setFeedback({ message: 'Data saved to cloud successfully!', type: 'success' });
        } catch (error) {
            console.error("Cloud save failed:", error);
            setFeedback({ message: 'Failed to save data to cloud.', type: 'error' });
        } finally {
            // CRITICAL: Re-enable remote updates after save completes
            dataContext.allowRemoteUpdates();
        }
    };

    useEffect(() => {
        const loadPwd = async () => {
            if (!schoolId) return;
            setIsFetchingSchoolPassword(true);
            try {
                const data = await getSchoolData(schoolId);
                setSchoolPassword((data as any)?.password || '');
            } catch (e) {
                // ignore - optional
            } finally {
                setIsFetchingSchoolPassword(false);
            }
        };
        loadPwd();
    }, [schoolId]);

    // State for Password Scope Modal
    const [isPasswordScopeModalOpen, setIsPasswordScopeModalOpen] = useState(false);
    const [relatedTerms, setRelatedTerms] = useState<SchoolPeriod[]>([]);
    const [isBatchUpdating, setIsBatchUpdating] = useState(false);

    const handleSaveSchoolPassword = async () => {
        if (!schoolId) {
            setFeedback({ message: 'No active school to update', type: 'error' });
            return;
        }

        setIsSavingSchoolPassword(true);
        try {
            // 1. Check for other terms
            const docIdPrefix = schoolId.split('_')[0];
            const terms = await getSchoolYearsAndTerms(settings.schoolName, undefined, docIdPrefix);

            if (terms.length > 1) {
                // Multiple terms found -> Ask user
                setRelatedTerms(terms);
                setIsPasswordScopeModalOpen(true);
                setIsSavingSchoolPassword(false); // Valid pause
                return;
            }

            // Single term -> Save immediately
            await saveDataTransaction(schoolId, { password: schoolPassword });
            setFeedback({ message: 'School password updated successfully.', type: 'success' });
        } catch (e) {
            console.error('Failed to save school password', e);
            setFeedback({ message: 'Failed to save school password.', type: 'error' });
        } finally {
            if (!isPasswordScopeModalOpen) {
                setIsSavingSchoolPassword(false);
                setTimeout(() => setFeedback(null), 3000);
            }
        }
    };

    const handleConfirmPasswordUpdate = async (scope: 'current' | 'all') => {
        setIsPasswordScopeModalOpen(false);
        setIsBatchUpdating(true);
        setFeedback({ message: scope === 'all' ? 'Updating password for all terms...' : 'Updating password...', type: 'info' });

        try {
            if (scope === 'current') {
                await saveDataTransaction(schoolId!, { password: schoolPassword });
                setFeedback({ message: 'Password updated for current term only.', type: 'success' });
            } else {
                // Batch update
                const updatePromises = relatedTerms.map(term =>
                    saveDataTransaction(term.docId, { password: schoolPassword })
                );
                await Promise.all(updatePromises);
                setFeedback({ message: `Password updated for all ${relatedTerms.length} terms.`, type: 'success' });
            }
        } catch (e) {
            console.error('Batch password update failed', e);
            setFeedback({ message: 'Failed to update password(s).', type: 'error' });
        } finally {
            setIsBatchUpdating(false);
            setIsSavingSchoolPassword(false);
            setTimeout(() => setFeedback(null), 4000);
        }
    };



    const handleCancelCloudSave = () => {
        setIsCloudSaveModalOpen(false);
        // Re-enable remote updates if user cancels the save
        dataContext.allowRemoteUpdates();
    };

    const handleUserManagementSave = async (updatedUsers: User[], shouldClose: boolean = true) => {
        if (!schoolId) {
            setFeedback({ message: 'Cannot save users: No active school session', type: 'error' });
            return;
        }

        setFeedback({ message: 'Applying changes...', type: 'info' });
        try {
            // Update local UserContext
            setUsers(updatedUsers);

            // Persist users immediately to the cloud to avoid losing them on relogin.
            // Since Apply button saves directly to cloud, we do NOT call loadImportedData 
            // to avoid queuing for global save again.
            try {
                await saveDataTransaction(schoolId, { users: updatedUsers });
                setFeedback({ message: 'User changes saved to cloud successfully.', type: 'success' });
            } catch (cloudErr) {
                console.error('Failed to save users to cloud:', cloudErr);
                setFeedback({ message: 'User changes applied locally, but failed to save to cloud. Please click SAVE in the top bar to retry.', type: 'warning' });
            }

            if (shouldClose) {
                setIsUserManagementOpen(false);
            }
            // Clear feedback after 4 seconds
            setTimeout(() => setFeedback(null), 4000);
        } catch (error) {
            console.error('Failed to update users:', error);
            setFeedback({ message: 'Failed to update user changes', type: 'error' });
        }
    };

    const generateWpfPrompt = () => {
        const prompt = [
            `# Blueprint: Recreate "SBA Pro Master" as a Native WPF Application`,
            ``,
            `## 1. High-Level Goal`,
            ``,
            `Act as an expert C# WPF developer specializing in UI/UX and modern desktop application architecture. Create a complete, fully-functional, and visually polished native Windows desktop application using WPF that is a **perfect, 1-to-1 replica** of the "SBA Pro Master" web application. The final product must be indistinguishable from the original in terms of layout, styling, fonts, colors, animations, and all interactive behaviors.`,
            ``,
            `## 2. Core Technologies & Architecture`,
            ``,
            `*   **Language & Framework:** C# 12, .NET 8 WPF.`,
            `*   **Architecture:** **Model-View-ViewModel (MVVM)** is mandatory. Use the \`CommunityToolkit.Mvvm\` library for MVVM patterns (\`[ObservableProperty]\`, \`[RelayCommand]\`).`,
            `*   **UI Toolkit:** Use **Material Design in XAML** (\`MaterialDesignThemes\`) to achieve the modern aesthetic. Configure its theme to match the specific colors outlined below.`,
            `*   **Database:** Use **SQLite** via **Entity Framework Core (SQLite Provider)**. The primary database should be \`sba_pro_master.db\`. You must also implement logic to import from and export to a legacy SQLite format with a specific schema (see Database section).`,
            `*   **Dependency Injection:** Use \`Microsoft.Extensions.DependencyInjection\` to structure the application.`,
            ``,
            `## 3. Global Styles, Theme, and Typography`,
            ``,
            `### 3.1. Color Palette (Material Design Theme)`,
            `*   **Primary Blue:** \`#2563EB\``,
            `*   **Background Gray:** \`#F9FAFB\``,
            `*   **Card/Surface White:** \`#FFFFFF\``,
            `*   **Primary Text:** \`#1F2937\``,
            `*   **Secondary Text:** \`#4B5563\``,
            `*   **Borders:** \`#E5E7EB\``,
            `*   **Danger/Delete Red:** \`#DC2626\``,
            ``,
            `### 3.2. Typography`,
            `*   **Primary Font:** **Segoe UI** (standard for Windows).`,
            `*   **Report Card Font:** **Times New Roman**. This is critical and must only be used within the \`ReportCardView.xaml\` control.`,
            ``,
            `## 4. Main Window Shell and Navigation`,
            ``,
            `### 4.1. SidebarView.xaml - Detailed Behavior`,
            `*   **Structure:** A \`Grid\` as the root. A \`ToggleButton\` can control the collapsed/expanded state, or it can be purely mouse-driven.`,
            `*   **Collapsible Behavior:** Expanded \`Width\`: \`256\`, Collapsed \`Width\`: \`80\`. Animate this width change over 300ms using a \`CubicEase\`.`,
            `*   **Triggers:** Use \`EventTrigger\`s for \`MouseEnter\` (to expand) and \`MouseLeave\` (to collapse).`,
            `*   **Content Fading:** The "SBA Pro Master" \`TextBlock\` and the icon labels must have their \`Opacity\` animated from 1 to 0 during collapse, and 0 to 1 during expansion (duration 200ms). When collapsed, their \`Visibility\` must be \`Collapsed\`.`,
            `*   **Navigation Items (\`ListBox\`):** \`ListBoxItem\` style must have a \`Trigger\` for \`IsSelected="True"\` setting \`Background\` to Primary Blue and \`Foreground\` to White, with a \`CornerRadius\` of 8. A \`Trigger\` for \`IsMouseOver\` (when not selected) should change background to light blue (\`#DBEAFE\`).`,
            ``,
            `## 5. Page-by-Page UI/UX Deep Dive`,
            ``,
            `### 5.1. Global Behaviors`,
            `*   **Modals:** When a modal opens, the main window background must be dimmed. The modal must appear with a **fade-in and scale-up transform** over 200ms.`,
            `*   **CRUD Pages (Students, Subjects, etc.):** Use a consistent layout with a top search bar, an "Add New" button, and a main \`DataGrid\`. The \`DataGrid\`'s action column must contain two icon-only buttons for Edit (blue pencil) and Delete (red trash can).`,
            ``,
            `### 5.2. Dashboard Page`,
            `*   **Stat Cards:** On \`IsMouseOver\`, apply a \`ScaleTransform\` to **1.05** over 200ms.`,
            ``,
            `### 5.3. Score Entry Page`,
            `*   **DataGrid:** Columns are dynamically generated based on assessments. The last column is a "Total" column.`,
            `*   **Custom Cell Templates:**`,
            `    *   **Multiple Scores Cell:** If a student has >1 score for an assessment, the cell shows a button-like \`TextBlock\` with the calculated score and a sub-text like "(3 scores)". Clicking it opens the multi-score modal.`,
            `    *   **Single Score Cell:** For 0 or 1 score, the cell contains an inline \`TextBox\` and a small "+" \`Button\`. The \`TextBox\` saves on \`LostFocus\` or Enter key. The "+" button opens the multi-score modal.`,
            ``,
            `### 5.4. Report Viewer Page`,
            `*   **Floating Action Button (FAB):** A circular, blue button (\`Width="56"\`, \`Height="56"\`) in the bottom-right corner with a Print icon and a \`DropShadowEffect\`. On \`IsMouseOver\`, it must scale to **1.1**.`,
            `*   **Report Customization Panel (The Slide-Out):**`,
            `    *   **Layering:** This panel must exist in an overlay \`Grid\` on top of the main content.`,
            `    *   **Structure & Appearance:** A \`Border\` with \`Width="384"\`. Its \`Background\` must be a semi-transparent brush (\`#FFFFFFCC\`) with a \`BlurEffect\` (\`Radius="10"\`) to blur the content underneath.`,
            `    *   **Animation:** The panel's position is controlled by a \`TranslateTransform\`. Expanded State: \`X = 0\`. Collapsed State: \`X = 352\` (Width - 32px Tab Size). Animate the \`X\` property over 500ms with an \`ExponentialEase\`.`,
            `    *   **Triggers:** The state is controlled by a ViewModel property. This property is changed by \`MouseEnter\`/\`MouseLeave\` on the panel. To prevent collapsing while typing, the \`MouseLeave\` trigger must be ignored if \`IsKeyboardFocusWithin\` is true on the panel.`,
            ``,
            `### 5.5. The Report Card (\`ReportCardView.xaml\`) - CRITICAL BLUEPRINT`,
            `This is the most complex visual component. It must be a **pixel-perfect** recreation. Create a \`UserControl\` with a fixed size of **794x1123 pixels** (A4 at 96 DPI). Use a root \`Grid\` with a 4px black \`Border\`. The font for **ALL** text inside this control must be **Times New Roman**.`,
            ``,
            `**Layout Structure (Root Grid):**`,
            `Define rows for each major section: Header, Student Details, Academic Performance, Grading Key, Remarks, and Signatures/Footer.`,
            ``,
            `*   **Row 0: Header:** \`Height="Auto"\`. Contains a \`Grid\` with 3 columns (\`*\`, \`2*\`, \`*\`).`,
            `    *   Col 0: School Logo (\`Image\`, \`Width="160"\`, \`Height="128"\`).`,
            `    *   Col 1: \`StackPanel\` with \`TextBlock\`s for School Name (\`FontSize="28"\`, \`FontWeight="Bold"\`), Address, and "TERMINAL REPORT" (\`FontSize="20"\`, \`FontWeight="SemiBold"\`).`,
            ``,
            `*   **Row 1: Student Details:** \`Height="Auto"\`. Contains a main \`Grid\` with 2 columns (\`*\`, \`Auto\`).`,
            `    *   Col 0: Contains nested \`Grid\`s for the info layout (Name, Year, Class, etc.).`,
            `    *   **INTELLIGENT RESIZING & DOTTED UNDERLINES:** Each data field (e.g., student's name) must be a \`Grid\` with a label \`TextBlock\` and a \`Border\` for the value. The \`Border\` has only a \`BorderThickness="0,0,0,1"\` and a dotted \`StrokeDashArray\`. The value inside this \`Border\` is a \`TextBlock\` that MUST implement **intelligent text resizing**.`,
            `    *   **Resizing Logic:** Create a custom control or attached property. It must check if the \`TextBlock\`'s \`ActualWidth\` exceeds its container's \`ActualWidth\`. If it does, programmatically reduce the \`FontSize\` in small decrements (e.g., 0.5pt) until it fits. The text must **never wrap**. This is the "smart resizing" feature.`,
            `    *   Col 1: Student Picture (\`Image\` within a \`Border\`, \`Width="128"\`, \`Height="160"\`, \`BorderThickness="2"\`).`,
            ``,
            `*   **Row 2: Academic Performance:** \`Height="*"\`. This row takes up the remaining flexible space to vertically center the table. Use a \`Grid\` for the table, not a \`DataGrid\`, for precise layout control. All cells have a 1px black \`Border\`.`,
            ``,
            `*   **Row 3: Grading Key:** \`Height="Auto"\`. A \`Border\` with a black background and white text for the header. Inside, a \`UniformGrid\` or \`Grid\` with 4 columns displays the grading scale.`,
            ``,
            `*   **Row 4: Remarks:** Height="Auto". A StackPanel of "Dotted Underline" controls for: Attendance, Conduct, Interest, Attitude, and Class Teacher's Remarks.`,
            ``,
            `*   **Row 5: Signatures:** \`Height="Auto"\`. A \`Grid\` with 3 columns for Teacher Signature, Headmaster Signature, and the School Stamp box (a dashed \`Border\`).`,
            ``,
            `*   **Layering/Footer:** The "Printed on..." footer text must be placed in a \`Canvas\` or an overlay \`Grid\` at the absolute bottom, slightly outside the main black border.`,
            ``,
            `## 6. Data Models`,
            `Define C# record types for all entities: \`Student\`, \`Subject\`, \`Class\`, \`Grade\`, \`Assessment\`, \`ScoreEntry\`, \`SchoolSettings\`, \`ReportSpecificData\`, \`ClassSpecificData\`. Image data should be \`byte[]\`.`,
            ``,
            `## 7. Database Schema for .sdlx Import/Export`,
            `The application must be able to import from and export to a legacy SQLite database file (\`.sdlx\`) with the following exact schema. This is a critical compatibility requirement.`,
            '```sql',
            `CREATE TABLE Assessment (ID integer primary key autoincrement, Name varchar (900), Basis varchar(900), TargetValue varchar (900), SumTarget varchar (900));`,
            `CREATE TABLE Comments (ID integer primary key autoincrement, Student varchar (900), IndexNumber varchar (900), Class varchar (900), Attendance varchar (900), Outof varchar (900), Conduct varchar (900), Attitude varchar (900), TeacherRemarks varchar (900), HeadRemarks varchar (900));`,
            `CREATE TABLE Grades (ID integer primary key autoincrement, Grade varchar (900), MinimumValue varchar (900), MaximumValue varchar (900), Remarks varchar (900), "GradeValue" TEXT);`,
            `CREATE TABLE Records (ID integer primary key autoincrement, Class varchar (900), Student varchar (900), IndexNumber varchar (900), Subject varchar (900), AssessmentType varchar (900), Score varchar (900), AssessmentBasis varchar (900));`,
            `CREATE TABLE Settings (ID integer primary key autoincrement, SchoolName varchar (900), District varchar (900), Address varchar (900), AcademicYear varchar (900), VacationDate varchar (900), ReopeningDate varchar (900), AcademicTerm varchar (900), LogoPath BLOB, HeadSignaturePath BLOB, DatabaseGuid varchar(64), HeadmasterName TEXT, ShowPromotionStatus INTEGER, "RecentActivityLimit" INTEGER, MaxRecentActivities INTEGER, LeftRightNavigate INTEGER, LastSelectedSubjectID INTEGER, LastSelectedClass TEXT, ReportEditorIsExpanded INTEGER, ReportEditorWidth REAL, MainWindowWidth REAL, MainWindowHeight REAL, MainWindowLeft REAL, MainWindowTop REAL, MainWindowState TEXT, ScoreEntryInstructionsExpanded INTEGER, ScoreEntryOverlayOffsetX REAL, ScoreEntryOverlayOffsetY REAL);`,
            `CREATE TABLE Student (ID integer primary key autoincrement, Name varchar (900), Gender varchar (900), IndexNumber varchar (900), Class varchar (900), DateOfBirth varchar (900), Picture BLOB, Age varchar (900), "Promotions" TEXT);`,
            `CREATE TABLE Subjects (ID integer primary key autoincrement, Subject varchar (900), Type varchar (900), Facilitator varchar (900), Signature BLOB, "SubjectName" TEXT);`,
            `CREATE TABLE TeacherSignature (ID integer primary key autoincrement, Class varchar (900), TeacherSignaturePath BLOB, TeacherName TEXT);`,
            '```',
            ``,
            `## 8. Data Mapping Logic (Import/Export)`,
            `This logic is complex and must be implemented precisely.`,
            ``,
            `### Import Logic (Reading from .sdlx)`,
            `1.  **Direct Mappings:** Read from \`Student\`, \`Subjects\`, \`Grades\`, \`Assessment\`, and \`Settings\` tables. Convert \`BLOB\` to \`byte[]\`. Normalize all dates to "YYYY-MM-DD" and calculate \`Age\`.`,
            `2.  **Derived Classes:** Create \`Class\` entities from the \`TeacherSignature\` table.`,
            `3.  **Score Aggregation:** Iterate through every row in the \`Records\` table. For each row, find the matching Student, Subject, and Assessment (use Dictionaries for performance). Construct a score string "score/basis". Find or create a single \`Score\` object for the Student-Subject pair and add the score string to the correct assessment list inside it.`,
            `4.  **Report Data Aggregation:** Iterate the \`Comments\` table. Find the matching student. Create a \`ReportSpecificData\` object. **CRITICAL MAPPING:** The app's "Interest" field maps to the database's \`HeadRemarks\` column. Create a \`ClassSpecificData\` object, mapping the \`Outof\` column to \`totalSchoolDays\`.`,
            ``,
            `### Export Logic (Writing to .sdlx)`,
            `1.  Reverse the process above.`,
            `2.  **Score De-normalization:** For each \`Score\` object, loop through its internal dictionary. For every score string in the list for an assessment, write a **separate row** into the \`Records\` table.`,
            `3.  **Comments:** For each \`ReportSpecificData\` object, write one row to the \`Comments\` table, mapping "Interest" back to the \`HeadRemarks\` column.`,
            ``,
            `## 9. Final Output`,
            ``,
            `Generate the complete C# and XAML code, structured into folders: \`Views\`, \`ViewModels\`, \`Models\`, \`Services\`, \`Controls\`, \`Styles\`. The code must be well-commented, follow MVVM best practices, and be ready to compile and run.`,
        ].join('\n');

        const blob = new Blob([prompt], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'SBA_Pro_Master_WPF_Recreation_Prompt.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setFeedback({ message: 'Detailed WPF recreation prompt downloaded successfully!', type: 'success' });
        setTimeout(() => setFeedback(null), 4000);
    };

    const handleGenerateWpfProject = async () => {
        setProcessingAction('generate_wpf');
        setFeedback({ message: 'Generating WPF project files... This may take a few moments.', type: 'info' });
        try {
            const blob = await generateWpfProject();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'SBAProMaster_WPF_Project.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setFeedback({ message: 'WPF project generated and downloaded successfully!', type: 'success' });
        } catch (error) {
            console.error("WPF Project generation failed:", error);
            setFeedback({ message: `WPF project generation failed: ${(error as Error).message}`, type: 'error' });
        } finally {
            setProcessingAction(null);
        }
    };


    const FeedbackPanel = () => {
        if (!feedback) return null;

        const colors = {
            success: 'bg-green-100 border-green-300 text-green-800',
            error: 'bg-red-100 border-red-300 text-red-800',
            info: 'bg-blue-100 border-blue-300 text-blue-800',
            warning: 'bg-yellow-100 border-yellow-300 text-yellow-800',
        };

        const icons = {
            success: <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>,
            error: <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>,
            info: <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>,
            warning: <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.636-1.1 2.252-1.1 2.888 0l6.294 10.874c.636 1.1-.176 2.527-1.444 2.527H3.407c-1.268 0-2.08-1.427-1.444-2.527L8.257 3.099zM9 12a1 1 0 112 0 1 1 0 01-2 0zm1-4a1 1 0 00-1 1v2a1 1 0 102 0V9a1 1 0 00-1-1z" clipRule="evenodd" /></svg>,
        };

        return (
            <div
                onClick={() => setFeedback(null)}
                className={`fixed top-28 right-6 z-50 w-full max-w-md p-4 rounded-xl shadow-lg border animate-fade-in-scale cursor-pointer ${colors[feedback.type]}`}
            >
                <div className="flex items-start justify-between">
                    <div className="flex items-start flex-grow">
                        <div className="flex-shrink-0 mr-3 mt-1">{icons[feedback.type]}</div>
                        <div className="flex-grow">
                            <p className="font-bold">{feedback.message}</p>
                            {feedback.details && feedback.details.length > 0 && (
                                <div className="mt-2 text-sm">
                                    {feedback.detailsTitle && <p className="font-semibold">{feedback.detailsTitle}</p>}
                                    <ul className="space-y-1 max-h-40 overflow-y-auto bg-black/5 p-2 rounded-md mt-1">
                                        {feedback.details.map((detail, index) => (
                                            <li key={index}>{detail}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                    <button onClick={() => setFeedback(null)} className="ml-4 -mt-1 -mr-1 p-1 rounded-full hover:bg-black/10 transition-colors flex-shrink-0">
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
        );
    }



    const ReadyToShareModal = () => {
        if (!isReadyToShareModalOpen) return null;

        return (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 animate-fade-in-scale">
                <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md m-4">
                    <h3 className="text-lg leading-6 font-bold text-gray-900 flex items-center">
                        <svg className="h-6 w-6 text-green-500 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                        Ready to Share!
                    </h3>
                    <div className="mt-4 text-sm text-gray-600 space-y-3">
                        <p>Your file <code className="bg-gray-200 text-gray-800 px-1 py-0.5 rounded text-xs">{shareFileName}</code> has been saved to your browser's "Downloads" folder.</p>
                        <div>
                            <p className="font-semibold mb-1">Final Steps:</p>
                            <ol className="list-decimal list-inside space-y-1">
                                <li>Click the "Open WhatsApp" button below.</li>
                                <li>Find the new WhatsApp tab in your browser.</li>
                                <li>Click the attach icon (📎), select your file, and send!</li>
                            </ol>
                        </div>
                    </div>
                    <div className="mt-6 flex flex-col-reverse sm:flex-row-reverse gap-3">
                        <button
                            onClick={() => {
                                if (whatsAppUrlToOpen) {
                                    window.open(whatsAppUrlToOpen, '_blank');
                                }
                                setIsReadyToShareModalOpen(false);
                            }}
                            className="w-full sm:w-auto flex items-center justify-center bg-green-500 text-white px-4 py-2 rounded-lg shadow font-semibold hover:bg-green-600 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z" />
                            </svg>
                            Open WhatsApp
                        </button>
                        <button
                            onClick={() => setIsReadyToShareModalOpen(false)}
                            className="w-full sm:w-auto px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    };


    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-32 lg:pb-8">
            <h1 className="text-3xl font-bold text-gray-800">Data Management</h1>

            <FeedbackPanel />

            <CreateTermModal isOpen={isCreateTermModalOpen} onClose={() => setIsCreateTermModalOpen(false)} setFeedback={setFeedback} />
            <ExportUsersModal isOpen={isExportUsersModalOpen} onClose={() => setIsExportUsersModalOpen(false)} currentUsers={users} setFeedback={setFeedback} />

            {/* Sticky Tabs Navigation */}
            <div className="sticky top-0 z-20 -mx-4 px-4 py-3 bg-white/90 backdrop-blur-md border-b border-gray-100 lg:static lg:bg-transparent lg:border-none lg:px-0 lg:py-0 lg:mb-8">
                <div className="flex w-full lg:w-fit gap-1 p-1 bg-gray-200/50 rounded-2xl">
                    {[
                        { id: 'academic', label: 'Academic', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5S19.832 5.477 21 6.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg> },
                        { id: 'system', label: 'System', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
                        { id: 'backup', label: 'Backup', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg> },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex flex-1 lg:flex-none items-center justify-center px-4 py-3 text-sm font-bold rounded-xl transition-all duration-300 ${
                                activeTab === tab.id
                                    ? 'bg-white text-blue-600 shadow-md transform scale-[1.02]'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
                            }`}
                        >
                            {tab.icon}
                            <span className="hidden sm:inline">{tab.label}</span>
                            <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="animate-fade-in-up">
                {/* 1. Academic Tab */}
                {activeTab === 'academic' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-8">
                            {currentUser?.role === 'Admin' && (
                                <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
                                    <div className="flex items-center mb-4">
                                        <div className="p-2 bg-blue-100 rounded-lg mr-3">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <h2 className="text-xl font-bold text-gray-800">Academic Session</h2>
                                    </div>

                                    <div className="space-y-6">
                                        {/* Next Term Highlighted Card */}
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-100 shadow-sm transition-all hover:shadow-md group">
                                            <div className="mb-4 sm:mb-0">
                                                <h3 className="text-lg font-bold text-blue-900 group-hover:text-blue-700 transition-colors">Next Term Setup</h3>
                                                <p className="text-sm text-blue-600 mt-1">Prepare the database for the upcoming academic session.</p>
                                            </div>
                                            <button
                                                onClick={() => setIsCreateTermModalOpen(true)}
                                                className="w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-xl shadow-lg hover:bg-blue-700 hover:shadow-xl transition-all font-bold flex items-center justify-center active:scale-95"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M12 4v16m8-8H4" />
                                                </svg>
                                                Start New Term
                                            </button>
                                        </div>

                                        {SHOW_USER_EXPORT_BUTTON && (
                                            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-100">
                                                <div>
                                                    <h3 className="font-semibold text-gray-800">Export Users</h3>
                                                    <p className="text-sm text-gray-500 mt-1">Copy current user list to another term.</p>
                                                </div>
                                                <button
                                                    onClick={() => setIsExportUsersModalOpen(true)}
                                                    className="bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition-colors text-sm font-semibold flex items-center"
                                                >
                                                    Export Users
                                                </button>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                                            <div>
                                                <h3 className="font-semibold text-gray-800">Promotion Mode</h3>
                                                <p className="text-sm text-gray-500 mt-1">Enable "Promoted To" field on reports.</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={settings.isPromotionTerm || false}
                                                    onChange={(e) => updateSettings({ isPromotionTerm: e.target.checked })}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                            </label>
                                        </div>

                                        <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 flex flex-col gap-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="font-semibold text-gray-800 text-sm md:text-base">Aggregate Score</h3>
                                                    <p className="text-xs text-gray-500 mt-1">Show aggregate score on report cards.</p>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={settings.showAggregateScore ?? false}
                                                        onChange={(e) => updateSettings({ showAggregateScore: e.target.checked })}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                                </label>
                                            </div>

                                            {settings.showAggregateScore && (
                                                <div className="pt-3 border-t border-gray-200 animate-fade-in">
                                                    <p className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wider">Include for Classes:</p>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                        {dataContext.classes.map((cls) => (
                                                            <label key={cls.id} className="flex items-center group cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    className="sr-only peer"
                                                                    checked={settings.aggregateScoreClasses?.includes(cls.id) ?? false}
                                                                    onChange={(e) => {
                                                                        const current = settings.aggregateScoreClasses || [];
                                                                        const updated = e.target.checked
                                                                            ? [...current, cls.id]
                                                                            : current.filter(id => id !== cls.id);
                                                                        updateSettings({ aggregateScoreClasses: updated });
                                                                    }}
                                                                />
                                                                <div className="w-5 h-5 border-2 border-gray-300 rounded peer-checked:bg-blue-600 peer-checked:border-blue-600 flex items-center justify-center">
                                                                    <svg className={`h-3 w-3 text-white ${settings.aggregateScoreClasses?.includes(cls.id) ? 'block' : 'hidden'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                </div>
                                                                <span className="ml-2 text-sm text-gray-700">{cls.name}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="space-y-8">
                            {currentUser && currentUser.role === 'Admin' && <IndexNumberConfig />}
                        </div>
                    </div>
                )}

                {/* 2. System Tab */}
                {activeTab === 'system' && (
                    <div className="max-w-4xl space-y-8">
                        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
                            <div className="flex items-center mb-6">
                                <div className="p-2 bg-gray-100 rounded-lg mr-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                </div>
                                <h2 className="text-xl font-bold text-gray-800">System Administration</h2>
                            </div>

                            <div className="space-y-6">
                                {currentUser?.role === 'Admin' && (
                                    <div className="pb-6 border-b border-gray-100">
                                        <h3 className="font-semibold text-gray-800 mb-4">Access Control</h3>
                                        <div className="grid gap-3">
                                            <button
                                                onClick={() => setIsUserManagementOpen(true)}
                                                className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-200 transition-all group"
                                            >
                                                <div className="flex items-center">
                                                    <span className="text-gray-700 font-medium group-hover:text-blue-600 transition-colors">Manage Users & Permissions</span>
                                                </div>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 group-hover:text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                                </svg>
                                            </button>

                                            {DEV_TOOLS_ENABLED && (
                                                <button
                                                    onClick={() => setIsMergeUsersModalOpen(true)}
                                                    className="w-full flex items-center justify-between p-4 border border-dashed border-indigo-200 bg-indigo-50/50 rounded-lg hover:bg-indigo-50 transition-all"
                                                >
                                                    <div className="text-left font-medium text-indigo-700">Debug: Merge Users From Another Term</div>
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-400" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {currentUser?.role === 'Admin' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between">
                                            <div>
                                                <h3 className="font-semibold text-gray-800 text-sm">Student Progress View</h3>
                                                <p className="text-xs text-gray-500 mt-1">Allow teachers to view student progress maps</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={settings.allowStudentProgressView || false}
                                                    onChange={(e) => updateSettings({ allowStudentProgressView: e.target.checked })}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                            </label>
                                        </div>

                                        <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between">
                                            <div>
                                                <h3 className="font-semibold text-gray-800 text-sm">Data Persistence</h3>
                                                <p className="text-xs text-gray-500 mt-1">Enable local cache for faster loading</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={settings.allowPersistence ?? true}
                                                    onChange={(e) => updateSettings({ allowPersistence: e.target.checked })}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {currentUser?.role === 'Admin' && (
                                    <div className="pt-6 border-t border-gray-100">
                                        <h3 className="font-semibold text-gray-800 mb-4">School Credentials</h3>
                                        <div className="max-w-md">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Update School Password</label>
                                            <div className="flex gap-2">
                                                <div className="relative flex-grow">
                                                    <input
                                                        type={showSchoolPassword ? "text" : "password"}
                                                        value={schoolPassword}
                                                        onChange={(e) => setSchoolPassword(e.target.value)}
                                                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                        placeholder="Enter new password"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowSchoolPassword(!showSchoolPassword)}
                                                        className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400"
                                                    >
                                                        {showSchoolPassword ? <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg> : <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                                    </button>
                                                </div>
                                                <button
                                                    onClick={handleSaveSchoolPassword}
                                                    disabled={isSavingSchoolPassword || !schoolPassword}
                                                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 font-medium transition-colors"
                                                >
                                                    {isSavingSchoolPassword ? 'Saving...' : 'Update'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. Backup Tab */}
                {activeTab === 'backup' && (
                    <div className="max-w-4xl space-y-8">
                        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
                            <div className="flex items-center mb-6">
                                <div className="p-2 bg-green-100 rounded-lg mr-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                                    </svg>
                                </div>
                                <h2 className="text-xl font-bold text-gray-800">Database Tools</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {currentUser?.role === 'Admin' && (
                                    <div className="p-4 border border-gray-100 bg-gray-50 rounded-xl">
                                        <h3 className="font-semibold text-gray-800 mb-2">Import Data</h3>
                                        <p className="text-sm text-gray-500 mb-4">Restore from a previous backup file (.sdlx)</p>
                                        <button
                                            onClick={handleImportClick}
                                            disabled={processingAction !== null}
                                            className="w-full flex items-center justify-center bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors font-medium shadow-sm"
                                        >
                                            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                            Import .sdlx
                                        </button>
                                        <input type="file" accept=".sdlx" onChange={handleFileSelect} className="hidden" ref={fileInputRef} />
                                    </div>
                                )}

                                <div className="p-4 border border-gray-100 bg-gray-50 rounded-xl">
                                    <h3 className="font-semibold text-gray-800 mb-2">Export Backup</h3>
                                    <p className="text-sm text-gray-500 mb-4">Save all school data to your local device</p>
                                    <button
                                        onClick={handleExport}
                                        disabled={processingAction !== null}
                                        className="w-full flex items-center justify-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                                    >
                                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                        Download .sdlx
                                    </button>
                                </div>

                                <div className="col-span-1 md:col-span-2 p-6 border-2 border-green-100 bg-green-50/30 rounded-xl">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="font-bold text-green-800">Quick WhatsApp Share</h3>
                                            <p className="text-sm text-green-600">Instantly share your backup file with colleagues or developers</p>
                                        </div>
                                        <div className="bg-green-100 p-2 rounded-full">
                                            <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 16 16"><path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326z"/></svg>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setIsShareModalOpen(true)}
                                        disabled={processingAction !== null}
                                        className="w-full py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-all shadow-md active:scale-95"
                                    >
                                        Share Platform
                                    </button>
                                </div>
                            </div>

                            {DEV_TOOLS_ENABLED && (
                                <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                                    <button onClick={handleGenerateWpfProject} className="text-indigo-600 hover:text-indigo-800 font-medium text-sm flex items-center justify-center mx-auto">
                                        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
                                        Generate WPF Project Blueprint
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>












            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={handleCancelImport}
                onConfirm={handleConfirmImport}
                title="Confirm Data Import"
                message={`This will overwrite all current data with the contents of '${fileToImport?.name}'. This action cannot be undone.`}
                variant="danger"
                confirmText="Import & Overwrite"
            />
            <ConfirmationModal
                isOpen={isCloudSaveModalOpen}
                onClose={handleCancelCloudSave}
                onConfirm={handleConfirmCloudSave}
                title="Save to Cloud?"
                message="Do you want to save the imported data to the cloud? This will overwrite the current cloud backup for your school."
                variant="info"
                confirmText="Save to Cloud"
            />

            <PasswordScopeModal
                isOpen={isPasswordScopeModalOpen}
                onClose={() => { setIsPasswordScopeModalOpen(false); setIsSavingSchoolPassword(false); }}
                onConfirm={handleConfirmPasswordUpdate}
                termCount={relatedTerms.length}
                currentTermName={settings.academicTerm || 'Current Term'}
            />

            {
                isShareModalOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 animate-fade-in-scale">
                        <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md m-4">
                            <h3 className="text-lg leading-6 font-bold text-gray-900">Share Database via WhatsApp</h3>
                            <p className="text-sm text-gray-600 mt-2">
                                This will download a backup of your database. You'll then be redirected to WhatsApp to send the file.
                            </p>

                            {!showCustomInput ? (
                                <div className="mt-4 space-y-3">
                                    <button
                                        onClick={() => handleShare(WHATSAPP_DEVELOPER_NUMBER)}
                                        className="w-full flex items-center justify-center bg-green-500 text-white px-4 py-3 rounded-lg shadow font-semibold hover:bg-green-600 transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="currentColor" viewBox="0 0 16 16">
                                            <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z" />
                                        </svg>
                                        Send to Developer
                                    </button>
                                    <button
                                        onClick={() => setShowCustomInput(true)}
                                        className="w-full bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 font-semibold"
                                    >
                                        Send to a Custom Number
                                    </button>
                                </div>
                            ) : (
                                <div className="mt-4">
                                    <label className="block text-sm font-medium text-gray-700">Enter WhatsApp Number</label>
                                    <input
                                        type="tel"
                                        placeholder="e.g. 233241234567"
                                        value={customNumber}
                                        onChange={(e) => setCustomNumber(e.target.value.replace(/\D/g, ''))}
                                        className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    <button
                                        onClick={() => handleShare(customNumber)}
                                        disabled={!customNumber.trim()}
                                        className="w-full mt-3 flex items-center justify-center bg-green-500 text-white px-4 py-3 rounded-lg shadow font-semibold hover:bg-green-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                                    >
                                        Share Now
                                    </button>
                                </div>
                            )}

                            <div className="mt-5 sm:mt-4 text-right">
                                <button
                                    type="button"
                                    className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:w-auto sm:text-sm"
                                    onClick={() => {
                                        setIsShareModalOpen(false);
                                        setShowCustomInput(false);
                                        setCustomNumber('');
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {
                isUserManagementOpen && (
                    <AdminSetup
                        mode="management"
                        users={users}
                        currentUser={currentUser}
                        onComplete={(users) => handleUserManagementSave(users, true)} // Complete/Close
                        onUpdate={(users) => handleUserManagementSave(users, false)} // Update/Keep Open
                        onCancel={() => setIsUserManagementOpen(false)}
                        isFetching={isFetching}
                    />
                )
            }
            <MergeUsersModal
                isOpen={isMergeUsersModalOpen}
                onClose={() => setIsMergeUsersModalOpen(false)}
                currentUsers={users}
                onMerge={(merged) => handleUserManagementSave(merged, false)}
                setFeedback={setFeedback}
            />
            <ReadyToShareModal />
        </div >
    );
};

export default DataManagement;