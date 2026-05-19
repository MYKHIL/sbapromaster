import React, { useState, useEffect, useMemo } from 'react';
import { HelpCircle } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useData } from '../context/DataContext';
import ConfirmationModal from './ConfirmationModal';
import OnlineUsersModal from './OnlineUsersModal';
import { getSchoolTermIds } from '../services/firebaseService';

const UserBadge: React.FC<{ onOpenTutorial?: () => void }> = ({ onOpenTutorial }) => {
    const { currentUser, logout, switchAccount } = useUser();

    // Early return BEFORE other hooks to avoid React error #300
    if (!currentUser) return null;

    const { isOnline, isSyncing, queuedCount, onlineUsers, settings, subjects, subscription, schoolId } = useData();
    const [showConfirm, setShowConfirm] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [showOnlineUsers, setShowOnlineUsers] = useState(false);
    const [showTermInfo, setShowTermInfo] = useState(false);
    const [showUserInfo, setShowUserInfo] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    // Term Switching State
    const [showTermSelect, setShowTermSelect] = useState(false);
    const [availableTerms, setAvailableTerms] = useState<string[]>([]);
    const [isLoadingTerms, setIsLoadingTerms] = useState(false);

    const termInfoRef = React.useRef<HTMLDivElement>(null);
    const userInfoRef = React.useRef<HTMLDivElement>(null);


    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (showTermInfo && termInfoRef.current && !termInfoRef.current.contains(target)) {
                if (!target.closest('[title="View Term Information"]')) {
                    setShowTermInfo(false);
                }
            }
            if (showUserInfo && userInfoRef.current && !userInfoRef.current.contains(target)) {
                if (!target.closest('[title="View My Information"]')) {
                    setShowUserInfo(false);
                }
            }
        };

        if (showTermInfo || showUserInfo) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showTermInfo, showUserInfo]);

    // Switch Account (Same School)
    const handleSwitchUser = () => {
        switchAccount();
        // AuthOverlay will detect !isAuthenticated and switch to 'user-selection'
    };

    const handleFetchTerms = async () => {
        if (!schoolId) return;
        setIsLoadingTerms(true);
        setShowTermSelect(true);
        try {
            const prefix = schoolId.split('_')[0];
            const ids = await getSchoolTermIds(prefix);
            // Sort terms chronologically (approx by ID)
            setAvailableTerms(ids.sort((a, b) => b.localeCompare(a)));
        } catch (e) {
            console.error("Failed to fetch terms:", e);
        } finally {
            setIsLoadingTerms(false);
        }
    };

    const handleTermSelect = (targetTermId: string) => {
        if (targetTermId === schoolId) return;

        // We set the target school ID. 
        // Authentication uses the existing sba_school_password and sba_user_password in localStorage.
        // If they differ, AuthOverlay will fail its auto-restore and prompt for the password.
        localStorage.setItem('sba_school_id', targetTermId);
        window.location.reload();
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

    // Aggregate all unique assigned subjects across global and class-specific settings
    const assignedSubjects = useMemo(() => {
        if (!currentUser) return [];
        const set = new Set<string>();

        // 1. Add from global allowedSubjects
        (currentUser.allowedSubjects || []).forEach(sub => {
            if (typeof sub === 'string') set.add(sub);
            else if (typeof sub === 'number') {
                const s = (subjects || []).find(x => x.id === sub);
                if (s) set.add(s.subject);
            }
        });

        // 2. Add from classSubjects mapping { "Class Name": [sub1, sub2] }
        if (currentUser.classSubjects) {
            Object.values(currentUser.classSubjects).forEach((subList: any) => {
                (subList || []).forEach((sub: any) => {
                    if (typeof sub === 'string') set.add(sub);
                    else if (typeof sub === 'number') {
                        const s = (subjects || []).find(x => x.id === sub);
                        if (s) set.add(s.subject);
                    }
                });
            });
        }

        return Array.from(set).sort();
    }, [currentUser, subjects]);

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
                            <div className="relative">
                                {/* Initials Display - Clickable */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowUserInfo(!showUserInfo);
                                        setShowTermInfo(false); // Mutually exclusive for better UX
                                    }}
                                    className="flex items-center justify-center w-8 h-8 rounded-full bg-white bg-opacity-30 font-bold text-base hover:bg-opacity-50 transition-all border border-transparent active:scale-95"
                                    title="View My Information"
                                >
                                    {getInitials(currentUser.name)}
                                </button>
                                {onOpenTutorial && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onOpenTutorial();
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-md active:scale-95 ml-2 group overflow-hidden relative"
                                        title="Launch App Tutorial"
                                    >
                                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <HelpCircle size={14} className="animate-pulse" />
                                        <span className="text-[9px] font-black uppercase tracking-tighter">Tutorial</span>
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Online Users Count (Admin only) - Commented out per user request */}


                        {/* Online Users Count (Admin only) - Commented out per user request */}
                        {/* {isAdmin && (
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
                        )} */}

                        {/* Lock Status Indicator */}
                        {isLocked && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-red-500 bg-opacity-80 rounded-full" title="Data entry is locked">
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                </svg>
                            </div>
                        )}

                        {/* Term Info Indicator - Replaces Network Indicator */}
                        <div className="relative">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowTermInfo(!showTermInfo);
                                    setShowUserInfo(false); // Mutually exclusive for better UX
                                }}
                                className="flex flex-col items-center gap-0.5 ml-2 cursor-pointer group"
                                title="View Term Information"
                            >
                                <div className="flex flex-col items-center leading-[1.1] text-center select-none border-l border-blue-200/50 pl-2">
                                    <span className="text-[10px] font-black text-blue-800 uppercase tracking-tight">
                                        {settings?.academicYear || 'Year'}
                                    </span>
                                    <span className="text-[9px] font-bold text-blue-600/80">
                                        {settings?.academicTerm || 'Term'}
                                    </span>
                                </div>
                            </button>

                        </div>

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
                            className="hover:bg-red-100 ml-1"
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
                            className="p-1 rounded-full hover:bg-white/30 transition-colors ml-1"
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

            {/* Mobile Backdrop for Popups */}
            {(showUserInfo || showTermInfo) && (
                <div
                    className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[65] md:hidden pointer-events-auto"
                    onClick={() => {
                        setShowUserInfo(false);
                        setShowTermInfo(false);
                    }}
                />
            )}

            {/* User Info Popup - Centered on Mobile */}
            {showUserInfo && (
                <div
                    ref={userInfoRef}
                    className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[320px] bg-white rounded-xl shadow-2xl border border-gray-100 p-5 z-[70] animate-in fade-in zoom-in-95 duration-200 md:absolute md:top-full md:right-0 md:mt-2 md:translate-x-0 md:translate-y-0 md:left-auto md:w-72 pointer-events-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex flex-col items-center mb-4 pb-4 border-b border-gray-50">
                        <div className={`p-4 rounded-full mb-3 shadow-inner ${getRoleColor(currentUser.role)} bg-opacity-30`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <h3 className="font-bold text-gray-800 text-lg leading-tight text-center">{currentUser.name}</h3>
                        <span className={`mt-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getRoleColor(currentUser.role)}`}>
                            {currentUser.role}
                        </span>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                Class Access
                            </p>
                            {isAdmin ? (
                                <p className="text-sm font-medium text-green-600 bg-green-50 px-2 py-1 rounded-lg inline-block">Full Institution Access</p>
                            ) : (currentUser.allowedClasses || []).length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                    {(currentUser.allowedClasses || []).map((cls, idx) => (
                                        <span key={idx} className="text-xs font-semibold bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md border border-gray-200">
                                            {cls}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs italic text-gray-400">No classes assigned</p>
                            )}
                        </div>

                        <div>
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                Subject Access
                            </p>
                            {isAdmin ? (
                                <p className="text-sm font-medium text-green-600 bg-green-50 px-2 py-1 rounded-lg inline-block">All Registered Subjects</p>
                            ) : assignedSubjects.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                    {assignedSubjects.map((sub, idx) => (
                                        <span key={idx} className="text-xs font-semibold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md border border-blue-100">
                                            {sub}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs italic text-gray-400">No subjects assigned</p>
                            )}
                        </div>
                    </div>
                    <div className="mt-5 pt-4 text-[10px] text-center text-gray-400 border-t border-gray-50 italic md:hidden">
                        Tap anywhere outside to close
                    </div>
                </div>
            )}

            {/* Term Info Popup - Centered on Mobile */}
            {showTermInfo && (
                <div
                    ref={termInfoRef}
                    className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[320px] bg-white rounded-2xl shadow-2xl border border-blue-100 p-4 z-[70] animate-in fade-in zoom-in-95 duration-200 overflow-hidden md:absolute md:top-full md:right-0 md:mt-2 md:translate-x-0 md:translate-y-0 md:left-auto md:w-72 pointer-events-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    {showTermSelect ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                                <button onClick={() => setShowTermSelect(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                                <h3 className="font-bold text-gray-800 text-sm">Select Term to Switch</h3>
                            </div>
                            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {isLoadingTerms ? (
                                    <div className="py-8 flex flex-col items-center justify-center gap-2">
                                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                        <span className="text-xs text-gray-400">Fetching available terms...</span>
                                    </div>
                                ) : availableTerms.length > 0 ? (
                                    availableTerms.map(termId => {
                                        const parts = termId.split('_');
                                        const isCurrent = termId === schoolId;
                                        return (
                                            <button key={termId} onClick={() => handleTermSelect(termId)} className={`w-full text-left p-3 rounded-xl transition-all duration-200 border ${isCurrent ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-100' : 'bg-gray-50 border-transparent hover:bg-white hover:border-blue-200 hover:shadow-sm'}`} disabled={isCurrent}>
                                                <div className="flex justify-between items-center">
                                                    <div className="flex flex-col">
                                                        <span className={`text-xs font-bold uppercase tracking-tight ${isCurrent ? 'text-blue-700' : 'text-gray-700'}`}>{parts[1] || 'Unknown Year'}</span>
                                                        <span className={`text-[11px] ${isCurrent ? 'text-blue-500 font-medium' : 'text-gray-500'}`}>{parts[2]?.replace('term', 'Term ') || 'Term'}</span>
                                                    </div>
                                                    {isCurrent && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">Current</span>}
                                                </div>
                                            </button>
                                        );
                                    })
                                ) : (
                                    <div className="text-center py-4 text-xs text-gray-500">No other terms found</div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h3 className="font-semibold text-gray-800 text-sm">Current Term Details</h3>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="font-medium text-blue-900 bg-blue-50 px-2 py-0.5 rounded text-xs truncate max-w-full">{settings?.schoolName.toUpperCase() || 'No School Name Set'}</span>
                                </div>
                                {subscription?.expiryDate && (() => {
                                    const expiry = subscription.expiryDate?.toDate ? subscription.expiryDate.toDate() : new Date(subscription.expiryDate);
                                    const isExpired = expiry < new Date();
                                    const daysLeft = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                                    return (
                                        <div className={`rounded-xl px-3 py-2 space-y-1.5 ${isExpired ? 'bg-red-50 border border-red-200' : daysLeft <= 30 ? 'bg-orange-50 border border-orange-200' : 'bg-indigo-50 border border-indigo-100'}`}>
                                            <p className={`text-[10px] font-black uppercase tracking-widest ${isExpired ? 'text-red-400' : daysLeft <= 30 ? 'text-orange-400' : 'text-indigo-400'}`}>License</p>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-gray-600">Expiry Date</span>
                                                <span className={`font-bold px-2 py-0.5 rounded text-xs ${isExpired ? 'text-red-700 bg-red-100' : daysLeft <= 30 ? 'text-orange-700 bg-orange-100' : 'text-indigo-700 bg-indigo-100'}`}>{expiry.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                            </div>
                                            {isExpired ? <p className="text-[10px] text-red-600 font-semibold text-center">⚠️ License has expired</p> : daysLeft <= 30 ? <p className="text-[10px] text-orange-600 font-medium text-center">{daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining</p> : <p className="text-[10px] text-indigo-500 font-medium text-center">✓ Active</p>}
                                        </div>
                                    );
                                })()}
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500">Academic Year</span>
                                    <span className="font-medium text-gray-900 bg-gray-50 px-2 py-0.5 rounded">{settings?.academicYear || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500">Current Term</span>
                                    <span className="font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{settings?.academicTerm || 'N/A'}</span>
                                </div>
                                <div className="pt-2 border-t border-gray-50" />
                                <div className="space-y-2">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black">Dates</p>
                                    <div className="flex justify-between items-center text-xs py-0.5">
                                        <span className="text-gray-600">Vacation Date</span>
                                        <span className="font-semibold text-gray-900">{settings?.vacationDate ? new Date(settings.vacationDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not Set'}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs py-0.5">
                                        <span className="text-gray-600">Reopening Date</span>
                                        <span className="font-semibold text-gray-900">{settings?.reopeningDate ? new Date(settings.reopeningDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not Set'}</span>
                                    </div>
                                </div>
                                <div className="pt-3 flex flex-col gap-2 pointer-events-auto">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowTermInfo(false);
                                            window.dispatchEvent(new CustomEvent('sba-switch-term'));
                                        }}
                                        className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200 pointer-events-auto cursor-pointer"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                        </svg>
                                        Switch Term
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

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
