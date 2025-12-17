import React from 'react';
import {
    createWhatsAppErrorLink,
    getDatabaseErrorInfo,
    isQuotaExhaustedError
} from '../utils/databaseErrorHandler';

interface DatabaseErrorModalProps {
    error: any;
    onClose: () => void;
    isOpen: boolean;
}

const DatabaseErrorModal: React.FC<DatabaseErrorModalProps> = ({ error, onClose, isOpen }) => {
    if (!isOpen || !error) return null;

    const errorInfo = getDatabaseErrorInfo(error);
    const whatsappLink = createWhatsAppErrorLink(error);
    const isQuotaError = isQuotaExhaustedError(error);

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black bg-opacity-40 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden animate-slideUp">
                {/* Minimal Header */}
                <div className={`${isQuotaError ? 'bg-amber-100' : 'bg-red-50'} p-4 border-b ${isQuotaError ? 'border-amber-200' : 'border-red-100'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${isQuotaError ? 'bg-amber-200 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {isQuotaError ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                )}
                            </svg>
                        </div>
                        <div>
                            <h3 className={`font-bold ${isQuotaError ? 'text-amber-800' : 'text-red-800'}`}>
                                {isQuotaError ? 'System Busy' : 'System Error'}
                            </h3>
                        </div>
                    </div>
                </div>

                {/* Friendly Content */}
                <div className="p-6">
                    <p className="text-gray-700 text-sm leading-relaxed mb-6">
                        {errorInfo.friendlyMessage}
                    </p>

                    <div className="flex flex-col gap-3">
                        {/* Primary Action: WhatsApp */}
                        <a
                            href={whatsappLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors shadow-sm"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                            Contact Developer
                        </a>

                        {/* Secondary Action: Close */}
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-gray-700 text-sm font-medium py-2 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DatabaseErrorModal;
