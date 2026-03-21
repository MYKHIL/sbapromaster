import React from 'react';
import { WHATSAPP_DEVELOPER_NUMBER } from '../../constants';

interface SubscriptionExpiredDialogProps {
    schoolName: string;
    onClose: () => void;
    onReactivate: () => void;
}

const SubscriptionExpiredDialog: React.FC<SubscriptionExpiredDialogProps> = ({ schoolName, onClose, onReactivate }) => {
    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-95 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full border-t-4 border-amber-500">
                {/* Expired Icon */}
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                        <svg
                            className="w-8 h-8 text-amber-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                    </div>
                </div>

                {/* Title */}
                <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">
                    License Expired
                </h2>
                <p className="text-center text-gray-500 text-sm mb-6">Access restricted for this school</p>

                {/* School Name */}
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 mb-6">
                    <p className="text-xs text-amber-700 uppercase tracking-wider font-bold mb-1">Target School:</p>
                    <p className="font-semibold text-gray-800 text-lg">{schoolName}</p>
                </div>

                {/* Message */}
                <div className="mb-6 space-y-3">
                    <p className="text-gray-700 text-center">
                        The subscription for this school has expired and needs to be renewed to continue accessing its records.
                    </p>
                    <p className="text-gray-600 text-sm text-center">
                        All your data is safe; you just need to reactivate the terminal license.
                    </p>
                </div>

                {/* Reactivate Action Button */}
                <button
                    onClick={onReactivate}
                    className="block w-full py-4 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] text-center mb-3 flex items-center justify-center gap-2 shadow-lg shadow-amber-200"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    Reactivate License Now
                </button>

                {/* WhatsApp Link (Optional) */}
                <a
                    href={`https://wa.me/${WHATSAPP_DEVELOPER_NUMBER}?text=My school license for ${encodeURIComponent(schoolName)} has expired. I need help reactivating it.`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-3 px-4 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors text-center mb-4 flex items-center justify-center gap-2"
                >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.969.585 1.802.891 2.796.891 3.168 0 5.767-2.586 5.767-5.766.001-3.18-2.587-5.767-5.767-5.767zm6.768-6.172c-1.399-1.396-3.791-2.909-7.592-2.909-6.393 0-11.207 4.814-11.207 11.207 0 1.968.511 3.821 1.416 5.39l-1.416 5.174 5.291-1.385c1.455.794 3.125 1.22 4.846 1.22 6.392 0 11.207-4.813 11.207-11.207-.001-3.13-1.15-5.889-2.545-7.49zm-8.293 18.675c-1.579 0-3.125-.429-4.475-1.23l-.321-.191-3.238.847.864-3.155-.213-.338c-.899-1.428-1.373-3.111-1.373-4.872 0-5.02 4.084-9.106 9.106-9.106 2.376.001 4.671.936 6.425 2.686 1.758 1.753 2.766 4.148 2.766 6.643-.001 5.02-4.085 9.106-9.106 9.106z" />
                    </svg>
                    Contact Support
                </a>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="w-full py-2 text-gray-500 hover:text-gray-700 font-medium transition-colors text-sm"
                >
                    Cancel and Go Back
                </button>
            </div>
        </div>
    );
};

export default SubscriptionExpiredDialog;
