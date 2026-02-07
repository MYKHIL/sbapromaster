import React from 'react';

interface SessionRestoreDialogProps {
    schoolName: string;
    userName: string;
    onContinue: () => void;
    onLogout: () => void;
}

const SessionRestoreDialog: React.FC<SessionRestoreDialogProps> = ({
    schoolName,
    userName,
    onContinue,
    onLogout
}) => {
    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-95 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
                {/* Icon */}
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                        <svg
                            className="w-8 h-8 text-blue-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                        </svg>
                    </div>
                </div>

                {/* Title */}
                <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">
                    Welcome Back!
                </h2>

                {/* Session Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <p className="text-sm text-gray-600 mb-2">Previous Session:</p>
                    <p className="font-semibold text-gray-800">{schoolName}</p>
                    <p className="text-sm text-gray-600">{userName}</p>
                </div>

                {/* Message */}
                <p className="text-center text-gray-600 mb-6">
                    Would you like to continue your previous session or start fresh?
                </p>

                {/* Buttons */}
                <div className="flex flex-col gap-3">
                    <button
                        onClick={onContinue}
                        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-md"
                    >
                        Continue Session
                    </button>
                    <button
                        onClick={onLogout}
                        className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors border-2 border-gray-200"
                    >
                        Logout & Start Fresh
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SessionRestoreDialog;
