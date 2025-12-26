import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { useData } from '../context/DataContext';
import ConfirmationModal from './ConfirmationModal';
import { NetworkIndicator } from './NetworkIndicator';
import OnlineUsersModal from './OnlineUsersModal';

const UserBadge: React.FC = () => {
    const { currentUser, logout } = useUser();

    // Early return BEFORE other hooks to avoid React error #300
    if (!currentUser) return null;

    const { isOnline, isSyncing, queuedCount, onlineUsers, settings } = useData();
    const [showConfirm, setShowConfirm] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [showOnlineUsers, setShowOnlineUsers] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    // Switch Account (Same School)
    const handleSwitchUser = () => {
        logout();
        // AuthOverlay will detect !isAuthenticated and switch to 'user-selection'
    };

    // Full Logout (Return to School Selection)
    const handleFullLogout = () => {
        logout(); // Visual consistency + clear auth state
        // Force reload to completely reset AuthOverlay state and clear school context
        window.location.reload();
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
        <div className="flex flex-col items-end">
            <div className={`relative z-[60] transition-all duration-300 ${!isExpanded ? 'scale-90 opacity-80 hover:opacity-100 hover:scale-95' : 'scale-100'}`}>
                {/* User Info Badge */}
                <div
                    className={`flex flex-col gap-1.5 px-2 py-1.5 rounded-2xl shadow-lg border backdrop-blur-md bg-opacity-90 transition-all duration-300 lg:px-3 lg:py-2 lg:bg-opacity-95 ${getRoleColor(currentUser.role)}`}
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

                        {/* Always Visible Logout Button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowLogoutConfirm(true);
                            }}
                            style={{
                                display: 'inline-flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '2px',
                                padding: '4px 6px',
                                borderRadius: '9999px',
                                backgroundColor: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                            className="hover:bg-red-100"
                            title="Logout from School"
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(254, 226, 226, 0.5)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5 text-gray-500 hover:text-red-600"
                                style={{ transition: 'color 0.2s' }}
                                fill="currentColor"
                                viewBox="0 0 24 24"
                            >
                                {/* Door Frame */}
                                <rect x="2" y="3" width="8" height="18" stroke="currentColor" strokeWidth="1.5" fill="none" />

                                {/* Open Door */}
                                <path d="M10 3 L13 5 L13 19 L10 21 Z" fill="currentColor" opacity="0.3" />
                                <path d="M10 3 L13 5 L13 19 L10 21" stroke="currentColor" strokeWidth="1.5" fill="none" />

                                {/* Door Handle */}
                                <circle cx="6" cy="12" r="0.8" fill="currentColor" />

                                {/* Exit Arrow */}
                                <path d="M12 12 h4 M14 10 l2 2 l-2 2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />

                                {/* Walking Person */}
                                <circle cx="19" cy="8" r="1.5" fill="currentColor" />
                                <path d="M19 10 v3 M19 13 l-1.5 3.5 M19 13 l1.5 3.5 M18 11 l2 1" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span style={{ fontSize: '9px', color: '#6b7280', fontWeight: 500, opacity: 0.8 }}>
                                Log Out
                            </span>
                        </button>

                        {/* Collapse/Expand Toggle */}
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="p-1 rounded-full hover:bg-white/30 transition-colors"
                            title={isExpanded ? "Collapse" : "Expand"}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className={`h-4 w-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
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
                                <span>Switch User</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Switch User Modal */}
            <ConfirmationModal
                isOpen={showConfirm}
                onClose={() => setShowConfirm(false)}
                onConfirm={handleSwitchUser}
                title="Switch User"
                message={`Switch to a different user account within this school?`}
                confirmText="Switch User"
            />

            {/* Full Logout Modal */}
            <ConfirmationModal
                isOpen={showLogoutConfirm}
                onClose={() => setShowLogoutConfirm(false)}
                onConfirm={handleFullLogout}
                title="Sign Out"
                message="Are you sure you want to sign out? You will be returned to the School Login page."
                confirmText="Sign Out"
                variant="danger"
            />

            {/* Online Users Modal */}
            <OnlineUsersModal
                isOpen={showOnlineUsers}
                onClose={() => setShowOnlineUsers(false)}
                onlineUsers={onlineUsers}
            />
        </div>
    );
};

export default UserBadge;
