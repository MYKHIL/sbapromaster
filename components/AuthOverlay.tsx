import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useUser } from '../context/UserContext';
import { loginOrRegisterSchool, AppDataType, SchoolListItem, SchoolPeriod, clearAuthCaches, db, loggedSetDoc } from '../services/firebaseService';
import * as SyncLogger from '../services/syncLogger';
import { doc, Timestamp } from 'firebase/firestore';
import { INITIAL_SETTINGS, INITIAL_STUDENTS, INITIAL_SUBJECTS, INITIAL_CLASSES, INITIAL_GRADES, INITIAL_ASSESSMENTS, INITIAL_SCORES, INITIAL_REPORT_DATA, INITIAL_CLASS_DATA } from '../constants';
import type { User } from '../types';

// Import new auth components
import WelcomeScreen from './auth/WelcomeScreen';
import SchoolListScreen from './auth/SchoolListScreen';
import PasswordScreen from './auth/PasswordScreen';
import YearTermSelector from './auth/YearTermSelector';
import RegistrationForm from './auth/RegistrationForm';
import SessionRestoreDialog from './auth/SessionRestoreDialog';
import RegistrationPendingDialog from './auth/RegistrationPendingDialog';
import SubscriptionExpiredDialog from './auth/SubscriptionExpiredDialog';
import AdminSetup from './AdminSetup';
import UserSelection from './UserSelection';
import SubscriptionRequestModal from './SubscriptionRequestModal';
import MessageBox from './MessageBox';

type AuthStep = 'welcome' | 'school-list' | 'password' | 'year-term' | 'register' | 'admin-setup' | 'user-selection' | 'authenticated';

interface AuthOverlayProps {
    children?: React.ReactNode;
}

