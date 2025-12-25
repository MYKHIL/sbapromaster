import React, { useState } from 'react';
import { createDocumentId, clearAuthCaches } from '../../services/firebaseService';
import { INITIAL_SETTINGS } from '../../constants';

interface RegistrationFormProps {
    onRegister: (schoolName: string, year: string, term: string, password: string, docId: string) => void;
    onBack: () => void;
}

const RegistrationForm: React.FC<RegistrationFormProps> = ({ onRegister, onBack }) => {
    const [schoolName, setSchoolName] = useState('');
    const [academicYear, setAcademicYear] = useState('');
    const [academicTerm, setAcademicTerm] = useState('First Term');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validation
        if (!schoolName.trim()) {
            setError('Please enter a school name');
            return;
        }
        if (!academicYear.trim()) {
            setError('Please enter an academic year');
            return;
        }
        if (!password) {
            setError('Please enter a password');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (password.length < 4) {
            setError('Password must be at least 4 characters');
            return;
        }

        try {
            setLoading(true);

            // Create document ID
            const docId = createDocumentId(schoolName, academicYear, academicTerm);

            // Clear auth caches since we're adding a new school
            clearAuthCaches();

            // Call parent handler
            onRegister(schoolName, academicYear, academicTerm, password, docId);
        } catch (err) {
            console.error('Registration error:', err);
            setError('Failed to register school. Please try again.');
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Register New School</h1>
                    <p className="text-gray-600">Create your school account</p>

                    {/* DEBUG AUTOMATION */}
                    {/* @ts-ignore - DEV and VITE_USE_EMULATOR exist in Vite env */}
                    {(import.meta.env.DEV || import.meta.env.VITE_USE_EMULATOR === 'true') && (
                        <button
                            type="button"
                            onClick={() => {
                                const name = "Dummy School";
                                const year = "2024-2025";
                                const term = "First Term";
                                const pass = "password";
                                // const docId = createDocumentId(name, year, term); // Use import
                                // We need to generate ID manually or call helper. Helper is imported.
                                // But createDocumentId is imported at line 2.
                                const docId = createDocumentId(name, year, term);
                                onRegister(name, year, term, pass, docId);
                            }}
                            className="mt-2 bg-purple-100 text-purple-700 px-3 py-1 rounded text-xs font-mono hover:bg-purple-200"
                        >
                            [DEBUG] Auto Register Dummy School
                        </button>
                    )}
                </div>

                {/* Main Card */}
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* School Name */}
                        <div>
                            <label htmlFor="schoolName" className="block text-sm font-medium text-gray-700 mb-2">
                                School Name *
                            </label>
                            <input
                                id="schoolName"
                                type="text"
                                value={schoolName}
                                onChange={(e) => setSchoolName(e.target.value)}
                                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                                placeholder="e.g., Ayirebi D/A Basic School 'B'"
                                disabled={loading}
                                autoFocus
                            />
                        </div>

                        {/* Academic Year */}
                        <div>
                            <label htmlFor="academicYear" className="block text-sm font-medium text-gray-700 mb-2">
                                Academic Year *
                            </label>
                            <input
                                id="academicYear"
                                type="text"
                                value={academicYear}
                                onChange={(e) => setAcademicYear(e.target.value)}
                                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                                placeholder="e.g., 2024-2025"
                                disabled={loading}
                            />
                        </div>

                        {/* Academic Term */}
                        <div>
                            <label htmlFor="academicTerm" className="block text-sm font-medium text-gray-700 mb-2">
                                Academic Term *
                            </label>
                            <select
                                id="academicTerm"
                                value={academicTerm}
                                onChange={(e) => setAcademicTerm(e.target.value)}
                                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                                disabled={loading}
                            >
                                <option value="First Term">First Term</option>
                                <option value="Second Term">Second Term</option>
                                <option value="Third Term">Third Term</option>
                            </select>
                        </div>

                        {/* Password */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                                Password *
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                                    placeholder="Enter password"
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    tabIndex={-1}
                                >
                                    {showPassword ? (
                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    ) : (
                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                                Confirm Password *
                            </label>
                            <input
                                id="confirmPassword"
                                type={showPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                                placeholder="Confirm password"
                                disabled={loading}
                            />
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                                <p className="text-red-600 text-sm">{error}</p>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    <span>Registering...</span>
                                </>
                            ) : (
                                <>
                                    <span>Register School</span>
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </>
                            )}
                        </button>

                        {/* Back Button */}
                        <button
                            type="button"
                            onClick={onBack}
                            disabled={loading}
                            className="w-full bg-gray-100 hover:bg-gray-200 disabled:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            <span>Back</span>
                        </button>
                    </form>
                </div>

                {/* Info Note */}
                <div className="text-center mt-6">
                    <p className="text-xs text-gray-500">
                        All fields marked with * are required
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RegistrationForm;
