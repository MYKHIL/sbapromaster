import React from 'react';
import { WHATSAPP_DEVELOPER_NUMBER } from '../../constants';

interface RegistrationPendingDialogProps {
    schoolName: string;
    onClose: () => void;
    onSubscribe: () => void;
}

const RegistrationPendingDialog: React.FC<RegistrationPendingDialogProps> = ({ schoolName, onClose, onSubscribe }) => {
    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-95 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
                {/* Success Icon */}
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                        <svg
                            className="w-8 h-8 text-green-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                    </div>
                </div>

                {/* Title */}
                <h2 className="text-2xl font-bold text-center text-gray-800 mb-4">
                    Registration Successful!
                </h2>

                {/* School Name */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <p className="text-sm text-gray-600 mb-1">School Registered:</p>
                    <p className="font-semibold text-gray-800">{schoolName}</p>
                </div>

                {/* Message */}
                <div className="mb-6 space-y-3">
                    <p className="text-gray-700 text-center">
                        Your school has been successfully registered!
                    </p>
                    <p className="text-gray-600 text-sm text-center">
                        To activate your account, please contact the administrator on WhatsApp or use the form below to provide payment details.
                    </p>
                </div>

                {/* Subscription Action Button */}
                <button
                    onClick={onSubscribe}
                    className="block w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors text-center mb-3 flex items-center justify-center gap-2 shadow-lg"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    Pay / Subscription Detail
                </button>

                {/* WhatsApp Link */}
                <a
                    href={`https://wa.me/${WHATSAPP_DEVELOPER_NUMBER}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-3 px-4 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors text-center mb-3 flex items-center justify-center gap-2"
                >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.969.585 1.802.891 2.796.891 3.168 0 5.767-2.586 5.767-5.766.001-3.18-2.587-5.767-5.767-5.767zm6.768-6.172c-1.399-1.396-3.791-2.909-7.592-2.909-6.393 0-11.207 4.814-11.207 11.207 0 1.968.511 3.821 1.416 5.39l-1.416 5.174 5.291-1.385c1.455.794 3.125 1.22 4.846 1.22 6.392 0 11.207-4.813 11.207-11.207-.001-3.13-1.15-5.889-2.545-7.49zm-8.293 18.675c-1.579 0-3.125-.429-4.475-1.23l-.321-.191-3.238.847.864-3.155-.213-.338c-.899-1.428-1.373-3.111-1.373-4.872 0-5.02 4.084-9.106 9.106-9.106 2.376.001 4.671.936 6.425 2.686 1.758 1.753 2.766 4.148 2.766 6.643-.001 5.02-4.085 9.106-9.106 9.106z" />
                    </svg>
                    Contact Admin on WhatsApp
                </a>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                >
                    Close
                </button>
            </div>
        </div>
    );
};

export default RegistrationPendingDialog;
