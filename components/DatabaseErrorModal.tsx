import React, { useState } from 'react';
import {
    isQuotaExhaustedError,
    createWhatsAppErrorLink,
    getDatabaseErrorInfo,
    DEVELOPER_PHONE,
    formatPhoneNumber
} from '../utils/databaseErrorHandler';

interface DatabaseErrorModalProps {
    error: any;
    onClose: () => void;
    isOpen: boolean;
}

const DatabaseErrorModal: React.FC<DatabaseErrorModalProps> = ({ error, onClose, isOpen }) => {
    const [acknowledged, setAcknowledged] = useState(false);

    if (!isOpen || !error) return null;

    const errorInfo = getDatabaseErrorInfo(error);
    const isQuotaError = isQuotaExhaustedError(error);
    const whatsappLink = createWhatsAppErrorLink(error);

    // Prevent closing modal by clicking backdrop
    const handleBackdropClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        // Do nothing - modal is blocking
    };

    const handleClose = () => {
        if (acknowledged) {
            setAcknowledged(false); // Reset for next time
            onClose();
        }
    };

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black bg-opacity-70 animate-fadeIn backdrop-blur-sm"
            onClick={handleBackdropClick}
        >
            <div
                className="bg-white rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-slideUp ring-4 ring-red-500"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header with pulsing border */}
                <div className={`p-6 ${isQuotaError ? 'bg-red-600' : 'bg-orange-600'} text-white rounded-t-lg relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-white opacity-10 animate-pulse"></div>
                    <div className="flex items-center gap-3 relative z-10">
                        <svg
                            className="w-10 h-10 flex-shrink-0 animate-pulse"
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
                            <h2 className="text-xl font-bold">
                                {isQuotaError ? '🚨 CRITICAL: Database Quota Exhausted' : '❌ CRITICAL: Database Error'}
                            </h2>
                            <p className="text-sm opacity-90 mt-1">Action Required - Application Blocked</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {/* Main Message */}
                    <div className="bg-red-100 border-2 border-red-500 p-4 rounded-lg">
                        <p className="text-red-900 font-bold mb-2 text-lg">
                            {isQuotaError
                                ? '🚫 DATABASE QUOTA EXHAUSTED'
                                : '⚠️ CRITICAL DATABASE ERROR'}
                        </p>
                        <p className="text-red-800 font-semibold mb-2">
                            {isQuotaError
                                ? 'The database quota has been exhausted. ALL data operations are currently blocked.'
                                : 'A critical database error has occurred. Data operations may fail.'}
                        </p>
                        <p className="text-red-700 text-sm">
                            ⛔ <strong>You cannot use the application until this issue is resolved.</strong>
                        </p>
                        <p className="text-red-700 text-sm mt-2">
                            📞 <strong>You MUST contact the developer immediately.</strong>
                        </p>
                    </div>

                    {/* Error Details */}
                    <div className="bg-gray-100 p-4 rounded-lg border-2 border-gray-300">
                        <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Technical Error Details:
                        </h3>
                        <div className="space-y-2 text-sm">
                            <p className="text-gray-700">
                                <span className="font-semibold">Error Code:</span>
                                <code className="ml-2 bg-red-100 px-2 py-1 rounded text-red-700 font-mono text-xs border border-red-300">
                                    {errorInfo.code}
                                </code>
                            </p>
                            <p className="text-gray-700 break-words">
                                <span className="font-semibold">Error Message:</span>
                                <span className="ml-2 text-gray-800 font-mono text-xs bg-gray-200 px-2 py-1 rounded">
                                    {errorInfo.message}
                                </span>
                            </p>
                            <p className="text-gray-600 text-xs mt-2">
                                ⏰ <strong>Time:</strong> {new Date().toLocaleString()}
                            </p>
                        </div>
                    </div>

                    {/* Action Required - MORE PROMINENT */}
                    <div className="bg-gradient-to-r from-blue-50 to-green-50 border-2 border-blue-500 p-5 rounded-lg shadow-lg">
                        <h3 className="font-bold text-blue-900 mb-2 text-lg flex items-center gap-2">
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                            📞 CONTACT DEVELOPER NOW
                        </h3>
                        <p className="text-blue-800 font-semibold mb-3">
                            Contact the developer immediately to resolve this critical issue:
                        </p>
                        <div className="bg-white p-3 rounded-lg border-2 border-blue-300 mb-3">
                            <p className="text-xs text-gray-600 mb-1">Developer Phone Number:</p>
                            <p className="font-bold text-blue-900 text-2xl tracking-wide">
                                {formatPhoneNumber(DEVELOPER_PHONE)}
                            </p>
                        </div>

                        {/* WhatsApp Button - MORE PROMINENT */}
                        <a
                            href={whatsappLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-3 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 mb-2"
                        >
                            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                            <span className="text-lg">📱 SEND ERROR REPORT VIA WHATSAPP</span>
                        </a>
                        <p className="text-xs text-green-800 text-center font-semibold">
                            ✅ Fastest way to get help - opens WhatsApp with error details
                        </p>
                    </div>

                    {/* Acknowledgment Section - REQUIRED TO CLOSE */}
                    <div className="bg-yellow-50 border-2 border-yellow-400 p-4 rounded-lg">
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={acknowledged}
                                onChange={(e) => setAcknowledged(e.target.checked)}
                                className="mt-1 w-5 h-5 text-blue-600 border-2 border-gray-400 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            />
                            <div className="flex-1">
                                <p className="text-yellow-900 font-semibold text-sm">
                                    ✋ I understand this is a critical error and I will contact the developer immediately.
                                </p>
                                <p className="text-yellow-800 text-xs mt-1">
                                    You must check this box to close this message.
                                </p>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Footer - Only allow close if acknowledged */}
                <div className="p-4 bg-gray-100 border-t-2 border-gray-300 rounded-b-lg">
                    <button
                        onClick={handleClose}
                        disabled={!acknowledged}
                        className={`w-full font-bold py-3 px-4 rounded-lg transition-all duration-200 ${acknowledged
                            ? 'bg-gray-700 hover:bg-gray-800 text-white cursor-pointer shadow-md hover:shadow-lg'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        {acknowledged ? '✓ I Understand - Close Message' : '⚠️ Please Acknowledge Above'}
                    </button>
                    {!acknowledged && (
                        <p className="text-xs text-red-600 text-center mt-2 font-semibold">
                            ⚠️ You must acknowledge the error before closing this message
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DatabaseErrorModal;
