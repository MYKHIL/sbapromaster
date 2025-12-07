import React, { useState, useEffect } from 'react';
import ConfirmationModal from './ConfirmationModal';
import AdminSetup from './AdminSetup';
import UserSelection from './UserSelection';
import { loginOrRegisterSchool, AppDataType, createDocumentId, searchSchools, updateUsers, updateDeviceCredentials } from '../services/firebaseService';
import { useData } from '../context/DataContext';
import { useUser } from '../context/UserContext';
import { saveDeviceCredential, getDeviceCredential } from '../services/authService';
import { INITIAL_SETTINGS, INITIAL_STUDENTS, INITIAL_SUBJECTS, INITIAL_CLASSES, INITIAL_GRADES, INITIAL_ASSESSMENTS, INITIAL_SCORES, INITIAL_REPORT_DATA, INITIAL_CLASS_DATA } from '../constants';
import type { User, DeviceCredential } from '../types';

type AuthStage = 'school-login' | 'admin-setup' | 'user-selection' | 'authenticated';

interface AuthOverlayProps {
    children?: React.ReactNode;
}

const AuthOverlay: React.FC<AuthOverlayProps> = ({ children }) => {
    const { loadImportedData, setSchoolId } = useData();
    const { setUsers, users, login, setPassword: setUserPassword, checkAutoLogin, isAuthenticated } = useUser();

    // School login state
    const [schoolName, setSchoolName] = useState('');
    const [academicYear, setAcademicYear] = useState('');
    const [academicTerm, setAcademicTerm] = useState('');
    const [schoolPassword, setSchoolPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [accessDenied, setAccessDenied] = useState(false);
    const [showRegisterConfirm, setShowRegisterConfirm] = useState(false);

    // Search suggestions state
    const [schoolSuggestions, setSchoolSuggestions] = useState<string[]>([]);
    const [availableYears, setAvailableYears] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [searchResults, setSearchResults] = useState<{ schoolName: string, years: string[] }[]>([]);

    // Authentication flow state
    const [authStage, setAuthStage] = useState<AuthStage>('school-login');
    const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
    const [schoolData, setSchoolData] = useState<AppDataType | null>(null);

    // Monitor authentication state
    useEffect(() => {
        if (!isAuthenticated && currentSchoolId && authStage === 'authenticated') {
            setAuthStage('user-selection');
        }
    }, [isAuthenticated, currentSchoolId, authStage]);

    const handleSchoolNameChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSchoolName(value);
        setAvailableYears([]);
        setSchoolSuggestions([]);
        setShowSuggestions(false);

        if (value.length >= 3) {
            const results = await searchSchools(value);
            if (results && results.length > 0) {
                const suggestions = results.map(r => r.schoolName);
                setSchoolSuggestions(suggestions);
                setShowSuggestions(true);
                setSearchResults(results);
            }
        }
    };

    const handleSuggestionClick = (suggestion: string) => {
        setSchoolName(suggestion);
        const match = searchResults.find(r => r.schoolName === suggestion);
        if (match) {
            setAvailableYears(match.years);
        }
        setShowSuggestions(false);
    };

    const handleSchoolLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!schoolName || !academicYear || !academicTerm || !schoolPassword) {
            setError("Please fill in all fields.");
            return;
        }

        setLoading(true);
        setError(null);
        setAccessDenied(false);

        const sanitizedSchoolName = schoolName.replace(/\//g, '');
        const sanitizedAcademicYear = academicYear.replace(/\//g, '');
        const combinedId = createDocumentId(sanitizedSchoolName, sanitizedAcademicYear, academicTerm);

        const initialData: AppDataType = {
            settings: {
                ...INITIAL_SETTINGS,
                schoolName: schoolName,
                academicYear: academicYear,
                academicTerm: academicTerm
            },
            students: INITIAL_STUDENTS,
            subjects: INITIAL_SUBJECTS,
            classes: INITIAL_CLASSES,
            grades: INITIAL_GRADES,
            assessments: INITIAL_ASSESSMENTS,
            scores: INITIAL_SCORES,
            reportData: INITIAL_REPORT_DATA,
            classData: INITIAL_CLASS_DATA,
            users: [],
            deviceCredentials: [],
        };

        const result = await loginOrRegisterSchool(combinedId, schoolPassword, initialData, false);
        setLoading(false);

        if (result.status === 'success') {
            const docId = result.docId;
            setSchoolId(docId);
            setCurrentSchoolId(docId);
            loadImportedData(result.data);
            setSchoolData(result.data);

            // Check if users exist
            const users = result.data.users || [];
            setUsers(users);

            if (users.length === 0) {
                // No users, show admin setup
                setAuthStage('admin-setup');
            } else {
                // Users exist, check for auto-login
                const autoLoginUser = await checkAutoLogin(docId, users);
                if (autoLoginUser) {
                    // Auto-login successful
                    setAuthStage('authenticated');
                } else {
                    // Show user selection
                    setAuthStage('user-selection');
                }
            }
        } else if (result.status === 'access_denied' || result.status === 'created_pending_access') {
            setAccessDenied(true);
        } else if (result.status === 'wrong_password') {
            setError("Incorrect password for this school/term combination.");
        } else if (result.status === 'not_found') {
            setShowRegisterConfirm(true);
        } else if (result.status === 'error') {
            setError(result.message || "An error occurred.");
        }
    };

    const handleRegisterConfirm = async () => {
        setShowRegisterConfirm(false);
        setLoading(true);

        const sanitizedSchoolName = schoolName.replace(/\//g, '');
        const sanitizedAcademicYear = academicYear.replace(/\//g, '');
        const combinedId = createDocumentId(sanitizedSchoolName, sanitizedAcademicYear, academicTerm);

        const initialData: AppDataType = {
            settings: {
                ...INITIAL_SETTINGS,
                schoolName: schoolName,
                academicYear: academicYear,
                academicTerm: academicTerm
            },
            students: INITIAL_STUDENTS,
            subjects: INITIAL_SUBJECTS,
            classes: INITIAL_CLASSES,
            grades: INITIAL_GRADES,
            assessments: INITIAL_ASSESSMENTS,
            scores: INITIAL_SCORES,
            reportData: INITIAL_REPORT_DATA,
            classData: INITIAL_CLASS_DATA,
            users: [],
            deviceCredentials: [],
        };

        const result = await loginOrRegisterSchool(combinedId, schoolPassword, initialData, true);
        setLoading(false);

        if (result.status === 'created_pending_access') {
            setAccessDenied(true);
        } else if (result.status === 'error') {
            setError(result.message || "An error occurred.");
        }
    };

    const handleAdminSetupComplete = async (users: User[], adminPassword?: string) => {
        if (!currentSchoolId || !schoolData) return;

        try {
            // Update users in Firebase
            await updateUsers(currentSchoolId, users);

            // Update local state
            setUsers(users);

            // Auto-login the admin user
            if (adminPassword && users.length > 0) {
                const adminUser = users[0];
                const success = await login(adminUser.id, adminPassword);

                if (success) {
                    // Save device credential
                    saveDeviceCredential(currentSchoolId, adminUser.id);
                    setAuthStage('authenticated');
                }
            }
        } catch (err) {
            console.error('Failed to complete admin setup:', err);
            setError('Failed to save users. Please try again.');
        }
    };

    const handleUserLogin = async (userId: number, password: string): Promise<boolean> => {
        const success = await login(userId, password);

        if (success && currentSchoolId) {
            // Save device credential
            saveDeviceCredential(currentSchoolId, userId);
            setAuthStage('authenticated');
            return true;
        }

        return false;
    };

    const handleUserSetPassword = async (userId: number, password: string): Promise<void> => {
        if (!currentSchoolId) return;

        await setUserPassword(userId, password);

        // Update in Firebase
        const users = schoolData?.users || [];
        const updatedUsers = users.map(u =>
            u.id === userId ? { ...u, passwordHash: password } : u
        );
        await updateUsers(currentSchoolId, updatedUsers);

        // Save device credential
        saveDeviceCredential(currentSchoolId, userId);
        setAuthStage('authenticated');
    };

    if (authStage === 'authenticated') {
        return <>{children}</>;
    }

    if (authStage === 'admin-setup') {
        return (
            <AdminSetup
                mode="setup"
                users={[]}
                onComplete={handleAdminSetupComplete}
            />
        );
    }

    if (authStage === 'user-selection' && schoolData) {
        return (
            <UserSelection
                users={users.length > 0 ? users : (schoolData.users || [])}
                onLogin={handleUserLogin}
                onSetPassword={handleUserSetPassword}
            />
        );
    }

    // School login screen
    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-95 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-gray-800">SBA Pro Master</h2>
                    <p className="text-gray-600 mt-2">School Database Login</p>
                </div>

                {accessDenied ? (
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-yellow-700">
                                    Access Denied. Please contact the administrator on <a href="tel:0542410613" className="font-bold underline hover:text-yellow-800">0542410613</a> for access.
                                </p>
                                <button
                                    onClick={() => setAccessDenied(false)}
                                    className="mt-2 text-sm text-yellow-700 underline hover:text-yellow-600"
                                >
                                    Back to Login
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSchoolLogin} className="space-y-4">
                        {error && (
                            <div className="bg-red-50 border-l-4 border-red-500 p-4 text-sm text-red-700">
                                {error}
                            </div>
                        )}

                        <div className="relative">
                            <label className="block text-sm font-medium text-gray-700 mb-1">School Name</label>
                            <input
                                type="text"
                                value={schoolName}
                                onChange={handleSchoolNameChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                placeholder="e.g. St. Mary's School"
                                required
                            />
                            {showSuggestions && schoolSuggestions.length > 0 && (
                                <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto mt-1">
                                    {schoolSuggestions.map((suggestion, index) => (
                                        <li
                                            key={index}
                                            className="px-4 py-2 hover:bg-blue-100 cursor-pointer text-sm text-gray-700"
                                            onClick={() => handleSuggestionClick(suggestion)}
                                        >
                                            {suggestion}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {availableYears.length > 0 && (
                                <p className="text-xs text-green-600 mt-1">
                                    Found existing school records. Select a year below or type a new one.
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={academicYear}
                                        onChange={(e) => setAcademicYear(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                        placeholder="e.g. 2023/2024"
                                        required
                                        list="available-years"
                                    />
                                    <datalist id="available-years">
                                        {availableYears.map((year) => (
                                            <option key={year} value={year} />
                                        ))}
                                    </datalist>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Academic Term</label>
                                <select
                                    value={academicTerm}
                                    onChange={(e) => setAcademicTerm(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                    required
                                >
                                    <option value="">Select Term</option>
                                    <option value="First Term">First Term</option>
                                    <option value="Second Term">Second Term</option>
                                    <option value="Third Term">Third Term</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                            <input
                                type="password"
                                value={schoolPassword}
                                onChange={(e) => setSchoolPassword(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                placeholder="Enter password"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Processing...
                                </>
                            ) : (
                                'Login / Register'
                            )}
                        </button>
                    </form>
                )}
            </div>

            <ConfirmationModal
                isOpen={showRegisterConfirm}
                onClose={() => setShowRegisterConfirm(false)}
                onConfirm={handleRegisterConfirm}
                title="No Existing Database Found"
                message={
                    <span>
                        No existing database found for these credentials. Would you like to register? <br /> <br />
                        <span className="font-bold underline bg-yellow-200 px-1 rounded">Note:</span> <br />
                        You will need to contact the administrator on <a href="tel:0542410613" className="font-bold underline text-blue-600 hover:text-blue-800">0542410613</a> for access.
                    </span>
                }
                variant="info"
                confirmText="Register"
            />
        </div>
    );
};

export default AuthOverlay;
