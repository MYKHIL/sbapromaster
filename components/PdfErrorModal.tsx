import React from 'react';
import { DEVELOPER_PHONE, formatPhoneNumber } from '../utils/databaseErrorHandler';

interface PdfErrorModalProps {
    error: any;
    onClose: () => void;
    isOpen: boolean;
}

const PdfErrorModal: React.FC<PdfErrorModalProps> = ({ error, onClose, isOpen }) => {
    if (!isOpen || !error) return null;

    const errorMessage = error?.message || error?.toString() || 'Unknown PDF generation error';
    const errorStack = error?.stack || '';

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black bg-opacity-60 animate-fadeIn">
            <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-slideUp">
                {/* Header */}
                <div className="p-6 bg-orange-600 text-white rounded-t-lg">
                    <div className="flex items-center gap-3">
                        <svg
                            className="w-8 h-8 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                        <div>
                            <h2 className="text-xl font-bold">PDF Download Failed</h2>
                            <p className="text-sm opacity-90 mt-1">Unable to generate report PDF</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {/* Main Message */}
                    <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded">
                        <p className="text-gray-800 font-semibold mb-2">
                            ⚠️ Your browser encountered an error while trying to download the PDF report.
                        </p>
                        <p className="text-gray-700 text-sm">
                            This could be due to browser limitations or security settings preventing PDF generation.
                        </p>
                    </div>

                    {/* Error Details */}
                    <div className="bg-gray-50 p-4 rounded border border-gray-200">
                        <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Technical Error Details:
                        </h3>
                        <div className="space-y-2 text-sm">
                            <p className="text-gray-700 break-words">
                                <span className="font-semibold">Error Message:</span>
                                <span className="ml-2 text-gray-800 font-mono text-xs bg-red-50 px-2 py-1 rounded border border-red-200">
                                    {errorMessage}
                                </span>
                            </p>
                            {errorStack && (
                                <details className="mt-2">
                                    <summary className="cursor-pointer text-blue-600 hover:text-blue-800 font-semibold">
                                        View Full Error Stack
                                    </summary>
                                    <pre className="mt-2 p-2 bg-gray-100 text-xs overflow-x-auto rounded border border-gray-300">
                                        {errorStack}
                                    </pre>
                                </details>
                            )}
                        </div>
                    </div>

                    {/* What to do */}
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                        <h3 className="font-semibold text-blue-900 mb-2">💡 What You Can Do:</h3>
                        <ul className="text-blue-800 text-sm space-y-1 ml-4 list-disc">
                            <li>Try using <strong>Google Chrome</strong> browser (recommended)</li>
                            <li>Check your browser's pop-up and download settings</li>
                            <li>Try refreshing the page and generating the PDF again</li>
                            <li>If the problem persists, contact the developer</li>
                        </ul>
                    </div>

                    {/* Contact Developer */}
                    <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                        <h3 className="font-semibold text-green-900 mb-2">📞 Need Help?</h3>
                        <p className="text-green-800 text-sm mb-2">
                            If this error continues, please contact the developer:
                        </p>
                        <p className="font-bold text-green-900 text-lg">
                            {formatPhoneNumber(DEVELOPER_PHONE)}
                        </p>
                        <p className="text-xs text-green-700 mt-2">
                            Please share the error message above when contacting support.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
                    <button
                        onClick={onClose}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
                    >
                        ✓ Close and Continue Working
                    </button>
                    <p className="text-xs text-gray-600 text-center mt-2">
                        You can continue using the application normally
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PdfErrorModal;
