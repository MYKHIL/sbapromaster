import React from 'react';
import { useData } from '../context/DataContext';
import { useUser } from '../context/UserContext';
import ConfirmationModal from './ConfirmationModal';

/**
 * Global lock notice banner that appears on all pages when current user is locked/restricted
 * Checks if the current user's isReadOnly flag is true (set via "Block Editing for All Users" in User Management)
 */
const LockNoticeBanner: React.FC = () => {
    const { settings } = useData();
    const { currentUser } = useUser();
    const [isLockModalOpen, setIsLockModalOpen] = React.useState(false);

    const isLocked = currentUser?.isReadOnly === true;

    if (!isLocked) return null;

    const lockMessage =
        currentUser?.role === 'Admin'
            ? '⚠ Your account is currently restricted from editing. You can unlock your account from User Management.'
            : '⚠ Your account is currently restricted from editing. Please contact your administrator to unlock you.';

    const lockModalMessage =
        currentUser?.role === 'Admin'
            ? 'Your account is currently restricted from editing. You can still view pages, but cannot make changes until you unlock your account through User Management.'
            : 'Your account is restricted from editing. You can still view pages, but cannot make any changes. Please contact an administrator to unlock your account.';

    const openUserManagement = () => {
        window.dispatchEvent(
            new CustomEvent('app-navigate', {
                detail: {
                    page: 'Settings',
                    meta: { openUserManagement: true },
                },
            })
        );
    };

    return (
        <>
            <style>{`
                @keyframes dangerPulse {
                    0% {
                        color: #dc2626;
                        text-shadow:
                            0 0 0px rgba(220, 38, 38, 0),
                            0 0 0px rgba(220, 38, 38, 0);
                    }

                    25% {
                        color: #ef4444;
                        text-shadow:
                            0 0 6px rgba(239, 68, 68, 0.35),
                            0 0 12px rgba(239, 68, 68, 0.25);
                    }

                    50% {
                        color: #f97316;
                        text-shadow:
                            0 0 10px rgba(249, 115, 22, 0.45),
                            0 0 20px rgba(249, 115, 22, 0.25);
                    }

                    75% {
                        color: #ef4444;
                        text-shadow:
                            0 0 6px rgba(239, 68, 68, 0.35),
                            0 0 12px rgba(239, 68, 68, 0.25);
                    }

                    100% {
                        color: #dc2626;
                        text-shadow:
                            0 0 0px rgba(220, 38, 38, 0),
                            0 0 0px rgba(220, 38, 38, 0);
                    }
                }

                @keyframes glassFloat {
                    0% {
                        transform: translateY(0px);
                    }
                    50% {
                        transform: translateY(-2px);
                    }
                    100% {
                        transform: translateY(0px);
                    }
                }

                .danger-text-animation {
                    animation: dangerPulse 2.4s ease-in-out infinite;
                    font-weight: 700;
                }

                .glass-banner {
                    animation: glassFloat 5s ease-in-out infinite;
                }
            `}</style>

            <div className="fixed left-4 right-4 bottom-24 md:bottom-20 lg:bottom-16 z-[80] flex justify-center pointer-events-auto">
                <div
                    className="
                        glass-banner
                        max-w-4xl
                        w-full
                        rounded-3xl
                        border
                        border-red-400/30
                        bg-red-50/10
                        backdrop-blur-2xl
                        px-5
                        py-4
                        shadow-[0_8px_32px_rgba(220,38,38,0.12)]
                    "
                >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="danger-text-animation flex-1 text-sm md:text-[15px] leading-relaxed">
                            {lockMessage}
                        </p>

                        <div className="flex flex-wrap gap-2">
                            {currentUser?.role === 'Admin' && (
                                <button
                                    type="button"
                                    onClick={openUserManagement}
                                    className="
                                        rounded-xl
                                        border
                                        border-red-300/50
                                        bg-white/20
                                        backdrop-blur-md
                                        px-4
                                        py-2
                                        text-xs
                                        font-semibold
                                        text-red-700
                                        transition-all
                                        duration-300
                                        hover:bg-white/35
                                        hover:shadow-lg
                                    "
                                >
                                    Open User Management
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => setIsLockModalOpen(true)}
                                className="
                                    rounded-xl
                                    bg-red-600
                                    px-4
                                    py-2
                                    text-xs
                                    font-semibold
                                    text-white
                                    transition-all
                                    duration-300
                                    hover:bg-red-700
                                    hover:shadow-lg
                                    hover:shadow-red-500/30
                                "
                            >
                                {currentUser?.role === 'Admin'
                                    ? 'View Details'
                                    : 'Learn Why'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <ConfirmationModal
                isOpen={isLockModalOpen}
                onClose={() => setIsLockModalOpen(false)}
                onConfirm={() => setIsLockModalOpen(false)}
                title="Account Restricted"
                message={lockModalMessage}
                variant="info"
                confirmText="Close"
                additionalAction={
                    currentUser?.role === 'Admin'
                        ? openUserManagement
                        : undefined
                }
                additionalActionText={
                    currentUser?.role === 'Admin'
                        ? 'Open User Management'
                        : undefined
                }
            />
        </>
    );
};

export default LockNoticeBanner;