import React, { useState, useEffect } from 'react';
import type { User, UserRole } from '../types';
import { useData } from '../context/DataContext';
import { hashPassword } from '../services/authService';
import ConfirmationModal from './ConfirmationModal';
import { useUser } from '../context/UserContext';

interface AdminSetupProps {
    mode: 'setup' | 'management';
    users: User[];
    currentUser?: User | null;
    onComplete: (users: User[], adminPassword?: string) => void;
    onUpdate?: (users: User[]) => void;
    onCancel?: () => void;
    externalError?: string | null; // Error from parent component
    isFetching?: boolean; // New prop to track background data loading
}

const AdminSetup: React.FC<AdminSetupProps> = ({ mode, users: initialUsers, currentUser, onComplete, onUpdate, onCancel, externalError, isFetching }) => {
    const [showCloseWarning, setShowCloseWarning] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const { classes, subjects } = useData();
    const { logout } = useUser();
    const [users, setUsers] = useState<Partial<User>[]>(mode === 'setup' ? [{ role: 'Admin' as UserRole, allowedClasses: [], allowedSubjects: [] }] : []);
    const [existingUsers, setExistingUsers] = useState<User[]>(initialUsers);
    const [adminPassword, setAdminPassword] = useState('');
    const [isApplyingChanges, setIsApplyingChanges] = useState(false);

    // Update local state when prop changes (e.g. after data load)
    useEffect(() => {
        // PROTECTION: Only pull from props if we don't have local unsaved changes
        // OR if the list was previously empty (initial load completion).
        // This prevents remote updates from wiping out work-in-progress deletions/toggles.
        if (!hasUnsavedChanges || (existingUsers.length === 0 && initialUsers.length > 0)) {
            setExistingUsers(initialUsers);
        }
    }, [initialUsers]);
    // Track unsaved changes
    useEffect(() => {
        setHasUnsavedChanges(JSON.stringify(existingUsers) !== JSON.stringify(initialUsers));
    }, [existingUsers, initialUsers]);
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [editingUserId, setEditingUserId] = useState<number | null>(null);
    const [deleteConfirmUserId, setDeleteConfirmUserId] = useState<number | null>(null);
    const [resetConfirmUserId, setResetConfirmUserId] = useState<number | null>(null);
    const [selectedUserForActions, setSelectedUserForActions] = useState<number | null>(null);
    const [showLogs, setShowLogs] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const { userLogs } = useData();

    const subjectList = React.useMemo(() => {
        return subjects.map(s => ({
            id: s.id,
            name: s.subject,
            displayName: s.subject // Only show the name as requested
        }));
    }, [subjects]);

    const classNames = React.useMemo(() => {
        return classes.map(c => c.name).sort((a, b) => {
            return a.localeCompare(b, undefined, {
                numeric: true,
                sensitivity: 'base'
            });
        });
    }, [classes]);

    // Ref for auto-scrolling to bottom of user list
    const userListRef = React.useRef<HTMLDivElement>(null);
    // Ref for main modal to ensure new forms are visible
    const modalRef = React.useRef<HTMLDivElement>(null);
    // Ref for the scrollable existing users list container
    const existingUsersListRef = React.useRef<HTMLDivElement>(null);
    // State to preserve scroll position when opening/closing forms
    const [savedScrollPosition, setSavedScrollPosition] = useState<number>(0);

    // Auto-scroll to bottom when users are added
    useEffect(() => {
        // Scroll main modal to ensure the new section is visible
        if (modalRef.current) {
            modalRef.current.scrollTo({ top: modalRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [users.length]);

    // Manual data refresh handler
    const handleRefreshData = async () => {
        setIsRefreshing(true);
        setError(null);
        try {
            // Force a fresh fetch from Firebase by temporarily clearing the activity timestamp
            // This allows the Firebase subscription to pull latest data
            0 && console.log('[AdminSetup] Manually refreshing data from Firebase...');

            // The data will update automatically through the DataContext subscription
            // We just need to wait a moment for it to propagate
            await new Promise(resolve => setTimeout(resolve, 1000));

            0 && console.log('[AdminSetup] Data refresh complete');
            setError('✅ Data refreshed successfully!');
            setTimeout(() => setError(null), 2000);
        } catch (err) {
            console.error('Error refreshing data:', err);
            setError('Failed to refresh data. Please try again.');
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleApplyChanges = async () => {
        if (isFetching && existingUsers.length === 0) {
            setError('⏳ Still fetching users from cloud. Please wait...');
            return;
        }
        if (existingUsers.length === 0) {
            setError('Cannot save: no users to apply. Please add at least the admin user.');
            return;
        }

        setError(null);
        setIsApplyingChanges(true);
        try {
            await onComplete(existingUsers);
            setError('✅ User changes saved to cloud. You may now close this window.');
        } catch (err) {
            console.error('Failed to apply user changes:', err);
            setError('Failed to apply user changes. Please try again.');
        } finally {
            setIsApplyingChanges(false);
        }
    };

    const addNewUser = () => {
        // Save current scroll position before opening add form
        if (existingUsersListRef.current) {
            setSavedScrollPosition(existingUsersListRef.current.scrollTop);
        }
        setUsers([...users, { role: 'Teacher' as UserRole, allowedClasses: [], allowedSubjects: [] }]);
    };

    const removeUser = (index: number) => {
        setUsers(users.filter((_, i) => i !== index));
    };

    const updateUser = (index: number, field: keyof User, value: any) => {
        const updated = [...users];
        updated[index] = { ...updated[index], [field]: value };
        setUsers(updated);
    };

    const toggleClass = (index: number, className: string) => {
        const user = users[index];
        const currentClasses = user.allowedClasses || [];
        const newClasses = currentClasses.includes(className)
            ? currentClasses.filter(c => c !== className)
            : [...currentClasses, className];
        newClasses.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        updateUser(index, 'allowedClasses', newClasses);
    };

    const toggleSubject = (index: number, subjectId: number) => {
        const user = users[index];
        const currentSubjects = user.allowedSubjects || [];
        const newSubjects = currentSubjects.includes(subjectId)
            ? currentSubjects.filter(s => s !== subjectId)
            : [...currentSubjects, subjectId];
        updateUser(index, 'allowedSubjects', newSubjects);
    };

    const toggleAllClasses = (index: number) => {
        const user = users[index];
        const allSelected = (user.allowedClasses || []).length === classNames.length;
        updateUser(index, 'allowedClasses', allSelected ? [] : [...classNames]);
    };

    const toggleAllSubjects = (index: number) => {
        const user = users[index];
        const allSelected = (user.allowedSubjects || []).length === subjectList.length;
        updateUser(index, 'allowedSubjects', allSelected ? [] : subjectList.map(s => s.id));
    };

    const toggleClassSubject = (userIndex: number, className: string, subjectId: number) => {
        const user = users[userIndex];
        const classSubjects = user.classSubjects || {};
        const currentSubjectsRaw = classSubjects[className] || [];

        // NORMALIZE: Ensure we are working with IDs
        const currentSubjects = currentSubjectsRaw.map(s => {
            if (typeof s === 'number') return s;
            const found = subjects.find(sub => sub.subject === s);
            return found ? found.id : null;
        }).filter(s => s !== null) as number[];

        const newSubjects = currentSubjects.includes(subjectId)
            ? currentSubjects.filter(s => s !== subjectId)
            : [...currentSubjects, subjectId];

        const newClassSubjects = { ...classSubjects, [className]: newSubjects };
        updateUser(userIndex, 'classSubjects', newClassSubjects);
    };

    const copySubjectsToAllClasses = (userIndex: number, sourceClass: string) => {
        const user = users[userIndex];
        const sourceSubjects = user.classSubjects?.[sourceClass] || [];
        const classSubjects = user.classSubjects || {};

        (user.allowedClasses || []).forEach(className => {
            classSubjects[className] = [...sourceSubjects];
        });

        updateUser(userIndex, 'classSubjects', classSubjects);
    };

    // For existing users (Management Mode)
    const toggleExistingUserReadOnly = (userId: number) => {
        const updatedUsers = existingUsers.map(u =>
            u.id === userId ? { ...u, isReadOnly: !u.isReadOnly } : u
        );
        setExistingUsers(updatedUsers);
        if (mode === 'management' && onUpdate) {
            onUpdate(updatedUsers);
        }
    };

    const toggleAllReadOnly = (isReadOnly: boolean) => {
        const updatedUsers = existingUsers.map(u => ({ ...u, isReadOnly }));
        setExistingUsers(updatedUsers);
        if (mode === 'management' && onUpdate) {
            onUpdate(updatedUsers);
        }
    };

    // Calculate if all users are read-only for the bulk checkbox
    const allReadOnly = existingUsers.length > 0 && existingUsers.every(u => u.isReadOnly);

    const handleSubmit = async () => {
        setError(null);

        // Validate all users have names
        if (users.some(u => !u.name || u.name.trim() === '')) {
            setError('All users must have a name');
            return;
        }

        // For setup mode, validate password
        if (mode === 'setup') {
            if (!adminPassword || adminPassword.trim() === '') {
                setError('Admin password is required');
                return;
            }
            if (adminPassword !== confirmPassword) {
                setError('Passwords do not match');
                return;
            }
        }

        // Show loading feedback for setup mode
        if (mode === 'setup') {
            setError('⏳ Setting up users and logging you in...');
        }

        // Create final user list with IDs and hashed passwords (if in setup mode)
        // CRITICAL: All fields must be defined (not undefined) for Firestore
        const finalUsers: User[] = await Promise.all(
            users.map(async (u, index) => ({
                id: mode === 'setup' ? Date.now() + index : (u.id || Date.now() + index),
                name: u.name || '',  // Ensure string, not undefined
                role: u.role || 'Teacher',  // Ensure role is defined
                allowedClasses: u.role === 'Admin' ? classNames : (u.allowedClasses || []),
                allowedSubjects: u.role === 'Admin' ? subjectList.map(s => s.id) : (u.allowedSubjects || []),
                classSubjects: u.classSubjects || {},  // Include classSubjects mapping for all roles
                passwordHash: mode === 'setup' && index === 0
                    ? await hashPassword(adminPassword)
                    : (u.passwordHash || ''),  // Empty string instead of undefined
            }))
        );

        // Call onComplete - parent will handle saving and auto-login
        await onComplete(finalUsers, mode === 'setup' ? adminPassword : undefined);
    };

    const handleEditUser = (user: User) => {
        // Save current scroll position before opening edit form
        if (existingUsersListRef.current) {
            setSavedScrollPosition(existingUsersListRef.current.scrollTop);
        }
        setEditingUserId(user.id);

        // NORMALIZE: Convert name-based assignments to ID-based assignments
        const normalizeSubjects = (subs: (number | string)[] = []) => {
            return subs.map(s => {
                if (typeof s === 'number') return s;
                const found = subjects.find(sub => sub.subject === s);
                return found ? found.id : null;
            }).filter(s => s !== null) as number[];
        };

        const editingUser: User = { 
            ...user,
            allowedSubjects: normalizeSubjects(user.allowedSubjects)
        };

        // Ensure classSubjects object exists and is normalized
        const newClassSubjects: Record<string, number[]> = {};
        if (user.classSubjects) {
            Object.entries(user.classSubjects).forEach(([cls, subs]) => {
                newClassSubjects[cls] = normalizeSubjects(subs);
            });
        }
        editingUser.classSubjects = newClassSubjects;

        // Check if we need to auto-populate
        const hasGlobalSubjects = editingUser.allowedSubjects && editingUser.allowedSubjects.length > 0;
        const hasClassMappings = editingUser.classSubjects && Object.keys(editingUser.classSubjects).length > 0;

        if (hasGlobalSubjects && !hasClassMappings && editingUser.allowedClasses && editingUser.role !== 'Admin') {
            // Auto-populate: Assign all allowedSubjects to all allowedClasses
            editingUser.allowedClasses.forEach(className => {
                editingUser.classSubjects![className] = [...editingUser.allowedSubjects!];
            });
            0 && console.log('[AdminSetup] Auto-populated classSubjects from allowedSubjects for editing:', editingUser.classSubjects);
        }

        setUsers([editingUser]);
    };

    const handleUpdateExistingUser = async () => {
        if (users.length === 0 || !editingUserId) return;

        const updatedUser = users[0];
        if (!updatedUser.name || updatedUser.name.trim() === '') {
            setError('User must have a name');
            return;
        }

        const updatedUsers = existingUsers.map(u =>
            u.id === editingUserId
                ? {
                    ...u,
                    name: updatedUser.name!,
                    role: updatedUser.role!,
                    allowedClasses: updatedUser.role === 'Admin' ? classNames : (updatedUser.allowedClasses || []),
                    allowedSubjects: updatedUser.role === 'Admin' ? subjectList.map(s => s.id) : (updatedUser.allowedSubjects || []),
                    classSubjects: updatedUser.classSubjects || {},  // Preserve admin classSubjects mapping
                }
                : u
        );

        0 && console.log('[AdminSetup] Updating user:', editingUserId, 'Total users after update:', updatedUsers.length, updatedUsers);
        setExistingUsers(updatedUsers);
        setEditingUserId(null);
        setUsers([]);
        setError(null);

        // Restore scroll position after updating user
        setTimeout(() => {
            if (existingUsersListRef.current) {
                existingUsersListRef.current.scrollTop = savedScrollPosition;
            }
        }, 0);

        // Removed auto-save. Changes are batched until close.
        if (mode === 'management') {
            // Do nothing here, wait for manual save/close
        }
    };

    const handleDeleteUser = (userId: number) => {
        // Check if user is deleting themselves
        const isDeletingSelf = currentUser && currentUser.id === userId;

        // Prevent deleting the last admin
        const admins = existingUsers.filter(u => u.role === 'Admin');
        if (admins.length === 1 && admins[0].id === userId) {
            setError('Cannot delete the last admin user');
            setDeleteConfirmUserId(null);
            return;
        }

        const updatedUsers = existingUsers.filter(u => u.id !== userId);
        0 && console.log('[AdminSetup] Deleting user:', userId, 'Remaining users:', updatedUsers.length, updatedUsers);
        setExistingUsers(updatedUsers);
        setDeleteConfirmUserId(null);
        setError(null);

        // Auto-save changes in management mode REMOVED
        if (mode === 'management') {
            // If user deleted themselves, logout after save (deferred to close)
            // Check if we need to handle self-deletion logout here or later.
            // If we defer save, we should defer logout.
            if (isDeletingSelf) {
                // Warning: If we don't logout now, they might continue acting as admin.
                // But without saving, the deletion isn't real yet.
                // We will handle logout when they click "Save & Close" or we can't defer this one.
                // Actually, for self-deletion, we should probably force a save or logout immediately?
                // User asked for "batch updates". If I delete myself, I see it gone from list.
                // If I close without saving, it comes back.
                // If I close with saving, I should get logged out.
            }
        }
    };

    const executeResetPassword = () => {
        if (resetConfirmUserId === null) return;

        const updatedUsers = existingUsers.map(u =>
            u.id === resetConfirmUserId ? { ...u, passwordHash: '' } : u
        );

        setExistingUsers(updatedUsers);

        // Auto-save changes REMOVED
        // If user reset their own password, logout immediately?
        // Deferred until save.
        /*
        if (currentUser && currentUser.id === resetConfirmUserId) {
            logout();
        }
        */

        setResetConfirmUserId(null);
    };

    const handleSaveManagement = async () => {
        // If we have users in the editing form, add them to the list and return to main view, but do not save yet
        if (users.length > 0) {
            const newUser = users[0];
            if (!newUser.name || newUser.name.trim() === '') {
                setError('User must have a name');
                return;
            }

            const newUserObj: User = {
                id: Date.now(),
                name: newUser.name!,
                role: newUser.role!,
                allowedClasses: newUser.role === 'Admin' ? classNames : (newUser.allowedClasses || []),
                allowedSubjects: newUser.role === 'Admin' ? subjectList.map(s => s.id) : (newUser.allowedSubjects || []),
                classSubjects: newUser.classSubjects || {},
                passwordHash: '',
            };
            const updatedUsers = [...existingUsers, newUserObj];
            setExistingUsers(updatedUsers);
            setUsers([]); // Close the add/edit form
            setError(null);
            // Do not save yet, just return to main user list view
            return;
        }
        // If not adding, actually save the full user list
        await onComplete(existingUsers);
    };

    const handleCancelNewUser = () => {
        setUsers([]);
        setEditingUserId(null);
        setError(null);

        // Restore scroll position after closing form
        setTimeout(() => {
            if (existingUsersListRef.current) {
                existingUsersListRef.current.scrollTop = savedScrollPosition;
            }
        }, 0);
    };

    const getAssignmentClassNames = (user: Partial<User>) => {
        const list = user.role === 'Admin' ? classNames : (user.allowedClasses || []);
        return [...list].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    };

    return (
        <div ref={modalRef} className="fixed inset-0 bg-gray-900 bg-opacity-95 z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden">
            <div className="bg-white w-full max-w-4xl max-h-[70vh] rounded-xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                {/* Fixed Header */}
                <div className="p-4 sm:p-5 border-b border-gray-100 flex-shrink-0 bg-white text-center">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
                        {mode === 'setup' ? 'Admin Setup - Register Users' : 'User Management'}
                    </h2>
                    {mode === 'setup' && (
                        <p className="text-gray-600 mt-1 text-xs sm:text-sm">
                            Welcome! Please register users for your school. The first user will be the administrator.
                        </p>
                    )}
                </div>

                {/* Main Scrollable Content */}
                <div className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
                    {(error || externalError) && (
                        <div className={`border-l-4 p-4 text-sm rounded-r-lg ${(error || externalError)?.startsWith('⏳')
                            ? 'bg-blue-50 border-blue-500 text-blue-700'
                            : 'bg-red-50 border-red-500 text-red-700'
                            }`}>
                            {externalError || error}
                        </div>
                    )}

                    {/* Users Tab Content */}
                    {mode === 'management' && !showLogs && editingUserId === null && (
                        <div>
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4">
                                <h3 className="text-xl font-semibold text-gray-700">
                                    Existing Users ({existingUsers.length})
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={handleRefreshData}
                                        disabled={isRefreshing}
                                        className="flex items-center px-3.5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:opacity-50 text-sm font-semibold shadow-sm"
                                        title="Refresh all data from database"
                                    >
                                        {isRefreshing ? (
                                            <>
                                                <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Refreshing...
                                            </>
                                        ) : (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                                Refresh Data
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={addNewUser}
                                        className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm font-semibold shadow-sm"
                                    >
                                        + Add New User
                                    </button>
                                </div>
                            </div>

                            {/* Global Read-Only Toggle */}
                            <div className="flex items-center space-x-2.5 mb-4 px-1">
                                <input
                                    type="checkbox"
                                    id="global-readonly"
                                    checked={allReadOnly}
                                    onChange={(e) => toggleAllReadOnly(e.target.checked)}
                                    className="h-4.5 w-4.5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                                />
                                <label htmlFor="global-readonly" className="text-sm font-medium text-gray-700 cursor-pointer">
                                    Set All Users to Read-Only Mode (Disable Editing)
                                </label>
                            </div>

                            {selectedUserForActions !== null && (
                                <div 
                                    className="fixed inset-0 z-10" 
                                    onClick={() => setSelectedUserForActions(null)} 
                                />
                            )}
                            <div ref={existingUsersListRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-1 max-h-[40vh] overflow-y-auto z-20 relative">
                                {existingUsers.map((user, index) => (
                                    <div key={user.id} className="relative">
                                        <button
                                            onClick={() => setSelectedUserForActions(selectedUserForActions === user.id ? null : user.id)}
                                            className={`w-full text-left flex flex-col gap-3 px-4 py-4 rounded-2xl border transition-all shadow-sm ${
                                                selectedUserForActions === user.id
                                                    ? 'bg-blue-600 border-blue-600 text-white'
                                                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                                            }`} 
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className={`w-2.5 h-2.5 rounded-full ${
                                                    user.role === 'Admin' 
                                                        ? (selectedUserForActions === user.id ? 'bg-purple-200' : 'bg-purple-500') 
                                                        : user.role === 'Teacher' 
                                                        ? (selectedUserForActions === user.id ? 'bg-blue-200' : 'bg-blue-500') 
                                                        : (selectedUserForActions === user.id ? 'bg-gray-200' : 'bg-gray-400')
                                                }`} />
                                                <div className="min-w-0">
                                                    <div className="truncate text-sm font-semibold">
                                                        {user.name || 'Unnamed User'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${selectedUserForActions === user.id ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700'}`}>
                                                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                                                        {user.role === 'Admin' ? (
                                                            <path d="M12 2l3 3h4a1 1 0 011 1v4l3 3v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3H9v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-6l3-3V6a1 1 0 011-1h4l3-3z" />
                                                        ) : user.role === 'Teacher' ? (
                                                            <path d="M5 4a1 1 0 011-1h12a1 1 0 011 1v16a1 1 0 01-1 1H6a1 1 0 01-1-1V4zm2 2v12h10V6H7zm2 2h6v2H9V8zm0 4h4v2H9v-2z" />
                                                        ) : (
                                                            <path d="M12 2a5 5 0 00-5 5c0 3.333 2.667 6 5 6s5-2.667 5-6a5 5 0 00-5-5zm0 12c-4 0-7 2-7 4v2h14v-2c0-2-3-4-7-4z" />
                                                        )}
                                                    </svg>
                                                    {user.role}
                                                </span>
                                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${selectedUserForActions === user.id ? 'bg-white/15 text-white' : user.isReadOnly ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                                        {user.isReadOnly ? (
                                                            <path fillRule="evenodd" d="M6 8V7a4 4 0 118 0v1h1a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1V9a1 1 0 011-1h1zm2-1a2 2 0 114 0v1H8V7z" clipRule="evenodd" />
                                                        ) : (
                                                            <path fillRule="evenodd" d="M5 11V9a5 5 0 1110 0v2h1a1 1 0 011 1v5a1 1 0 01-1 1H4a1 1 0 01-1-1v-5a1 1 0 011-1h1zm2-2a3 3 0 116 0v2H7V9z" clipRule="evenodd" />
                                                        )}
                                                    </svg>
                                                    {user.isReadOnly ? 'Locked' : 'Unlocked'}
                                                </span>
                                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${selectedUserForActions === user.id ? 'bg-white/15 text-white' : user.passwordHash && user.passwordHash.trim() !== '' ? 'bg-emerald-50 text-emerald-700' : 'bg-yellow-50 text-yellow-700'}`}>
                                                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                                        {user.passwordHash && user.passwordHash.trim() !== '' ? (
                                                            <path d="M10 2a4 4 0 00-4 4v2h8V6a4 4 0 00-4-4zm-1 7a1 1 0 100 2 1 1 0 000-2zm4 5H7a1 1 0 01-1-1v-3a1 1 0 011-1h6a1 1 0 011 1v3a1 1 0 01-1 1z" />
                                                        ) : (
                                                            <path fillRule="evenodd" d="M5 8a5 5 0 1110 0v2h1a1 1 0 011 1v5a1 1 0 01-1 1H4a1 1 0 01-1-1v-5a1 1 0 011-1h1V8zm2 0V6a3 3 0 116 0v2H7z" clipRule="evenodd" />
                                                        )}
                                                    </svg>
                                                    {user.passwordHash && user.passwordHash.trim() !== '' ? 'Password Set' : 'No Password'}
                                                </span>
                                            </div>
                                        </button>

                                        {selectedUserForActions === user.id && (
                                            <div className="absolute left-0 mt-1.5 z-30 w-48 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 flex flex-col gap-0.5">
                                                <div className="px-2.5 py-1.5 text-xs font-semibold text-gray-500 border-b border-gray-100 flex justify-between items-center mb-1">
                                                    <span className="truncate">Actions: {user.name}</span>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        toggleExistingUserReadOnly(user.id);
                                                        setSelectedUserForActions(null);
                                                    }}
                                                    className="w-full text-left px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-gray-100 transition text-gray-700 flex items-center gap-2"
                                                >
                                                    {user.isReadOnly ? (
                                                        <>
                                                            <svg className="h-3.5 w-3.5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                                                <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H9V7a1 1 0 012 0v2h2V7a5 5 0 00-5-5z" />
                                                            </svg>
                                                            Unlock Editing
                                                        </>
                                                    ) : (
                                                        <>
                                                            <svg className="h-3.5 w-3.5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                                            </svg>
                                                            Lock (Read-Only)
                                                        </>
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setResetConfirmUserId(user.id);
                                                        setSelectedUserForActions(null);
                                                    }}
                                                    className="w-full text-left px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-yellow-50 text-yellow-700 transition flex items-center gap-2"
                                                >
                                                    <svg className="h-3.5 w-3.5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m-5-4a3.333 3.333 0 00-8 0V7a3.333 3.333 0 008 0V5z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                                                    </svg>
                                                    Reset Password
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        handleEditUser(user);
                                                        setSelectedUserForActions(null);
                                                    }}
                                                    className="w-full text-left px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-blue-50 text-blue-700 transition flex items-center gap-2"
                                                >
                                                    <svg className="h-3.5 w-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                    Edit Settings
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setDeleteConfirmUserId(user.id);
                                                        setSelectedUserForActions(null);
                                                    }}
                                                    className="w-full text-left px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-red-50 text-red-700 transition flex items-center gap-2"
                                                >
                                                    <svg className="h-3.5 w-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                    Delete User
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {(mode === 'setup' || users.length > 0) && (
                        <div ref={userListRef} className="space-y-6">
                            {users.map((user, index) => (
                                <div key={index} className="border border-gray-200 rounded-xl p-5 bg-gray-50/50 shadow-sm">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="text-lg font-bold text-gray-800">
                                            {mode === 'setup' && index === 0 ? 'Admin User' : `User ${index + 1}`}
                                        </h4>
                                        {mode === 'setup' && index > 0 && (
                                            <button
                                                onClick={() => removeUser(index)}
                                                className="text-red-600 hover:text-red-800 text-sm font-semibold flex items-center gap-1"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                                Remove
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1">Name</label>
                                            <input
                                                type="text"
                                                value={user.name || ''}
                                                onChange={(e) => updateUser(index, 'name', e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                                                placeholder="Enter user name"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1">Role</label>
                                            <select
                                                value={user.role || 'Teacher'}
                                                onChange={(e) => updateUser(index, 'role', e.target.value as UserRole)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                                                disabled={mode === 'setup' && index === 0}
                                            >
                                                <option value="Admin">Admin</option>
                                                <option value="Teacher">Teacher</option>
                                                <option value="Guest">Guest</option>
                                            </select>
                                        </div>
                                    </div>

                                    {user.role !== 'Guest' && (
                                        <>
                                            {user.role !== 'Admin' && (
                                                <div className="mb-5">
                                                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3">
                                                        <label className="block text-sm font-semibold text-gray-700">Allowed Classes</label>
                                                        <div className="flex gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={handleRefreshData}
                                                                disabled={isRefreshing}
                                                                className="flex items-center px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition disabled:opacity-50 font-medium"
                                                                title="Refresh classes and subjects from database"
                                                            >
                                                                {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleAllClasses(index)}
                                                                className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                                                            >
                                                                {(user.allowedClasses || []).length === classNames.length ? 'Deselect All' : 'Select All'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2 bg-white p-3 rounded-lg border border-gray-200">
                                                        {classNames.map(className => (
                                                            <button
                                                                key={className}
                                                                type="button"
                                                                onClick={() => toggleClass(index, className)}
                                                                className={`px-3.5 py-1.5 text-sm rounded-full transition font-medium cursor-pointer shadow-sm ${
                                                                    (user.allowedClasses || []).includes(className)
                                                                        ? 'bg-blue-600 text-white'
                                                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200/50'
                                                                }`}
                                                            >
                                                                {className}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="mb-2">
                                                <label className="block text-sm font-semibold text-gray-700 mb-3">
                                                    Classes & Subjects Assignment
                                                </label>

                                                {getAssignmentClassNames(user).length === 0 ? (
                                                    <p className="text-sm text-gray-500 italic p-3 bg-white border border-gray-200 rounded-lg text-center">
                                                        Select classes above to assign subjects
                                                    </p>
                                                ) : (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        {getAssignmentClassNames(user).map(className => (
                                                            <div key={className} className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm flex flex-col justify-between">
                                                                <div className="flex justify-between items-center mb-3">
                                                                    <h5 className="font-bold text-gray-800 text-sm">{className}</h5>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => copySubjectsToAllClasses(index, className)}
                                                                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-semibold"
                                                                        title="Copy this class's subjects to all classes"
                                                                    >
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                                        </svg>
                                                                        Copy to All
                                                                    </button>
                                                                </div>

                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {subjectList.map(subject => {
                                                                        const classSubjects = user.classSubjects || {};
                                                                        const assignedSubjects = classSubjects[className] || [];
                                                                        const isSelected = assignedSubjects.some((s: any) => s === subject.id || s === subject.name);

                                                                        return (
                                                                            <button
                                                                                key={subject.id}
                                                                                type="button"
                                                                                onClick={() => toggleClassSubject(index, className, subject.id)}
                                                                                className={`px-2.5 py-1.5 text-xs rounded-lg transition font-medium cursor-pointer border shadow-sm ${
                                                                                    isSelected
                                                                                        ? 'bg-green-600 text-white border-green-700'
                                                                                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200'
                                                                                }`}
                                                                            >
                                                                                {subject.displayName}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {mode === 'setup' && (
                        <div className="pt-2">
                            <button
                                onClick={addNewUser}
                                className="w-full flex justify-center items-center py-3 px-4 border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-xl text-gray-600 hover:text-blue-600 transition font-semibold"
                            >
                                + Add Another User
                            </button>
                        </div>
                    )}

                    {mode === 'setup' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Admin Password</label>
                                <input
                                    type="password"
                                    value={adminPassword}
                                    onChange={(e) => setAdminPassword(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                                    placeholder="Set admin password"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Confirm Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                                    placeholder="Confirm password"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Fixed Footer */}
                <div className="p-3 sm:p-4 border-t border-gray-100 bg-gray-50 flex-shrink-0 flex flex-col-reverse sm:flex-row gap-2">
                    {/* Close button always visible */}
                    <button
                        onClick={() => {
                            if (hasUnsavedChanges) {
                                setShowCloseWarning(true);
                            } else if (onCancel) {
                                onCancel();
                            }
                        }}
                        className="flex-1 py-2 px-4 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition font-bold shadow-sm text-sm"
                    >
                        Close
                    </button>

                    {onCancel && mode === 'management' && users.length === 0 && (
                        <button
                            onClick={handleApplyChanges}
                            disabled={isFetching && existingUsers.length === 0 || isApplyingChanges}
                            className={`flex-1 py-2 px-4 text-white rounded-lg transition font-bold shadow-sm text-sm ${
                                isFetching && existingUsers.length === 0
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : isApplyingChanges
                                    ? 'bg-blue-600 cursor-wait opacity-90 animate-pulse'
                                    : 'bg-gray-600 hover:bg-gray-700'
                            }`}
                        >
                            {isApplyingChanges ? (
                                <span className="inline-flex items-center justify-center gap-2">
                                    <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                    Applying Changes...
                                </span>
                            ) : isFetching && existingUsers.length === 0 ? (
                                'Loading Users...'
                            ) : (
                                'Apply Changes'
                            )}
                        </button>
                    )}

                    {mode === 'management' && users.length > 0 && (
                        <button
                            onClick={handleCancelNewUser}
                            className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-bold shadow-sm text-sm"
                        >
                            Cancel
                        </button>
                    )}

                    {(mode === 'setup' || users.length > 0) && (
                        <button
                            onClick={
                                mode === 'management' && editingUserId !== null
                                    ? handleUpdateExistingUser
                                    : mode === 'management'
                                    ? handleSaveManagement
                                    : handleSubmit
                            }
                            className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-bold shadow-sm text-sm"
                        >
                            {mode === 'setup'
                                ? 'Complete Setup'
                                : editingUserId !== null
                                ? 'Update User'
                                : users.length > 0
                                ? 'Add User'
                                : 'Save Changes'}
                        </button>
                    )}
                </div>
            </div>
            {/* Unsaved changes warning modal */}
            <ConfirmationModal
                isOpen={showCloseWarning}
                onClose={() => setShowCloseWarning(false)}
                onConfirm={() => {
                    setShowCloseWarning(false);
                    if (onCancel) onCancel();
                }}
                title="Unsaved Changes"
                message="You have unsaved changes. Are you sure you want to close without saving?"
                variant="warning"
                confirmText="Close Without Saving"
            />

            {/* Reset Password Confirmation Modal */}
            <ConfirmationModal
                isOpen={resetConfirmUserId !== null}
                onClose={() => setResetConfirmUserId(null)}
                onConfirm={executeResetPassword}
                title="Reset User Password"
                message={
                    currentUser && currentUser.id === resetConfirmUserId
                        ? `⚠️ WARNING: You are attempting to reset your own password. You will be logged out immediately and asked to set a new password. Continue?`
                        : `Are you sure you want to reset the password for ${existingUsers.find(u => u.id === resetConfirmUserId)?.name}? They will be prompted to set a new password on their next login.`
                }
                variant="warning"
            />

            {/* Delete Confirmation Modal */}
            <ConfirmationModal
                isOpen={deleteConfirmUserId !== null}
                onClose={() => setDeleteConfirmUserId(null)}
                onConfirm={() => {
                    if (deleteConfirmUserId !== null) {
                        handleDeleteUser(deleteConfirmUserId);
                    }
                }}
                title="Delete User"
                message={
                    currentUser && currentUser.id === deleteConfirmUserId
                        ? `⚠️ WARNING: You are about to delete your own account (${currentUser.name})! You will be immediately logged out. This action cannot be undone.`
                        : `Are you sure you want to delete ${existingUsers.find(u => u.id === deleteConfirmUserId)?.name}? This action cannot be undone.`
                }
                variant={currentUser && currentUser.id === deleteConfirmUserId ? "warning" : undefined}
            />
        </div>
    );
};

export default AdminSetup;
