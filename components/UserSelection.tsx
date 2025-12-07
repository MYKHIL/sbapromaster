import React, { useState } from 'react';
import type { User } from '../types';

interface UserSelectionProps {
    users: User[];
    onLogin: (userId: number, password: string) => Promise<boolean>;
    onSetPassword: (userId: number, password: string) => Promise<void>;
}

const UserSelection: React.FC<UserSelectionProps> = ({ users, onLogin, onSetPassword }) => {
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const selectedUser = users.find(u => u.id === selectedUserId);
    const isFirstTimeUser = selectedUser && !selectedUser.passwordHash;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!selectedUserId) {
            setError('Please select a user');
            return;
        }

        if (!password) {
            setError('Please enter a password');
            return;
        }

        if (isFirstTimeUser) {
            if (password !== confirmPassword) {
                setError('Passwords do not match');
                return;
            }
            if (password.length < 4) {
                setError('Password must be at least 4 characters');
                return;
            }
        }

        setLoading(true);

        try {
            if (isFirstTimeUser) {
                // Set password for first-time user
                await onSetPassword(selectedUserId, password);
            } else {
                // Login with existing password
                const success = await onLogin(selectedUserId, password);
                if (!success) {
                    setError('Incorrect password');
                    setLoading(false);
                    return;
                }
            }
        } catch (err) {
            setError('An error occurred. Please try again.');
            setLoading(false);
        }
    };

    const handleUserSelect = (userId: number) => {
        setSelectedUserId(userId);
        setPassword('');
        setConfirmPassword('');
        setError(null);
    };

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-95 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-gray-800">Select Your Account</h2>
                    <p className="text-gray-600 mt-2">Please choose your name to continue</p>
                </div>

                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {!selectedUserId ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                        {users.map(user => (
                            <button
                                key={user.id}
                                onClick={() => handleUserSelect(user.id)}
                                className="w-full flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition">
                                        <span className="text-blue-600 font-bold text-lg">
                                            {user.name.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="text-left">
                                        <div className="font-semibold text-gray-800">{user.name}</div>
                                        <div className="text-sm text-gray-500">{user.role}</div>
                                    </div>
                                </div>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                </svg>
                            </button>
                        ))}
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-blue-200 flex items-center justify-center">
                                <span className="text-blue-700 font-bold text-xl">
                                    {selectedUser!.name.charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <div>
                                <div className="font-semibold text-gray-800">{selectedUser!.name}</div>
                                <div className="text-sm text-gray-600">{selectedUser!.role}</div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedUserId(null)}
                                className="ml-auto text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                                Change
                            </button>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {isFirstTimeUser ? 'Set Your Password' : 'Enter Password'}
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                placeholder={isFirstTimeUser ? 'Create password' : 'Enter your password'}
                                required
                            />
                        </div>

                        {isFirstTimeUser && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Confirm Password
                                </label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                    placeholder="Confirm your password"
                                    required
                                />
                            </div>
                        )}

                        {isFirstTimeUser && (
                            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3">
                                <p className="text-xs text-yellow-700">
                                    This is your first time logging in. Please set a password for future logins.
                                </p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ${loading ? 'opacity-70 cursor-not-allowed' : ''
                                }`}
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Processing...
                                </>
                            ) : isFirstTimeUser ? (
                                'Set Password & Login'
                            ) : (
                                'Login'
                            )}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default UserSelection;
