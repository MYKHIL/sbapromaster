import React from 'react';

interface RegistrationPendingDialogProps {
    schoolName: string;
    onClose: () => void;
}

const RegistrationPendingDialog: React.FC<RegistrationPendingDialogProps> = ({ schoolName, onClose }) => {
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
                        To activate your account, please contact the administrator and complete the payment process.
                    </p>
                </div>

                {/* Pricing Link */}
                <a
                    href="https://mykhil.github.io/pricingpage.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-center mb-4"
                >
                    View Pricing Details
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
