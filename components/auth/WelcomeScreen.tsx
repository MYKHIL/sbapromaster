import React from 'react';
import { APP_VERSION } from '../../constants';

interface WelcomeScreenProps {
    onRegister: () => void;
    onLogin: () => void;
    onSubscribe: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onRegister, onLogin, onSubscribe }) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
            <div className="w-full max-w-md">
                {/* Logo/Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">SBA Pro Master</h1>
                    <p className="text-gray-600">School-Based Assessment Management System</p>
                </div>

                {/* Welcome Card */}
                <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
                    <div className="text-center">
                        <h2 className="text-2xl font-semibold text-gray-800 mb-2">Welcome!</h2>
                        <p className="text-gray-600">Choose an option to get started</p>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-4">
                        {/* Login to Existing School Button */}
                        <button
                            onClick={onLogin}
                            className="w-full bg-white hover:bg-gray-50 text-gray-800 font-semibold py-4 px-6 rounded-xl shadow-lg border-2 border-gray-200 transition-all duration-200 transform hover:scale-105 flex items-center justify-center gap-3"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                            </svg>
                            <span>Login to Existing School</span>
                        </button>

                        {/* Register New School Button */}
                        <button
                            onClick={onRegister}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105 flex items-center justify-center gap-3"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span>Register New School</span>
                        </button>

                        {/* Pay / Subscription Button */}
                        <button
                            onClick={onSubscribe}
                            className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold py-4 px-6 rounded-xl border-2 border-indigo-200 transition-all duration-200 transform hover:scale-105 flex items-center justify-center gap-3"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                            </svg>
                            <span>Pay / Subscription</span>
                        </button>
                    </div>

                    {/* Footer Info */}
                    <div className="pt-4 border-t border-gray-200">
                        <p className="text-xs text-gray-500 text-center">
                            Secure cloud-based school management
                        </p>
                    </div>
                </div>

                {/* Version Info */}
                <div className="text-center mt-6">
                    <p className="text-sm text-gray-500">Version {APP_VERSION}</p>
                </div>
            </div>
        </div>
    );
};

export default WelcomeScreen;
