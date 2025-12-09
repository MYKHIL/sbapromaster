import React, { useState } from 'react';
import { useUser } from '../context/UserContext';
import { useData } from '../context/DataContext';
import ConfirmationModal from './ConfirmationModal';
import { NetworkIndicator } from './NetworkIndicator';
import OnlineUsersModal from './OnlineUsersModal';

const UserBadge: React.FC = () => {
    const { currentUser, logout } = useUser();
    const { isOnline, isSyncing, queuedCount, onlineUsers, settings } = useData();
    const [showConfirm, setShowConfirm] = useState(false);
    const [showOnlineUsers, setShowOnlineUsers] = useState(false);

    if (!currentUser) return null;

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

    const isLocked = settings?.isDataEntryLocked;
    const isAdmin = currentUser.role === 'Admin';

    return (
        <>
            <div className="fixed top-4 right-4 z-[60] flex flex-col items-end gap-2 lg:flex-row lg:items-center lg:gap-2" style={{ position: 'fixed' }}>
                {/* User Info Badge */}
                <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-full shadow-lg border backdrop-blur-sm bg-opacity-95 ${getRoleColor(currentUser.role)} ${isAdmin ? 'cursor-pointer' : ''}`}
                    onClick={isAdmin && onlineUsers.length > 0 ? () => setShowOnlineUsers(true) : undefined}
                    title={isAdmin ? `${onlineUsers.length} online user(s)` : undefined}
                >
                    {/* User Icon */}
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
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
                    <div className="flex flex-col leading-tight">
                        <span className="text-sm font-semibold">{currentUser.name}</span>
                        <span className="text-xs opacity-75">{currentUser.role}</span>
                    </div>

                    {/* Online Users Count (Admin only) */}
                    {isAdmin && onlineUsers.length > 0 && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-white bg-opacity-20 rounded-full">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            <span className="text-xs font-semibold">{onlineUsers.length}</span>
                        </div>
                    )}

                    {/* Lock Status Indicator */}
                    {isLocked && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-red-500 bg-opacity-80 rounded-full" title="Data entry is locked">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                        </div>
                    )}

                    {/* Network Indicator */}
                    <NetworkIndicator isOnline={isOnline} isSyncing={isSyncing} queuedCount={queuedCount} />
                </div>

                {/* Switch User Button */}
                <button
                    onClick={() => setShowConfirm(true)}
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-full shadow-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                    title="Switch Account"
                    aria-label="Switch Account"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 text-gray-600"
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
                    <span className="text-xs font-medium text-gray-700 lg:hidden">Switch Account</span>
                </button>
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
