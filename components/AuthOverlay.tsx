import React, { useState } from 'react';
import { loginOrRegisterSchool, AppDataType } from '../services/firebaseService';
import { useData } from '../context/DataContext';
import { INITIAL_SETTINGS, INITIAL_STUDENTS, INITIAL_SUBJECTS, INITIAL_CLASSES, INITIAL_GRADES, INITIAL_ASSESSMENTS, INITIAL_SCORES, INITIAL_REPORT_DATA, INITIAL_CLASS_DATA } from '../constants';

const AuthOverlay: React.FC = () => {
    const { loadImportedData, setSchoolId } = useData();
    const [schoolName, setSchoolName] = useState('');
    const [academicYear, setAcademicYear] = useState('');
    const [academicTerm, setAcademicTerm] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [accessDenied, setAccessDenied] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!schoolName || !academicYear || !academicTerm || !password) {
            setError("Please fill in all fields.");
            return;
        }

        setLoading(true);
        setError(null);
        setAccessDenied(false);

        // Combine school name, academic year, and term to create unique document ID
        const combinedId = `${schoolName}_${academicYear}_${academicTerm}`;

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
            // password and Access are handled by the service
        };

        const result = await loginOrRegisterSchool(combinedId, password, initialData);

        setLoading(false);

        if (result.status === 'success') {
            setSchoolId(combinedId); // Store the combined ID for future saves
            loadImportedData(result.data);
            setIsLoggedIn(true);
        } else if (result.status === 'access_denied' || result.status === 'created_pending_access') {
            setAccessDenied(true);
        } else if (result.status === 'wrong_password') {
            setError("Incorrect password for this school/term combination.");
        } else if (result.status === 'error') {
            setError(result.message || "An error occurred.");
        }
    };

    if (isLoggedIn) {
        return null;
    }

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
                                    Access Denied. Please contact the administrator on <span className="font-bold">0542410613</span> for access.
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
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="bg-red-50 border-l-4 border-red-500 p-4 text-sm text-red-700">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">School Name</label>
                            <input
                                type="text"
                                value={schoolName}
                                onChange={(e) => setSchoolName(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                placeholder="e.g. St. Mary's School"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
                                <input
                                    type="text"
                                    value={academicYear}
                                    onChange={(e) => setAcademicYear(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                    placeholder="e.g. 2023/2024"
                                    required
                                />
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
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
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
        </div>
    );
};

export default AuthOverlay;