const AuthOverlay: React.FC<AuthOverlayProps> = ({ children }) => {
    const { loadImportedData, setSchoolId, pauseSync, resumeSync, isFetching } = useData();
    const { setUsers, users, login, setPassword: setUserPassword, checkAutoLogin, isAuthenticated, switchAccount } = useUser();

    // Navigation state
    const [currentStep, setCurrentStep] = useState<AuthStep>('welcome');
    const [selectedSchool, setSelectedSchool] = useState<SchoolListItem | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState<SchoolPeriod | null>(null);
    const [verifiedPassword, setVerifiedPassword] = useState<string>(''); // Store password after verification
    const [schoolData, setSchoolData] = useState<AppDataType | null>(null);
    const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
    const [showSessionRestore, setShowSessionRestore] = useState<boolean>(false);
    const [isCheckingLicense, setIsCheckingLicense] = useState<boolean>(false);
    const [showSubscriptionExpired, setShowSubscriptionExpired] = useState<boolean>(false);
    const [sessionInfo, setSessionInfo] = useState<{ schoolName: string; userName: string; academicYear?: string; academicTerm?: string } | null>(null);
    const [showRegistrationPending, setShowRegistrationPending] = useState<boolean>(false);
    const [pendingSchoolName, setPendingSchoolName] = useState<string>('');
    const [pendingRegistration, setPendingRegistration] = useState<{ docId: string; password: string; registrationData: AppDataType; targetIndex: number } | null>(null);
    const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);

    const [messageBox, setMessageBox] = useState<{
        isOpen: boolean;
        title: string;
        message: string | React.ReactNode;
        confirmText?: string;
        cancelText?: string;
        onConfirm: () => void;
        onCancel?: () => void;
        variant?: 'info' | 'success' | 'warning' | 'danger';
        hideCancel?: boolean;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { }
    });

    const showMsg = (config: Omit<typeof messageBox, 'isOpen' | 'onConfirm' | 'onCancel'>) => {
        return new Promise<boolean>((resolve) => {
            setMessageBox({
                ...config,
                isOpen: true,
                onConfirm: () => {
                    setMessageBox(prev => ({ ...prev, isOpen: false }));
                    resolve(true);
                },
                onCancel: () => {
                    setMessageBox(prev => ({ ...prev, isOpen: false }));
                    resolve(false);
                }
            });
        });
    };

    // Loading state
    const [restoringSession, setRestoringSession] = useState(true);
    
    // Prioritize last logged in user
    const sortedUsers = useMemo(() => {
        const lastUserId = localStorage.getItem('sba_last_user_id');
        if (!lastUserId) return users;
        const lastId = parseInt(lastUserId);
        
        return [...users].sort((a, b) => {
            if (a.id === lastId) return -1;
            if (b.id === lastId) return 1;
            return 0;
        });
    }, [users]);

    // Initialize SyncLogger
    useEffect(() => {
        SyncLogger.startNewLog('School Authentication');
        SyncLogger.log('AuthOverlay component mounted');
        return () => {
            SyncLogger.log('AuthOverlay component unmounting');
        };
    }, []);

    // Pause sync during authentication
    useEffect(() => {
        if (currentStep !== 'authenticated' || !isAuthenticated) {
            0 && console.log('[AuthOverlay] Pausing sync - authentication in progress');
            pauseSync();
        }
    }, [currentStep, isAuthenticated, pauseSync]);

    // Restore session on mount
    useEffect(() => {
        const restoreSession = async () => {
            try {
                // -------------------------------------------------------------
                // 1. CHECK FOR PENDING SELECTION (Active DB Switch)
                // -------------------------------------------------------------
                const pendingSelectionStr = localStorage.getItem('pending_school_selection');
                if (pendingSelectionStr) {
                    0 && console.log('[AuthOverlay] 🔄 Found pending school selection (DB Switch)');
                    try {
                        const pendingSchool = JSON.parse(pendingSelectionStr) as SchoolListItem;

                        // Verify we are on the correct DB now
                        const { SCHOOL_DATABASE_MAPPING, ACTIVE_DATABASE_INDEX } = await import('../constants');
                        let requiredIndex = pendingSchool._databaseIndex;
                        if (typeof requiredIndex !== 'number') {
                            const schoolPrefix = pendingSchool.docId.split('_')[0].toLowerCase();
                            requiredIndex = SCHOOL_DATABASE_MAPPING[schoolPrefix];
                        }

                        // Restore selection
                        handleSchoolSelect(pendingSchool);
                        0 && console.log('[AuthOverlay] ✅ Restored pending selection:', pendingSchool.docId);

                        // Clear the key so we don't loop or reuse
                        localStorage.removeItem('pending_school_selection');

                        // ABORT normal session restore - user is in a NEW active flow
                        setRestoringSession(false);
                        return;

                    } catch (parseError) {
                        console.error('[AuthOverlay] Failed to parse pending selection:', parseError);
                        localStorage.removeItem('pending_school_selection'); // Clear bad data
                    }
                }
                console.log("[AuthOverlay] 🔍 restoreSession triggered!");
                console.log("[AuthOverlay] localStorage keys - sba_school_id:", localStorage.getItem('sba_school_id'), "sba_force_term_select:", localStorage.getItem('sba_force_term_select'));
                const savedSchoolId = localStorage.getItem('sba_school_id');
                const savedSchoolPassword = localStorage.getItem('sba_school_password');
                const savedUserId = localStorage.getItem('sba_user_id');
                const savedUserPassword = localStorage.getItem('sba_user_password');

                if (!savedSchoolId || !savedSchoolPassword) {
                    0 && console.log('[AuthOverlay] No saved school session found');
                    return;
                }

                0 && console.log('[AuthOverlay] Found saved school session, fetching data...');

                // ... (Database switch check remains same) ...
                const { SCHOOL_DATABASE_MAPPING, ACTIVE_DATABASE_INDEX } = await import('../constants');
                const schoolPrefix = savedSchoolId.split('_')[0].toLowerCase();
                const requiredIndex = SCHOOL_DATABASE_MAPPING[schoolPrefix];

                if (requiredIndex && requiredIndex !== ACTIVE_DATABASE_INDEX) {
                    console.warn(`[AuthOverlay] Database mismatch for ${savedSchoolId}. Switching to Index ${requiredIndex}...`);
                    localStorage.setItem('active_database_index', requiredIndex.toString());
                    window.location.reload();
                    return;
                }

                // Fetch school data
                const result = await loginOrRegisterSchool(savedSchoolId, savedSchoolPassword, {} as AppDataType, false);

                if (result.status !== 'success' || !result.data) {
                    console.error('[AuthOverlay] Failed to restore school session:', result.status);
                    if (result.status === 'expired') {
                        // Show expiry dialog before modal
                        setPendingSchoolName(result.data?.settings?.schoolName || savedSchoolId.split('_')[0]);
                        setShowSubscriptionExpired(true);
                    } else {
                        alert(result.message || `Session restoration failed: ${result.status}`);
                    }
                    // Clear invalid school session
                    localStorage.removeItem('sba_school_id');
                    localStorage.removeItem('sba_school_password');
                    return;
                }

                // Load basic school data
                loadImportedData(result.data, true, (result as any).subscription);
                setSchoolData(result.data);
                setCurrentSchoolId(result.docId || savedSchoolId);
                setSchoolId(result.docId || savedSchoolId);
                setUsers(result.data.users || []);

                console.log("[AuthOverlay] Checking for sba_force_term_select in localStorage...");
                const forceTermSelect = localStorage.getItem('sba_force_term_select') === 'true';
                console.log("[AuthOverlay] sba_force_term_select value is:", forceTermSelect);
                if (forceTermSelect) {
                    console.log("[AuthOverlay] sba_force_term_select is true. Clearing flag from localStorage...");
                    localStorage.removeItem('sba_force_term_select');
                    const schoolItem: SchoolListItem = {
                        docId: result.docId || savedSchoolId,
                        displayName: result.data.settings?.schoolName || savedSchoolId.split('_')[0],
                        settings: result.data.settings,
                        _databaseIndex: requiredIndex,
                        access: result.data.Access
                    };
                    console.log("[AuthOverlay] Prepared schoolItem:", schoolItem);
                    setSelectedSchool(schoolItem);
                    setVerifiedPassword(savedSchoolPassword);
                    console.log("[AuthOverlay] Redirecting directly to currentStep 'year-term'");
                    setCurrentStep('year-term');
                    return;
                }

                // CASE A: User session also exists -> Show Restore Dialog
                if (savedUserId && savedUserPassword) {
                    const user = result.data.users?.find(u => u.id === parseInt(savedUserId));
                    if (user) {
                        setSessionInfo({
                            schoolName: result.data.settings?.schoolName || 'Unknown School',
                            userName: user.name,
                            academicYear: result.data.settings?.academicYear,
                            academicTerm: result.data.settings?.academicTerm
                        });
                        setShowSessionRestore(true);
                        0 && console.log('[AuthOverlay] Full session data loaded, showing restore dialog');
                        return;
                    }
                }

                // CASE B: Only school session exists (e.g. after Switch User) -> Jump to User Selection
                0 && console.log('[AuthOverlay] School restored, jumping to user selection');
                setCurrentStep('user-selection');
            } catch (error) {
                console.error('[AuthOverlay] Session restore error:', error);
            } finally {
                setRestoringSession(false);
            }
        };

        restoreSession();
    }, []);

    // Switch Term Direct Navigation Event (No Reload)
    useEffect(() => {
        const handleSwitchTermEvent = async () => {
            console.log('[AuthOverlay] 🔄 Received sba-switch-term event');
            
            // 1. Partial logout of active user session (preserves school context)
            switchAccount();

            // 2. Load school info from local storage
            const savedSchoolId = localStorage.getItem('sba_school_id');
            const savedSchoolPassword = localStorage.getItem('sba_school_password');

            if (savedSchoolId && savedSchoolPassword) {
                const { SCHOOL_DATABASE_MAPPING } = await import('../constants');
                const schoolPrefix = savedSchoolId.split('_')[0].toLowerCase();
                const requiredIndex = SCHOOL_DATABASE_MAPPING[schoolPrefix];

                const schoolItem: SchoolListItem = {
                    docId: savedSchoolId,
                    displayName: schoolData?.settings?.schoolName || savedSchoolId.split('_')[0],
                    settings: schoolData?.settings,
                    _databaseIndex: requiredIndex,
                    access: schoolData?.Access
                };

                setSelectedSchool(schoolItem);
                setVerifiedPassword(savedSchoolPassword);
                setCurrentStep('year-term');
            } else {
                setCurrentStep('school-list');
            }
        };

        window.addEventListener('sba-switch-term', handleSwitchTermEvent);
        return () => {
            window.removeEventListener('sba-switch-term', handleSwitchTermEvent);
        };
    }, [schoolData, switchAccount]);

    // Handle session restore - continue
    const handleContinueSession = async () => {
        try {
            const savedUserId = localStorage.getItem('sba_user_id');
            const savedUserPassword = localStorage.getItem('sba_user_password');

            if (!savedUserId || !savedUserPassword) {
                setShowSessionRestore(false);
                return;
            }

            // Login the user
            const success = await login(parseInt(savedUserId), savedUserPassword);

            if (success) {
                setShowSessionRestore(false);
                setCurrentStep('authenticated');
                resumeSync();
                0 && console.log('[AuthOverlay] ✅ Session restored successfully');
            } else {
                console.error('[AuthOverlay] Failed to login with saved credentials');
                handleLogoutSession();
            }
        } catch (error) {
            console.error('[AuthOverlay] Continue session error:', error);
            handleLogoutSession();
        }
    };

    // Handle session restore - logout
    const handleLogoutSession = () => {
        // Clear all saved credentials
        localStorage.removeItem('sba_school_id');
        localStorage.removeItem('sba_school_password');
        localStorage.removeItem('sba_user_id');
        localStorage.removeItem('sba_user_password');

        // Reset state
        setShowSessionRestore(false);
        setSessionInfo(null);
        setCurrentStep('welcome');

        0 && console.log('[AuthOverlay] Session cleared, starting fresh');
    };

    // ========== NAVIGATION HANDLERS ==========

    const handleRegisterClick = () => {
        setCurrentStep('register');
    };

    const handleLoginClick = () => {
        setCurrentStep('school-list');
    };

    const handleSchoolSelect = async (school: SchoolListItem) => {
        setIsCheckingLicense(true);
        try {
            0 && console.log('[AuthOverlay] Checking license status for school:', school.docId);
            const { getExistingSubscription } = await import('../services/firebaseService');
            const expiryDate = await getExistingSubscription(school.docId, school._databaseIndex || 0);

            if (expiryDate && new Date() > expiryDate) {
                0 && console.log('[AuthOverlay] Proactive interception: School license expired');
                setPendingSchoolName(school.displayName || school.docId.split('_')[0]);
                setShowSubscriptionExpired(true);
                return;
            }

            // License is valid or not found, proceed to password
            setSelectedSchool(school);
            setCurrentStep('password');
        } catch (error) {
            console.error('[AuthOverlay] Proactive license check failed:', error);
            // Fallback: Continue to password screen, executeLogin will perform the authoritative check
            setSelectedSchool(school);
            setCurrentStep('password');
        } finally {
            setIsCheckingLicense(false);
        }
    };

    const handlePasswordVerified = (password: string) => {
        if (!selectedSchool) return;
        // Store the verified password for later use
        setVerifiedPassword(password);
        // Check if multiple periods exist for this school
        setCurrentStep('year-term');
    };

    const handlePeriodSelect = async (period: SchoolPeriod) => {
        setSelectedPeriod(period);
        await executeLogin(period.docId);
    };

    const handleRegistration = async (
        schoolName: string,
        district: string,
        year: string,
        term: string,
        circuit: string,
        password: string,
        docId: string
    ) => {
        try {
            0 && console.log('[AuthOverlay] 📝 Registering new school:', schoolName);

            // -------------------------------------------------------------
            // DEBUG AUTOMATION: Pre-create admin for Dummy School
            // -------------------------------------------------------------
            let usersArray: User[] = [];
            // @ts-ignore - DEV and VITE_USE_EMULATOR exist in Vite env
            const isBotSchool = schoolName === 'Dummy School' || schoolName === 'SBA Academy Live';
            if ((import.meta as any).env.DEV && isBotSchool) {
                0 && console.log('[AuthOverlay] 🤖 Bot/Debug Mode: Pre-creating admin...');
                const { hashPassword } = await import('../services/authService');
                const hashedPassword = await hashPassword('password');

                usersArray = [{
                    id: 1,
                    name: 'Admin User',
                    role: 'Admin',
                    allowedClasses: [],
                    allowedSubjects: [],
                    passwordHash: hashedPassword
                }];
            }

            // Create initial data
            const initialData: AppDataType = {
                settings: {
                    ...INITIAL_SETTINGS,
                    schoolName,
                    district,
                    circuit,
                    academicYear: year,
                    academicTerm: term
                },
                students: INITIAL_STUDENTS,
                subjects: INITIAL_SUBJECTS,
                classes: INITIAL_CLASSES,
                grades: INITIAL_GRADES,
                assessments: INITIAL_ASSESSMENTS,
                scores: INITIAL_SCORES,
                reportData: INITIAL_REPORT_DATA,
                classData: INITIAL_CLASS_DATA,
                users: usersArray,
                password,
                Access: isBotSchool || true, // Force access true for now to avoid pending dialog blocks
                activeSessions: {},
                userLogs: []
            };

            // -------------------------------------------------------------
            // DUPLICATE CHECK: Prevent re-registering existing schools
            // -------------------------------------------------------------
            const schoolPrefix = docId.split('_')[0].toLowerCase();

            // Fetch existing schools list (used for both duplicate check and fair distribution)
            const { getSchoolList } = await import('../services/firebaseService');
            let existingSchools: any[] = [];

            try {
                // Leverage cached school list to check for duplicates (minimizes reads)
                existingSchools = await getSchoolList();

                // Check if any school has the same prefix (name part)
                const duplicate = existingSchools.find(school => {
                    const existingPrefix = school.docId.split('_')[0].toLowerCase();
                    return existingPrefix === schoolPrefix;
                });

                if (duplicate) {
                    console.warn(`[AuthOverlay] School "${schoolName}" already exists as ${duplicate.docId}`);
                    const shouldLogin = await showMsg({
                        title: 'School Already Registered',
                        message: `This school is already registered as "${duplicate.displayName}".\nIf this is your school, please log in instead. If not, change the school name to continue registration.\n\nWhat would you like to do?`,
                        confirmText: 'Login Instead',
                        cancelText: 'Change School Name',
                        variant: 'warning'
                    });

                    if (shouldLogin) {
                        setSelectedSchool(null);
                        setSelectedPeriod(null);
                        setCurrentStep('school-list');
                    }

                    // Inform caller (RegistrationForm) that registration was cancelled so it can re-enable controls
                    return false;
                }
            } catch (error) {
                console.error('[AuthOverlay] Failed to check for duplicates:', error);
                // Continue anyway - better to allow registration than block on check failure
            }

            // -------------------------------------------------------------
            // DATABASE SELECTION LOGIC
            // -------------------------------------------------------------
            const { FIREBASE_CONFIGS, SCHOOL_DATABASE_MAPPING, ACTIVE_DATABASE_INDEX } = await import('../constants');

            // 1. Check if school is mapped to a reserved/specific database
            let targetIndex = SCHOOL_DATABASE_MAPPING[schoolPrefix];

            // 2. If not mapped, assign to a random PUBLIC database with fair distribution
            if (!targetIndex) {
                const publicIndices = Object.entries(FIREBASE_CONFIGS)
                    .filter(([_, cfg]) => !cfg.isReserved)
                    .map(([idx, _]) => Number(idx));

                if (publicIndices.length > 0) {
                    // LEAST SCHOOLS DISTRIBUTION: Pick the DB with the absolute minimum schools
                    const dbCounts: { [key: number]: number } = {};
                    publicIndices.forEach(idx => dbCounts[idx] = 0);

                    existingSchools.forEach(school => {
                        const idx = school._databaseIndex;
                        if (idx !== undefined && dbCounts[idx] !== undefined) {
                            dbCounts[idx]++;
                        }
                    });

                    // Deterministic selection: Pick one of the indices with the minimum count
                    let minCount = Infinity;
                    let bestIndex = publicIndices[0];

                    publicIndices.forEach(idx => {
                        if (dbCounts[idx] < minCount) {
                            minCount = dbCounts[idx];
                            bestIndex = idx;
                        }
                    });

                    targetIndex = bestIndex;
                    0 && console.log(`[AuthOverlay] Least-schools distribution selected DB ${targetIndex}. Final counts:`, dbCounts);
                } else {
                    targetIndex = 1; // Fallback to primary
                }
            }

            0 && console.log(`[AuthOverlay] Targeted Database Index: ${targetIndex} for ${docId}`);

            // Pre-calculate full registration data
            const registrationData: AppDataType = {
                ...initialData,
                Access: isBotSchool, // FALSE for real users, TRUE for Bot
            };

            // -------------------------------------------------------------
            // OPTIMIZATION: Defer Registration until Subscription Successful
            // -------------------------------------------------------------
            if (!isBotSchool) {
                0 && console.log('[AuthOverlay] Deferring registration until subscription is successfull');
                setPendingRegistration({
                    docId,
                    password,
                    registrationData,
                    targetIndex
                });
                setPendingSchoolName(schoolName);
                setShowRegistrationPending(true);
                return;
            }

            // BOT/DEBUG MODE: Register immediately as before
            const result = await loginOrRegisterSchool(docId, password, registrationData, true, targetIndex);

            // -------------------------------------------------------------
            // DEBUG AUTOMATION: Create Trial Subscription for Bot/Dummy Schools
            // -------------------------------------------------------------
            // @ts-ignore
            if ((import.meta as any).env.DEV && isBotSchool) {
                try {
                    const baseName = docId.split('_')[0].toLowerCase();
                    const subRef = doc(db, 'subscriptions', baseName);
                    await loggedSetDoc(subRef, {
                        maxClass: 9999,
                        maxStudents: 9999,
                        expiryDate: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)), // 30 days
                        activationHash: 'c93a215026f36ac783bcac8ba5e4bbea1c3cdb6c79d3824f9712143c44dbb0f3' // Match portal default for debug
                    }, { merge: true }, `AuthOverlay/createBotSubscription/${baseName}`);
                    0 && console.log(`[AuthOverlay] 🤖 Bot: Trial subscription created for ${baseName}`);
                } catch (subError) {
                    console.error('[AuthOverlay] ❌ Failed to create bot subscription:', subError);
                }
            }

            // HANDLE DATABASE SWITCH IF NEEDED (Bots)
            if (result.status === 'success' && targetIndex !== ACTIVE_DATABASE_INDEX) {
                console.warn(`[AuthOverlay] Registration successful on DB ${targetIndex}. Switching context...`);
                localStorage.setItem('active_database_index', targetIndex.toString());
                localStorage.setItem('sba_school_id', result.docId || docId);
                localStorage.setItem('sba_school_password', password);
                window.location.reload();
                return;
            }

            // SUCCESS HANDLER (Bots)
            if (result.status === 'success' && result.data) {
                0 && console.log('[AuthOverlay] ✅ School registered successfully (Bot Mode)');
                loadImportedData(result.data, true, (result as any).subscription);
                setSchoolData(result.data);
                setCurrentSchoolId(result.docId || docId);
                setSchoolId(result.docId || docId);
                localStorage.setItem('sba_school_id', result.docId || docId);
                localStorage.setItem('sba_school_password', password);
                clearAuthCaches();

                // -------------------------------------------------------------
                // DEBUG AUTOMATION: Auto-login for Dummy School
                // -------------------------------------------------------------
                // @ts-ignore - DEV and VITE_USE_EMULATOR exist in Vite env
                        if (((import.meta as any).env.DEV || (import.meta as any).env.VITE_USE_EMULATOR === 'true') && schoolName === 'Dummy School') {
                    try {
                        0 && console.log('[AuthOverlay] 🤖 Debug Mode: Auto-logging in as admin...');
                        setUsers(usersArray);
                        const loginSuccess = await login(1, 'password', usersArray[0]);
                        if (!loginSuccess) throw new Error('Login returned false');
                        await setUserPassword(1, 'password');
                        localStorage.setItem('sba_user_id', '1');
                        localStorage.setItem('sba_user_password', 'password');
                        setCurrentStep('authenticated');
                        resumeSync();
                    } catch (loginError) {
                        console.error('[AuthOverlay] ❌ Debug auto-login failed:', loginError);
                        setUsers(usersArray);
                        setCurrentStep('user-selection');
                    }
                } else {
                    const hasUsers = result.data.users && result.data.users.length > 0;
                    if (!hasUsers) {
                        setCurrentStep('admin-setup');
                    } else {
                        setUsers(result.data.users);
                        setCurrentStep('user-selection');
                    }
                }
            } else {
                console.error('[AuthOverlay] ❌ Registration failed:', result.message || result.status);
                alert(result.message || `Registration failed: ${result.status}`);
            }
        } catch (error) {
            console.error('[AuthOverlay] Registration error:', error);
            alert('Failed to register school. Please try again.');
        }
    };

    const handleRegistrationComplete = async (data: AppDataType, docId: string, _password: string, _subscription: any) => {
        0 && console.log('[AuthOverlay] ✅ Deferred registration successful:', docId);

        // 1. Clear modal and registration states
        setShowRegistrationPending(false);
        setIsSubscriptionModalOpen(false);
        setPendingRegistration(null);

        // 2. Track as last accessed so it appears at the top of the school list
        const schoolMetadata = {
            docId,
            displayName: data.settings?.schoolName || docId,
            _databaseIndex: pendingRegistration?.targetIndex || 1
        };
        localStorage.setItem('sba_last_accessed_school', JSON.stringify(schoolMetadata));
        localStorage.setItem('sba_last_accessed_school_id', docId); // Backward compatibility if needed

        // 3. Purge auth cache to ensure the new school shows up in search/listing
        clearAuthCaches();

        // 4. Notify the user with a single custom MessageBox then return to the school selection page
        await showMsg({
            title: 'Registration Successful',
            message: `Registration and payment were successful. ${data.settings?.schoolName || ''} is now registered.\n\nPlease continue by selecting it from the school list and logging in.`,
            confirmText: 'Continue',
            hideCancel: true,
            variant: 'success'
        });

        setSelectedSchool(null);
        setSelectedPeriod(null);
        setCurrentStep('school-list');
    };

    const handleBackToWelcome = () => {
        setSelectedSchool(null);
        setSelectedPeriod(null);
        setCurrentStep('welcome');
    };

    const handleBackToSchoolList = () => {
        setSelectedSchool(null);
        setCurrentStep('school-list');
    };

    const handleBackToPassword = () => {
        setSelectedPeriod(null);
        setCurrentStep('password');
    };

    // ========== LOGIN EXECUTION ==========

    const executeLogin = async (docId: string) => {
        try {
            0 && console.log('[AuthOverlay] 🔐 Executing login for:', docId);
            SyncLogger.log(`Attempting login for: ${docId}`);

            // Use the verified password from PasswordScreen
            const result = await loginOrRegisterSchool(docId, verifiedPassword, {} as AppDataType, false);

            if (result.status !== 'success') {
                console.error('[AuthOverlay] ❌ Login failed:', result.message || result.status);

                if (result.status === 'expired') {
                    // Show expiry dialog before modal
                    setPendingSchoolName(result.data?.settings?.schoolName || docId.split('_')[0]);
                    setShowSubscriptionExpired(true);
                } else {
                    alert(result.message || `Login failed: ${result.status}`);
                }
                return;
            }

            if (!result.data) {
                console.error('[AuthOverlay] ❌ No data returned');
                alert('Failed to load school data');
                return;
            }

            0 && console.log('[AuthOverlay] ✅ School data loaded successfully');

            // Load data into context
            loadImportedData(result.data, true, (result as any).subscription);
            setSchoolData(result.data);
            setCurrentSchoolId(result.docId || docId);
            setSchoolId(result.docId || docId);

            // Save school credentials
            localStorage.setItem('sba_school_id', result.docId || docId);
            localStorage.setItem('sba_school_password', verifiedPassword);

            // Check if admin setup is needed
            const hasUsers = result.data.users && result.data.users.length > 0;
            if (!hasUsers) {
                0 && console.log('[AuthOverlay] No users found - proceeding to admin setup');
                setCurrentStep('admin-setup');
            } else {
                0 && console.log('[AuthOverlay] Users found - proceeding to user selection');
                setUsers(result.data.users);
                setCurrentStep('user-selection');
            }
        } catch (error) {
            console.error('[AuthOverlay] Login error:', error);
            alert('Login failed. Please try again.');
        }
    };

    // ========== ADMIN SETUP HANDLER ==========

    const handleAdminSetup = async (users: User[], adminPassword?: string) => {
        try {
            0 && console.log('[AuthOverlay] 👤 Setting up admin user');

            // In setup mode, we expect at least one user (the admin) and a password
            if (users.length === 0 || !adminPassword) {
                throw new Error('Invalid admin setup data');
            }

            const adminUser = users[0];

            setUsers(users);

            // Update school data with new users
            if (currentSchoolId) {
                // Explicitly save to Firestore first to ensure persistence
                const { updateUsers } = await import('../services/firebaseService');
                await updateUsers(currentSchoolId, users);
                0 && console.log('[AuthOverlay] ✅ Users saved to Firestore');

                // Then update local state which might trigger dirty check but data is already safe
                loadImportedData({ users: users }, true);
            }

            // Auto-login as admin - call UserContext.login with (userId, password, userOverride)
            let loginSuccess = await login(adminUser.id, adminPassword, adminUser);

            if (!loginSuccess) {
                0 && console.log('[AuthOverlay] 🔁 Initial admin login failed, retrying after setting password');
                await setUserPassword(adminUser.id, adminPassword);
                loginSuccess = await login(adminUser.id, adminPassword, adminUser);
            }

            if (!loginSuccess) {
                throw new Error('Auto-login failed after admin setup');
            }

            // Save user credentials
            localStorage.setItem('sba_user_id', adminUser.id.toString());
            localStorage.setItem('sba_user_password', adminPassword);

            // Complete authentication
            setCurrentStep('authenticated');
            resumeSync();

            0 && console.log('[AuthOverlay] ✅ Admin setup complete - authenticated');
        } catch (error) {
            console.error('[AuthOverlay] Admin setup error:', error);
            alert('Failed to set up admin user');
        }
    };

    // ========== USER SELECTION HANDLERS ==========

    const handleUserLogin = async (userId: number, password: string): Promise<boolean> => {
        try {
            const user = users.find(u => u.id === userId);
            if (!user) {
                console.error('[AuthOverlay] User not found:', userId);
                return false;
            }

            0 && console.log('[AuthOverlay] 👤 User logged in:', user.name);

            // Verify password hash
            const { hashPassword } = await import('../services/authService');
            const hashedInput = await hashPassword(password);

            // Dev/Emulator Bypass
            // @ts-ignore
            const isDev = import.meta.env.DEV || import.meta.env.VITE_USE_EMULATOR === 'true';

            if (user.passwordHash !== hashedInput && !(isDev && password === 'devadmin')) {
                console.warn('[AuthOverlay] Password mismatch for user:', user.name);
                return false;
            }

            // Login successful - call UserContext.login with (userId, password)
            await login(user.id, password);
            await setUserPassword(user.id, password);

            // Save user credentials
            localStorage.setItem('sba_user_id', user.id.toString());
            localStorage.setItem('sba_user_password', password);

            // Complete authentication
            setCurrentStep('authenticated');
            resumeSync();

            0 && console.log('[AuthOverlay] ✅ User authentication complete');
            return true;
        } catch (error) {
            console.error('[AuthOverlay] User login error:', error);
            return false;
        }
    };

    const handleSetPassword = async (userId: number, password: string): Promise<void> => {
        try {
            const user = users.find(u => u.id === userId);
            if (!user) {
                throw new Error('User not found');
            }

            0 && console.log('[AuthOverlay] 🔑 Setting password for user:', user.name);

            // Hash the password
            const { hashPassword } = await import('../services/authService');
            const hashedPassword = await hashPassword(password);

            // Update user with hashed password
            const updatedUser = { ...user, passwordHash: hashedPassword };
            const updatedUsers = users.map(u => u.id === userId ? updatedUser : u);
            setUsers(updatedUsers);

            // Save to cloud
            if (currentSchoolId) {
                const { updateUsers } = await import('../services/firebaseService');
                await updateUsers(currentSchoolId, updatedUsers);
            }

            // Auto-login after setting password - call UserContext.login with (userId, password, userOverride)
            await login(user.id, password, updatedUser);
            await setUserPassword(user.id, password);

            // Save user credentials
            localStorage.setItem('sba_user_id', user.id.toString());
            localStorage.setItem('sba_user_password', password);

            // Complete authentication
            setCurrentStep('authenticated');
            resumeSync();

            0 && console.log('[AuthOverlay] ✅ Password set and user authenticated');
        } catch (error) {
            console.error('[AuthOverlay] Set password error:', error);
            throw error;
        }
    };

    // ========== RENDER ==========

    const renderAuthContent = () => {
        // Show loading state while restoring session or checking license
        if (restoringSession || isCheckingLicense) {
            return (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-95 z-50 flex items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
                        <p className="text-white text-lg">{restoringSession ? 'Restoring session...' : 'Verifying school license...'}</p>
                    </div>
                </div>
            );
        }

        // Show session restore dialog
        if (showSessionRestore && sessionInfo) {
            return (
                <SessionRestoreDialog
                    schoolName={sessionInfo.schoolName}
                    userName={sessionInfo.userName}
                    academicYear={sessionInfo.academicYear}
                    academicTerm={sessionInfo.academicTerm}
                    onContinue={handleContinueSession}
                    onLogout={handleLogoutSession}
                />
            );
        }

        // Show registration pending dialog
        if (showRegistrationPending && pendingRegistration) {
            return (
                <RegistrationPendingDialog
                    schoolName={pendingSchoolName}
                    onSubscribe={() => setIsSubscriptionModalOpen(true)}
                    onClose={() => {
                        setShowRegistrationPending(false);
                        setPendingSchoolName('');
                        setCurrentStep('school-list');
                    }}
                />
            );
        }

        switch (currentStep) {
            case 'welcome':
                return (
                    <WelcomeScreen
                        onLogin={handleLoginClick}
                        onRegister={handleRegisterClick}
                        onSubscribe={() => setIsSubscriptionModalOpen(true)}
                    />
                );
            case 'school-list':
                return (
                    <SchoolListScreen
                        onSelectSchool={handleSchoolSelect}
                        onBack={handleBackToWelcome}
                    />
                );
            case 'password':
                return (
                    <PasswordScreen
                        school={selectedSchool!}
                        onPasswordVerified={handlePasswordVerified}
                        onBack={handleBackToSchoolList}
                    />
                );
            case 'year-term':
                return (
                    <YearTermSelector
                        school={selectedSchool!}
                        onSelectPeriod={handlePeriodSelect}
                        onBack={handleBackToPassword}
                    />
                );
            case 'register':
                return (
                    <RegistrationForm
                        onRegister={handleRegistration}
                        onBack={handleBackToWelcome}
                    />
                );
            case 'admin-setup':
                return (
                    <AdminSetup
                        mode="setup"
                        users={users}
                        onComplete={handleAdminSetup}
                        onCancel={handleLogoutSession}
                        isFetching={isFetching}
                    />
                );
            case 'user-selection':
                return (
                    <UserSelection
                        users={sortedUsers}
                        onLogin={handleUserLogin}
                        onSetPassword={handleSetPassword}
                        onBack={handleLogoutSession}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <>
            <div className="relative">
                {renderAuthContent()}
                
                {/* Subscription Modal (Accessible even when not logged in) */}
                {isSubscriptionModalOpen && (
                    <SubscriptionRequestModal
                        isOpen={isSubscriptionModalOpen}
                        onClose={() => {
                            setIsSubscriptionModalOpen(false);
                        }}
                        initialSchoolName={selectedSchool?.displayName || pendingSchoolName || ''}
                        pendingRegistration={pendingRegistration}
                        onSuccess={async (data, docId, password, sub) => {
                            if (pendingRegistration) {
                                await handleRegistrationComplete(data, docId, password, sub);
                                return;
                            }

                            setIsSubscriptionModalOpen(false);

                            await showMsg({
                                title: 'Subscription Activated',
                                message: 'Payment was successful and your professional tier is now active. Please continue by selecting your school from the list below.',
                                confirmText: 'Continue',
                                hideCancel: true,
                                variant: 'success'
                            });

                            setSelectedSchool(null);
                            setSelectedPeriod(null);
                            setCurrentStep('school-list');
                        }}
                    />
                )}

                {/* Expiry Dialog Overlay */}
                {showSubscriptionExpired && (
                    <SubscriptionExpiredDialog
                        schoolName={pendingSchoolName}
                        onReactivate={() => {
                            setShowSubscriptionExpired(false);
                            setIsSubscriptionModalOpen(true);
                        }}
                        onClose={() => {
                            setShowSubscriptionExpired(false);
                            setSelectedSchool(null);
                            setCurrentStep('school-list');
                        }}
                    />
                )}
                <MessageBox {...messageBox} />
            </div>
            
            {/* Main Application Content (Authenticated state handling) */}
            {currentStep === 'authenticated' && (
                isAuthenticated ? (
                    <div className="min-h-screen bg-slate-50">
                        {children}
                    </div>
                ) : (
                    users.length > 0 && (
                        <UserSelection
                            users={sortedUsers}
                            onLogin={handleUserLogin}
                            onSetPassword={handleSetPassword}
                            onBack={handleLogoutSession}
                        />
                    )
                )
            )}
        </>
    );
};

export default AuthOverlay;
