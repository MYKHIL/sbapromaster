import React from 'react';
import type { OnlineUser } from '../types';

interface OnlineUsersModalProps {
    isOpen: boolean;
    onClose: () => void;
    onlineUsers: OnlineUser[];
}

const OnlineUsersModal: React.FC<OnlineUsersModalProps> = ({ isOpen, onClose, onlineUsers }) => {
    if (!isOpen) return null;

    const formatLastActive = (isoString: string) => {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMinutes = Math.floor(diffMs / 60000);

        if (diffMinutes < 1) return 'Just now';
        if (diffMinutes === 1) return '1 minute ago';
        if (diffMinutes < 60) return `${diffMinutes} minutes ago`;

        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours === 1) return '1 hour ago';
        return `${diffHours} hours ago`;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-800">Online Users ({onlineUsers.length})</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition"
                        aria-label="Close"
                    >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {onlineUsers.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No users currently online.</p>
                ) : (
                    <div className="space-y-3">
                        {onlineUsers.map((user) => (
                            <div
                                key={user.userId}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition"
                            >
                                <div className="flex items-center gap-3">
                                    {/* User Avatar/Icon */}
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${user.role === 'Admin' ? 'bg-purple-500' :
                                            user.role === 'Teacher' ? 'bg-blue-500' :
                                                'bg-gray-500'
                                        }`}>
                                        {user.userName.charAt(0).toUpperCase()}
                                    </div>

                                    {/* User Info */}
                                    <div>
                                        <p className="font-semibold text-gray-800">{user.userName}</p>
                                        <p className="text-xs text-gray-500">{user.role}</p>
                                    </div>
                                </div>

                                {/* Last Active */}
                                <div className="text-right">
                                    <div className="flex items-center gap-1">
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                        <span className="text-xs text-gray-600">Active</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">{formatLastActive(user.lastActive)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default OnlineUsersModal;
