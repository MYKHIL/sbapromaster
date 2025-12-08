import React from 'react';

const MaintenancePage: React.FC = () => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8 md:p-12 text-center">
                {/* Icon */}
                <div className="mb-6 flex justify-center">
                    <div className="relative">
                        <div className="absolute inset-0 bg-blue-400 blur-2xl opacity-30 rounded-full"></div>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-24 w-24 text-blue-600 relative z-10"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                            />
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                        </svg>
                    </div>
                </div>

                {/* Title */}
                <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
                    Under Construction
                </h1>

                {/* Subtitle */}
                <p className="text-xl text-gray-600 mb-8">
                    We're working hard to improve your experience
                </p>

                {/* Message */}
                <div className="bg-blue-50 border-l-4 border-blue-600 p-4 mb-8 rounded-r-lg">
                    <p className="text-gray-700 text-lg">
                        Our team is currently performing essential maintenance and updates.
                        We'll be back shortly with exciting new features!
                    </p>
                </div>

                {/* Call to action */}
                <div className="space-y-4">
                    <p className="text-sm text-gray-500 font-medium">
                        Please check back later
                    </p>

                    <div className="flex items-center justify-center space-x-2 text-blue-600">
                        <svg
                            className="animate-spin h-5 w-5"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                        >
                            <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                            />
                            <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                        </svg>
                        <span className="font-semibold">Updates in progress...</span>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-12 pt-8 border-t border-gray-200">
                    <p className="text-sm text-gray-400">
                        Thank you for your patience
                    </p>
                </div>
            </div>
        </div>
    );
};

export default MaintenancePage;
