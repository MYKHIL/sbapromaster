import React from 'react';

/**
 * Premium MessageBox Component
 * Provides high-quality, animated alerts and confirmations with consistent branding.
 */

interface MessageBoxProps {
    isOpen: boolean;
    title: string;
    message: string | React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel?: () => void;
    variant?: 'info' | 'success' | 'warning' | 'danger';
    hideCancel?: boolean;
}

const MessageBox: React.FC<MessageBoxProps> = ({
    isOpen,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
    onCancel,
    variant = 'info',
    hideCancel = false
}) => {
    if (!isOpen) return null;

    const theme = {
        info: {
            iconBg: 'bg-blue-50',
            iconColor: 'text-blue-600',
            buttonBg: 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30',
            iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
        },
        success: {
            iconBg: 'bg-green-50',
            iconColor: 'text-green-600',
            buttonBg: 'bg-green-600 hover:bg-green-700 shadow-green-500/30',
            iconPath: 'M5 13l4 4L19 7'
        },
        warning: {
            iconBg: 'bg-amber-50',
            iconColor: 'text-amber-600',
            buttonBg: 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/30',
            iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
        },
        danger: {
            iconBg: 'bg-red-50',
            iconColor: 'text-red-600',
            buttonBg: 'bg-red-600 hover:bg-red-700 shadow-red-500/30',
            iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
        }
    }[variant];

    return (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm shadow-2xl flex items-center justify-center z-[110] p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[2rem] shadow-2xl p-8 md:p-10 max-w-lg w-full border border-gray-100 animate-in zoom-in duration-300">
                <div className={`w-20 h-20 ${theme.iconBg} ${theme.iconColor} rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner`}>
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path d={theme.iconPath} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>

                <h2 className="text-3xl font-black text-center mb-4 tracking-tight text-gray-900 border-none outline-none">
                    {title}
                </h2>

                <div className="text-gray-500 mb-10 font-medium text-center leading-relaxed whitespace-pre-line">
                    {message}
                </div>

                <div className="flex gap-4">
                    {!hideCancel && (
                        <button
                            onClick={onCancel}
                            className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-all active:scale-95"
                        >
                            {cancelText}
                        </button>
                    )}
                    <button
                        onClick={onConfirm}
                        className={`flex-1 py-4 ${theme.buttonBg} text-white font-black rounded-2xl transition-all shadow-lg active:scale-95`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MessageBox;
