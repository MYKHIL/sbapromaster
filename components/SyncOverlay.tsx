import React from 'react';

interface SyncOverlayProps {
    isVisible: boolean;
}

export const SyncOverlay: React.FC<SyncOverlayProps> = ({ isVisible }) => {
    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm mx-4 text-center">
                {/* Spinning sync icon */}
                <div className="mb-4 flex justify-center">
                    <svg
                        className="animate-spin h-16 w-16 text-blue-600"
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
                </div>

                {/* Message */}
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                    Syncing Data...
                </h3>
                <p className="text-gray-600 mb-4">
                    Please wait while we save your changes to the cloud.
                </p>

                {/* Progress indicator */}
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div className="bg-blue-600 h-full rounded-full animate-pulse" style={{ width: '100%' }} />
                </div>

                <p className="text-sm text-gray-500 mt-4">
                    This will only take a moment
                </p>
            </div>
        </div>
    );
};
