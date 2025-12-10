import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { useData } from '../context/DataContext';
import ConfirmationModal from './ConfirmationModal';
import { NetworkIndicator } from './NetworkIndicator';
import OnlineUsersModal from './OnlineUsersModal';

const UserBadge: React.FC = () => {
    const { currentUser, logout } = useUser();

    // Early return BEFORE other hooks to avoid React error #300
    // This ensures consistent hook call order across all renders
    if (!currentUser) return null;

    const { isOnline, isSyncing, queuedCount, onlineUsers, settings } = useData();
    const [showConfirm, setShowConfirm] = useState(false);
    const [showOnlineUsers, setShowOnlineUsers] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true);

    const handleSwitchUser = () => {
        logout();
    };

    const getRoleColor = (role: string) => {
        switch (role) {
            case 'Admin':
                return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'Teacher':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'Guest':
                return 'bg-gray-100 text-gray-800 border-gray-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    // Extract initials from name
    const getInitials = (name: string): string => {
        const words = name.trim().split(' ').filter(word => word.length > 0);
        if (words.length === 0) return 'U';
        if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
        return words.slice(0, 2).map(word => word[0].toUpperCase()).join('');
    };

    const isLocked = settings?.isDataEntryLocked;
    const isAdmin = currentUser.role === 'Admin';

    // Auto-collapse after 10 seconds when expanded
    useEffect(() => {
        if (isExpanded) {
            const timer = setTimeout(() => {
                setIsExpanded(false);
            }, 10000); // 10 seconds

            return () => clearTimeout(timer);
        }
    }, [isExpanded]);

    return (
        <>
            <div className="fixed top-6 right-4 z-[60]">
                {/* User Info Badge */}
                <div
                    className={`flex flex-col gap-2 px-3 py-2 rounded-2xl shadow-lg border backdrop-blur-sm bg-opacity-95 transition-all duration-300 ${getRoleColor(currentUser.role)}`}
                >
                    {/* Header Row with Name/Initials and Toggle */}
                    <div className="flex items-center gap-2">
                        {isExpanded ? (
                            <>
                                {/* User Icon */}
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5 flex-shrink-0"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                                        clipRule="evenodd"
                                    />
                                </svg>

                                {/* User Name & Role */}
                                <div className="flex flex-col leading-tight flex-grow">
                                    <span className="text-sm font-semibold">{currentUser.name}</span>
                                    <span className="text-xs opacity-75">{currentUser.role}</span>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Initials Display */}
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white bg-opacity-30 font-bold text-base">
                                    {getInitials(currentUser.name)}
                                </div>
                            </>
                        )}

                        {/* Online Users Count (Admin only) */}
                        {isAdmin && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowOnlineUsers(true);
                                }}
                                className="flex items-center gap-1 px-2 py-1 bg-white bg-opacity-20 rounded-full hover:bg-white/40 transition-colors"
                                title="View registered users"
                            >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                                </svg>
                                {onlineUsers.length > 0 && (
                                    <span className="text-xs font-semibold">{onlineUsers.length}</span>
                                )}
                            </button>
                        )}

                        {/* Lock Status Indicator */}
                        {isLocked && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-red-500 bg-opacity-80 rounded-full" title="Data entry is locked">
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                </svg>
                            </div>
                        )}

                        {/* Network Indicator - Always Visible */}
                        <NetworkIndicator isOnline={isOnline} isSyncing={isSyncing} queuedCount={queuedCount} />

                        {/* Collapse/Expand Toggle */}
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="p-1 rounded-full hover:bg-white/30 transition-colors"
                            title={isExpanded ? "Collapse" : "Expand"}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>

                    {/* Expanded Section */}
                    {isExpanded && (
                        <>

                            {/* Switch Account Button */}
                            <button
                                onClick={() => setShowConfirm(true)}
                                className="flex items-center justify-center gap-2 px-3 py-2 mt-2 rounded-full bg-white/30 hover:bg-white/50 transition-colors w-full text-sm font-medium"
                                title="Switch Account"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-4 w-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                                    />
                                </svg>
                                <span>Switch Account</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={showConfirm}
                onClose={() => setShowConfirm(false)}
                onConfirm={handleSwitchUser}
                title="Switch User"
                message={`Are you sure you want to switch users? You will be logged out as ${currentUser.name}.`}
                confirmText="Switch"
            />

            {/* Online Users Modal */}
            <OnlineUsersModal
                isOpen={showOnlineUsers}
                onClose={() => setShowOnlineUsers(false)}
                onlineUsers={onlineUsers}
            />
        </>
    );
};

export default UserBadge;
