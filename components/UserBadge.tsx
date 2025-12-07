import React, { useState } from 'react';
import { useUser } from '../context/UserContext';
import ConfirmationModal from './ConfirmationModal';

const UserBadge: React.FC = () => {
    const { currentUser, logout } = useUser();
    const [showConfirm, setShowConfirm] = useState(false);

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

    return (
        <>
            <div className="fixed top-4 right-4 z-50 flex flex-col items-end gap-2 lg:flex-row lg:items-center lg:gap-2">
                {/* User Info Badge */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-full shadow-lg border backdrop-blur-sm bg-opacity-95 ${getRoleColor(currentUser.role)}`}>
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
        </>
    );
};

export default UserBadge;
