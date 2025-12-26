import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useUser } from '../context/UserContext';
import { loginOrRegisterSchool, AppDataType, SchoolListItem, SchoolPeriod, clearAuthCaches } from '../services/firebaseService';
import * as SyncLogger from '../services/syncLogger';
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
import AdminSetup from './AdminSetup';
import UserSelection from './UserSelection';

type AuthStep = 'welcome' | 'school-list' | 'password' | 'year-term' | 'register' | 'admin-setup' | 'user-selection' | 'authenticated';

interface AuthOverlayProps {
    children?: React.ReactNode;
}

const AuthOverlay: React.FC<AuthOverlayProps> = ({ children }) => {
    const { loadImportedData, setSchoolId, pauseSync, resumeSync } = useData();
    const { setUsers, users, login, setPassword: setUserPassword, checkAutoLogin, isAuthenticated } = useUser();

    // Navigation state
    const [currentStep, setCurrentStep] = useState<AuthStep>('welcome');
    const [selectedSchool, setSelectedSchool] = useState<SchoolListItem | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState<SchoolPeriod | null>(null);
    const [verifiedPassword, setVerifiedPassword] = useState<string>(''); // Store password after verification
    const [schoolData, setSchoolData] = useState<AppDataType | null>(null);
    const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
    const [showSessionRestore, setShowSessionRestore] = useState<boolean>(false);
    const [sessionInfo, setSessionInfo] = useState<{ schoolName: string; userName: string } | null>(null);
    const [showRegistrationPending, setShowRegistrationPending] = useState<boolean>(false);
    const [pendingSchoolName, setPendingSchoolName] = useState<string>('');

    // Loading state
    const [restoringSession, setRestoringSession] = useState(true);

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
        if (currentStep !== 'authenticated') {
            console.log('[AuthOverlay] Pausing sync - authentication in progress');
            pauseSync();
        }
    }, [currentStep, pauseSync]);

    // Restore session on mount
    useEffect(() => {
        const restoreSession = async () => {
            try {
                // -------------------------------------------------------------
                // 1. CHECK FOR PENDING SELECTION (Active DB Switch)
                // -------------------------------------------------------------
                const pendingSelectionStr = localStorage.getItem('pending_school_selection');
                if (pendingSelectionStr) {
                    console.log('[AuthOverlay] 🔄 Found pending school selection (DB Switch)');
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
                        console.log('[AuthOverlay] ✅ Restored pending selection:', pendingSchool.docId);

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
                const savedSchoolId = localStorage.getItem('sba_school_id');
                const savedSchoolPassword = localStorage.getItem('sba_school_password');
                const savedUserId = localStorage.getItem('sba_user_id');
                const savedUserPassword = localStorage.getItem('sba_user_password');

                if (!savedSchoolId || !savedSchoolPassword || !savedUserId || !savedUserPassword) {
                    console.log('[AuthOverlay] No saved session found');
                    return;
                }

                console.log('[AuthOverlay] Found saved session, fetching school data...');

                // DATABASE SWITCH CHECK:
                // If the saved school ID implies a specific database (e.g. 'ayirebida' -> Index 2),
                // we must ensure we are on the correct database index.
                const { SCHOOL_DATABASE_MAPPING, ACTIVE_DATABASE_INDEX } = await import('../constants');
                const schoolPrefix = savedSchoolId.split('_')[0].toLowerCase();
                const requiredIndex = SCHOOL_DATABASE_MAPPING[schoolPrefix];

                if (requiredIndex && requiredIndex !== ACTIVE_DATABASE_INDEX) {
                    console.warn(`[AuthOverlay] Database mismatch for ${savedSchoolId}. Switching to Index ${requiredIndex}...`);
                    localStorage.setItem('active_database_index', requiredIndex.toString());
                    window.location.reload(); // Reload to initialize Firebase with new config
                    return;
                }

                // Fetch school data
                const result = await loginOrRegisterSchool(savedSchoolId, savedSchoolPassword, {} as AppDataType, false);

                if (result.status !== 'success' || !result.data) {
                    console.error('[AuthOverlay] Failed to restore session:', result.status);

                    if (result.status === 'expired') {
                        alert('Your school license has expired. Please renew your subscription to continue.');
                    }

                    // Clear invalid or expired session
                    localStorage.removeItem('sba_school_id');
                    localStorage.removeItem('sba_school_password');
                    localStorage.removeItem('sba_user_id');
                    localStorage.removeItem('sba_user_password');
                    return;
                }

                // Find the user
                const user = result.data.users?.find(u => u.id === parseInt(savedUserId));
                if (!user) {
                    console.error('[AuthOverlay] User not found in school data');
                    return;
                }

                // Load school data
                loadImportedData(result.data);
                setSchoolData(result.data);
                setCurrentSchoolId(result.docId || savedSchoolId);
                setSchoolId(result.docId || savedSchoolId);
                setUsers(result.data.users || []);

                // Show session restore dialog
                setSessionInfo({
                    schoolName: result.data.settings?.schoolName || 'Unknown School',
                    userName: user.name
                });
                setShowSessionRestore(true);

                console.log('[AuthOverlay] Session data loaded, showing restore dialog');
            } catch (error) {
                console.error('[AuthOverlay] Session restore error:', error);
            } finally {
                setRestoringSession(false);
            }
        };

        restoreSession();
    }, []);

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
                console.log('[AuthOverlay] ✅ Session restored successfully');
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

        console.log('[AuthOverlay] Session cleared, starting fresh');
    };

    // ========== NAVIGATION HANDLERS ==========

    const handleRegisterClick = () => {
        setCurrentStep('register');
    };

    const handleLoginClick = () => {
        setCurrentStep('school-list');
    };

    const handleSchoolSelect = (school: SchoolListItem) => {
        setSelectedSchool(school);
        setCurrentStep('password');
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
        year: string,
        term: string,
        password: string,
        docId: string
    ) => {
        try {
            console.log('[AuthOverlay] 📝 Registering new school:', schoolName);

            // -------------------------------------------------------------
            // DEBUG AUTOMATION: Pre-create admin for Dummy School
            // -------------------------------------------------------------
            let usersArray: User[] = [];
            // @ts-ignore - DEV and VITE_USE_EMULATOR exist in Vite env
            if ((import.meta.env.DEV || import.meta.env.VITE_USE_EMULATOR === 'true') && schoolName === 'Dummy School') {
                console.log('[AuthOverlay] 🤖 Debug Mode: Pre-creating admin for Dummy School...');
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
                Access: true,
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
                    alert(`This school is already registered as "${duplicate.displayName}".\n\nPlease select it from the School List instead of registering again.`);
                    return;
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
                    // FAIR DISTRIBUTION: Weight selection inversely by current count
                    // Get current school count per database from the cached list
                    const dbCounts: { [key: number]: number } = {};
                    publicIndices.forEach(idx => dbCounts[idx] = 0);

                    existingSchools.forEach(school => {
                        const idx = school._databaseIndex;
                        if (idx !== undefined && dbCounts[idx] !== undefined) {
                            dbCounts[idx]++;
                        }
                    });

                    // Calculate weights (inverse of count + 1 to avoid division by zero)
                    const weights = publicIndices.map(idx => 1 / (dbCounts[idx] + 1));
                    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

                    // Weighted random selection
                    let random = Math.random() * totalWeight;
                    targetIndex = publicIndices[0]; // Fallback

                    for (let i = 0; i < publicIndices.length; i++) {
                        random -= weights[i];
                        if (random <= 0) {
                            targetIndex = publicIndices[i];
                            break;
                        }
                    }

                    console.log(`[AuthOverlay] Fair distribution selected DB ${targetIndex}. Current counts:`, dbCounts);
                } else {
                    targetIndex = 1; // Fallback to primary
                }
            }

            console.log(`[AuthOverlay] Targeted Database Index: ${targetIndex} for ${docId}`);

            // Register school: loginOrRegisterSchool(docId, password, initialData, createIfMissing, targetDbIndex)
            const result = await loginOrRegisterSchool(docId, password, initialData, true, targetIndex);

            // -------------------------------------------------------------
            // DEBUG AUTOMATION: Create Trial Subscription for Dummy School
            // -------------------------------------------------------------
            // @ts-ignore
            if ((import.meta.env.DEV || import.meta.env.VITE_USE_EMULATOR === 'true') && schoolName === 'Dummy School') {
                try {
                    const { db } = await import('../services/firebaseService');
                    const { doc, setDoc, Timestamp } = await import('firebase/firestore');
                    const baseName = docId.split('_')[0];
                    const subRef = doc(db, 'subscriptions', baseName);

                    await setDoc(subRef, {
                        maxClass: 9999,
                        maxStudents: 9999,
                        expiryDate: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)), // 30 days
                        activationHash: 'c93a215026f36ac783bcac8ba5e4bbea1c3cdb6c79d3824f9712143c44dbb0f3' // Match portal default for debug
                    }, { merge: true });
                    console.log(`[AuthOverlay] 🤖 Debug: Trial subscription created for ${baseName}`);
                } catch (subError) {
                    console.error('[AuthOverlay] ❌ Failed to create debug subscription:', subError);
                }
            }

            // -------------------------------------------------------------
            // HANDLE DATABASE SWITCH IF NEEDED
            // -------------------------------------------------------------
            if (result.status === 'success' && targetIndex !== ACTIVE_DATABASE_INDEX) {
                console.warn(`[AuthOverlay] Registration successful on DB ${targetIndex}. Switching context...`);

                // Save context and credentials
                localStorage.setItem('active_database_index', targetIndex.toString());
                localStorage.setItem('sba_school_id', result.docId || docId);
                localStorage.setItem('sba_school_password', password);

                // Force reload to switch database
                window.location.reload();
                return;
            }

            if (result.status === 'success' && result.data) {
                console.log('[AuthOverlay] ✅ School registered successfully');

                // Load data and proceed to admin setup
                loadImportedData(result.data);
                setSchoolData(result.data);
                setCurrentSchoolId(result.docId || docId);
                setSchoolId(result.docId || docId);

                // Save credentials
                localStorage.setItem('sba_school_id', result.docId || docId);
                localStorage.setItem('sba_school_password', password);

                // Clear auth caches
                clearAuthCaches();

                // -------------------------------------------------------------
                // DEBUG AUTOMATION: Auto-login for Dummy School
                // -------------------------------------------------------------
                // @ts-ignore - DEV and VITE_USE_EMULATOR exist in Vite env
                if ((import.meta.env.DEV || import.meta.env.VITE_USE_EMULATOR === 'true') && schoolName === 'Dummy School') {
                    try {
                        console.log('[AuthOverlay] 🤖 Debug Mode: Auto-logging in as admin...');
                        setUsers(usersArray);

                        // Auto-login as the pre-created admin
                        const loginSuccess = await login(1, 'password', usersArray[0]);

                        if (!loginSuccess) {
                            throw new Error('Login returned false');
                        }

                        setUserPassword('password');

                        // Save user credentials (ignore quota errors - not critical for debug)
                        try {
                            localStorage.setItem('sba_user_id', '1');
                            localStorage.setItem('sba_user_password', 'password');
                        } catch (storageError) {
                            console.warn('[AuthOverlay] ⚠️ Could not save credentials to localStorage (quota exceeded)');
                        }

                        // Complete authentication
                        setCurrentStep('authenticated');
                        resumeSync();

                        console.log('[AuthOverlay] ✅ Debug auto-login complete');
                    } catch (loginError) {
                        console.error('[AuthOverlay] ❌ Debug auto-login failed:', loginError);
                        // Fallback: go to user selection screen
                        setUsers(usersArray);
                        setCurrentStep('user-selection');
                    }
                } else {
                    // Normal flow: check if admin setup is needed
                    const hasUsers = result.data.users && result.data.users.length > 0;
                    if (!hasUsers) {
                        console.log('[AuthOverlay] No users found - proceeding to admin setup');
                        setCurrentStep('admin-setup');
                    } else {
                        console.log('[AuthOverlay] Users found - proceeding to user selection');
                        setUsers(result.data.users);
                        setCurrentStep('user-selection');
                    }
                }

            } else if (result.status === 'created_pending_access') {
                console.log('[AuthOverlay] ✅ School created, pending activation');

                // DEBUG OVERRIDE: If debug mode, we can force access? 
                // Actually if we passed Access:true in initialData (which we do if we modify initialData above?), 
                // checking result.status...
                // But handleRegistration sets Access:true in initialData locally:
                // Access: true (line 224). 
                // So likely it won't be 'created_pending_access' unless server overrides.
                // But if it DOES return pending (e.g. security rules), we handle it.

                // @ts-ignore - DEV and VITE_USE_EMULATOR exist in Vite env
                if ((import.meta.env.DEV || import.meta.env.VITE_USE_EMULATOR === 'true') && schoolName === 'Dummy School') {
                    // Force Admin Setup anyway? No, if pending, we can't login usually.
                    // But for emulator, we might want to allow it.
                    console.log('[AuthOverlay] 🤖 Debug Mode: Ignoring pending status for Dummy School');
                    // We would need to set Access=true in DB if server denied it?
                    // Assuming initialData.Access = true works in Emulator.
                }

                // Show registration pending dialog
                setPendingSchoolName(schoolName);
                setShowRegistrationPending(true);

                // Clear auth caches
                clearAuthCaches();
            } else {
                console.error('[AuthOverlay] ❌ Registration failed:', result.message || result.status);
                alert(result.message || `Registration failed: ${result.status}`);
            }
        } catch (error) {
            console.error('[AuthOverlay] Registration error:', error);
            alert('Failed to register school. Please try again.');
        }
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
            console.log('[AuthOverlay] 🔐 Executing login for:', docId);
            SyncLogger.log(`Attempting login for: ${docId}`);

            // Use the verified password from PasswordScreen
            const result = await loginOrRegisterSchool(docId, verifiedPassword, {} as AppDataType, false);

            if (result.status !== 'success') {
                console.error('[AuthOverlay] ❌ Login failed:', result.message || result.status);

                if (result.status === 'expired') {
                    alert(result.message || 'Your school license has expired. Please renew your subscription through the License Portal.');
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

            console.log('[AuthOverlay] ✅ School data loaded successfully');

            // Load data into context
            loadImportedData(result.data);
            setSchoolData(result.data);
            setCurrentSchoolId(result.docId || docId);
            setSchoolId(result.docId || docId);

            // Save school credentials
            localStorage.setItem('sba_school_id', result.docId || docId);
            localStorage.setItem('sba_school_password', verifiedPassword);

            // Check if admin setup is needed
            const hasUsers = result.data.users && result.data.users.length > 0;
            if (!hasUsers) {
                console.log('[AuthOverlay] No users found - proceeding to admin setup');
                setCurrentStep('admin-setup');
            } else {
                console.log('[AuthOverlay] Users found - proceeding to user selection');
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
            console.log('[AuthOverlay] 👤 Setting up admin user');

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
                console.log('[AuthOverlay] ✅ Users saved to Firestore');

                // Then update local state which might trigger dirty check but data is already safe
                loadImportedData({ users: users }, false);
            }

            // Auto-login as admin - call UserContext.login with (userId, password, userOverride)
            await login(adminUser.id, adminPassword, adminUser);
            setUserPassword(adminPassword);

            // Save user credentials
            localStorage.setItem('sba_user_id', adminUser.id.toString());
            localStorage.setItem('sba_user_password', adminPassword);

            // Complete authentication
            setCurrentStep('authenticated');
            resumeSync();

            console.log('[AuthOverlay] ✅ Admin setup complete - authenticated');
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

            console.log('[AuthOverlay] 👤 User logged in:', user.name);

            // Verify password hash
            const { hashPassword } = await import('../services/authService');
            const hashedInput = await hashPassword(password);

            if (user.passwordHash !== hashedInput) {
                console.warn('[AuthOverlay] Password mismatch for user:', user.name);
                return false;
            }

            // Login successful - call UserContext.login with (userId, password)
            await login(user.id, password);
            setUserPassword(password);

            // Save user credentials
            localStorage.setItem('sba_user_id', user.id.toString());
            localStorage.setItem('sba_user_password', password);

            // Complete authentication
            setCurrentStep('authenticated');
            resumeSync();

            console.log('[AuthOverlay] ✅ User authentication complete');
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

            console.log('[AuthOverlay] 🔑 Setting password for user:', user.name);

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

            // Auto-login after setting password - call UserContext.login with (userId, password)
            await login(user.id, password);
            setUserPassword(password);

            // Save user credentials
            localStorage.setItem('sba_user_id', user.id.toString());
            localStorage.setItem('sba_user_password', password);

            // Complete authentication
            setCurrentStep('authenticated');
            resumeSync();

            console.log('[AuthOverlay] ✅ Password set and user authenticated');
        } catch (error) {
            console.error('[AuthOverlay] Set password error:', error);
            throw error;
        }
    };

    // ========== RENDER ==========

    // Show loading state while restoring session
    if (restoringSession) {
        return (
            <div className="fixed inset-0 bg-gray-900 bg-opacity-95 z-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
                    <p className="text-white text-lg">Restoring session...</p>
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
                onContinue={handleContinueSession}
                onLogout={handleLogoutSession}
            />
        );
    }

    // Show registration pending dialog
    if (showRegistrationPending) {
        return (
            <RegistrationPendingDialog
                schoolName={pendingSchoolName}
                onClose={() => {
                    setShowRegistrationPending(false);
                    setPendingSchoolName('');
                    setCurrentStep('welcome');
                }}
            />
        );
    }

    if (currentStep === 'authenticated') {
        return <>{children}</>;
    }

    // Render appropriate screen based on current step
    switch (currentStep) {
        case 'welcome':
            return (
                <WelcomeScreen
                    onRegister={handleRegisterClick}
                    onLogin={handleLoginClick}
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
            return selectedSchool ? (
                <PasswordScreen
                    school={selectedSchool}
                    onPasswordVerified={handlePasswordVerified}
                    onBack={handleBackToSchoolList}
                />
            ) : null;

        case 'year-term':
            return selectedSchool ? (
                <YearTermSelector
                    school={selectedSchool}
                    onSelectPeriod={handlePeriodSelect}
                    onBack={handleBackToPassword}
                />
            ) : null;

        case 'register':
            return (
                <RegistrationForm
                    onRegister={handleRegistration}
                    onBack={handleBackToWelcome}
                />
            );

        case 'admin-setup':
            return (
                <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
                    <div className="w-full max-w-md">
                        <AdminSetup
                            mode="setup"
                            users={[]}
                            onComplete={handleAdminSetup}
                        />
                    </div>
                </div>
            );

        case 'user-selection':
            return (
                <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
                    <div className="w-full max-w-md">
                        <UserSelection
                            users={users}
                            onLogin={handleUserLogin}
                            onSetPassword={handleSetPassword}
                        />
                    </div>
                </div>
            );

        default:
            return null;
    }
};

export default AuthOverlay;
