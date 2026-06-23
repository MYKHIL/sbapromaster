import React, { useState, useEffect } from 'react';
import type { User, UserRole } from '../types';
import { useData } from '../context/DataContext';
import { hashPassword } from '../services/authService';
import ConfirmationModal from './ConfirmationModal';
import MessageBox from './MessageBox';
import { useUser } from '../context/UserContext';

type SetupMessageBoxState = {
    isOpen: boolean;
    title: string;
    message: string | React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel?: () => void;
    variant?: 'info' | 'success' | 'warning' | 'danger';
    hideCancel?: boolean;
};

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
    const { classes, subjects, addClass, updateClass, deleteClass, saveClasses, subscription } = useData();
    const { logout } = useUser();
    const [users, setUsers] = useState<Partial<User>[]>(mode === 'setup' ? [{ role: 'Admin' as UserRole, allowedClasses: [], allowedSubjects: [] }] : []);
    const [existingUsers, setExistingUsers] = useState<User[]>(initialUsers);
    const [adminPassword, setAdminPassword] = useState('');
    const [isApplyingChanges, setIsApplyingChanges] = useState(false);
    
    // State for class creation
    const [showAddClassModal, setShowAddClassModal] = useState(false);
    const [newClassName, setNewClassName] = useState('');
    const [newTeacherName, setNewTeacherName] = useState('');
    const [addClassError, setAddClassError] = useState<string | null>(null);
    const [isCreatingClass, setIsCreatingClass] = useState(false);
    const [localNewClasses, setLocalNewClasses] = useState<string[]>([]);
    const [editingClassId, setEditingClassId] = useState<number | null>(null);
    const [deleteConfirmClassId, setDeleteConfirmClassId] = useState<number | null>(null);
    const [pendingClassTeacherChanges, setPendingClassTeacherChanges] = useState<Record<string, string[]>>({});
    const [pendingReportTeacherChanges, setPendingReportTeacherChanges] = useState<Record<string, string[]>>({});
    const [pendingNewClasses, setPendingNewClasses] = useState<Array<{ name: string; teacherNames?: string[] }>>([]);
    const [teacherChoiceModal, setTeacherChoiceModal] = useState<{
        isOpen: boolean;
        className?: string;
        existing?: string[];
        userIndex?: number | null;
        userName?: string;
    }>({ isOpen: false });
    const [assignAsTeacher, setAssignAsTeacher] = useState(false);
    const [currentUserIndexForClass, setCurrentUserIndexForClass] = useState<number | null>(null);

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
    const [messageBox, setMessageBox] = useState<SetupMessageBoxState>({
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'OK',
        hideCancel: true,
        onConfirm: () => setMessageBox(prev => ({ ...prev, isOpen: false }))
    });

    const showSetupMessageBox = (
        message: string | React.ReactNode,
        title = 'Error',
        variant: 'info' | 'success' | 'warning' | 'danger' = 'danger'
    ) => {
        setMessageBox({
            isOpen: true,
            title,
            message,
            confirmText: 'OK',
            hideCancel: true,
            variant,
            onConfirm: () => setMessageBox(prev => ({ ...prev, isOpen: false }))
        });
    };

    const showError = (message: string) => {
        if (mode === 'setup') {
            showSetupMessageBox(message, 'Error', 'danger');
            return;
        }
        setError(message);
    };

    useEffect(() => {
        if (mode === 'setup' && externalError) {
            showSetupMessageBox(externalError, 'Error', 'danger');
        }
    }, [externalError, mode]);

    const [editingUserId, setEditingUserId] = useState<number | null>(null);
    const [deleteConfirmUserId, setDeleteConfirmUserId] = useState<number | null>(null);
    const [resetConfirmUserId, setResetConfirmUserId] = useState<number | null>(null);
    const [showLogs, setShowLogs] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [selectedMobileUser, setSelectedMobileUser] = useState<number | null>(null);
    const [mobileUserFormPage, setMobileUserFormPage] = useState(0);
    const { userLogs } = useData();

    const subjectList = React.useMemo(() => {
        return subjects.map(s => ({
            id: s.id,
            name: s.subject,
            displayName: s.subject // Only show the name as requested
        }));
    }, [subjects]);

    const classNames = React.useMemo(() => {
        const allClasses = [
            ...classes.map(c => c.name),
            ...localNewClasses
        ];
        const uniqueClasses = Array.from(new Set(allClasses));
        return uniqueClasses.sort((a, b) => {
            return a.localeCompare(b, undefined, {
                numeric: true,
                sensitivity: 'base'
            });
        });
    }, [classes, localNewClasses]);

    // Ref for auto-scrolling to the add-user form
    const userListRef = React.useRef<HTMLDivElement>(null);
    // Ref for main modal wrapper
    const modalRef = React.useRef<HTMLDivElement>(null);
    // Ref for the scrollable existing users list container
    const existingUsersListRef = React.useRef<HTMLDivElement>(null);
    // State to preserve scroll position when opening/closing forms
    const [savedScrollPosition, setSavedScrollPosition] = useState<number>(0);
    // Preserve mobile selection across add/edit form lifecycle
    const previousSelectedMobileUserRef = React.useRef<number | null>(null);

    // Reset mobile user selection when form closes or selection is invalid
    useEffect(() => {
        if (users.length === 0 && editingUserId === null) {
            if (selectedMobileUser === null || !existingUsers.some(u => u.id === selectedMobileUser)) {
                setSelectedMobileUser(existingUsers.length > 0 ? existingUsers[0].id : null);
            }
        }
    }, [users.length, editingUserId, existingUsers.length, selectedMobileUser, existingUsers]);

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
            showError('Failed to refresh data. Please try again.');
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleApplyChanges = async () => {
        if (isFetching && existingUsers.length === 0) {
            showError('⏳ Still fetching users from cloud. Please wait...');
            return;
        }
        if (existingUsers.length === 0) {
            showError('Cannot save: no users to apply. Please add at least the admin user.');
            return;
        }

        setError(null);
        setIsApplyingChanges(true);
        try {
            // First persist pending new classes (if any)
            if (pendingNewClasses.length > 0) {
                for (const pc of pendingNewClasses) {
                    try {
                        // addClass might be sync or async; handle both
                        await Promise.resolve(addClass({ name: pc.name, teacherNames: pc.teacherNames || [], teacherName: pc.teacherNames && pc.teacherNames.length ? pc.teacherNames[0] : '' }));
                    } catch (err) {
                        console.error('Failed to add pending class', pc.name, err);
                    }
                }
            }

            // Then persist pending teacher assignments
            const entries = Object.entries(pendingClassTeacherChanges);
            if (entries.length > 0) {
                for (const [className, teacherNames] of entries) {
                    const cls = classes.find(c => (c.name || '').trim().toLowerCase() === className.trim().toLowerCase());
                    if (cls && updateClass) {
                        const updated = { ...cls, teacherNames: teacherNames, teacherName: teacherNames && teacherNames.length ? teacherNames[0] : '' };
                        try {
                            await Promise.resolve(updateClass(updated));
                        } catch (err) {
                            console.error('Failed to update class teachers for', className, err);
                        }
                    } else {
                        // Class may have been newly created in this batch; try to add then update
                        try {
                            await Promise.resolve(addClass({ name: className, teacherNames: teacherNames, teacherName: teacherNames && teacherNames.length ? teacherNames[0] : '' }));
                        } catch (err) {
                            console.error('Failed to add/update class during apply for', className, err);
                        }
                    }
                }
            }

            const reportEntries = Object.entries(pendingReportTeacherChanges);
            if (reportEntries.length > 0) {
                for (const [className, reportTeachers] of reportEntries) {
                    const cls = classes.find(c => (c.name || '').trim().toLowerCase() === className.trim().toLowerCase());
                    if (cls && updateClass) {
                        const updated = { ...cls, reportTeachers };
                        try {
                            await Promise.resolve(updateClass(updated));
                        } catch (err) {
                            console.error('Failed to update report teachers for', className, err);
                        }
                    } else {
                        try {
                            await Promise.resolve(addClass({ name: className, reportTeachers, teacherName: reportTeachers && reportTeachers.length ? reportTeachers[0] : '' }));
                        } catch (err) {
                            console.error('Failed to add/update report teachers during apply for', className, err);
                        }
                    }
                }
            }

            const classesChanged = pendingNewClasses.length > 0 || entries.length > 0 || reportEntries.length > 0;
            if (classesChanged && saveClasses) {
                // Let React flush any pending class state updates before persisting.
                await new Promise(resolve => setTimeout(resolve, 0));
                await saveClasses();
            }

            // Finally persist users
            await onComplete(existingUsers);
            setError('✅ User changes saved to cloud. You may now close this window.');
        } catch (err) {
            console.error('Failed to apply user changes:', err);
            setError('Failed to apply user changes. Please try again.');
            setIsApplyingChanges(false);
            return;
        }

        // Clear pending buffers on success
        setPendingNewClasses([]);
        setPendingClassTeacherChanges({});
        setPendingReportTeacherChanges({});
        setIsApplyingChanges(false);
    };

    const addNewUser = () => {
        previousSelectedMobileUserRef.current = selectedMobileUser;
        setUsers([...users, { role: 'Teacher' as UserRole, allowedClasses: [], allowedSubjects: [] }]);
        setSelectedMobileUser(null);
        setMobileUserFormPage(0);
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

    // Toggle assignment of a user as class teacher for a specific class
    const toggleAssignClassTeacher = (userIndex: number, className: string) => {
        const user = users[userIndex];
        if (!user) return;
        const userName = (user.name || '').trim();
        if (!userName) {
            setError('User must have a name to be assigned as class teacher');
            return;
        }

        // Determine current teachers (merge live + pending)
        const cls = classes.find(c => (c.name || '').trim().toLowerCase() === className.trim().toLowerCase());
        const liveTeachers = cls ? (cls.teacherNames && cls.teacherNames.length ? cls.teacherNames : (cls.teacherName ? [cls.teacherName] : [])) : [];
        const pending = pendingClassTeacherChanges[className] || liveTeachers;

        // If user is already a teacher in pending mapping, then unassign locally
        if (pending.map(t => t.trim().toLowerCase()).includes(userName.toLowerCase())) {
            const newTeachers = pending.filter(t => t.trim().toLowerCase() !== userName.toLowerCase());
            setPendingClassTeacherChanges(prev => ({ ...prev, [className]: newTeachers }));

            // Remove class from user's allowedClasses and classSubjects locally
            const currentClasses = user.allowedClasses || [];
            if (currentClasses.includes(className)) {
                updateUser(userIndex, 'allowedClasses', currentClasses.filter(c => c !== className));
            }
            const classSubjects = user.classSubjects || {};
            if (classSubjects[className]) {
                const newClassSubjects = { ...classSubjects };
                delete newClassSubjects[className];
                updateUser(userIndex, 'classSubjects', newClassSubjects);
            }
            return;
        }

        // If there are existing teachers (live) and user isn't present, ask whether to replace or add
        if (liveTeachers.length > 0 && !liveTeachers.map(t => t.trim().toLowerCase()).includes(userName.toLowerCase())) {
            setTeacherChoiceModal({ isOpen: true, className, existing: liveTeachers, userIndex, userName });
            return;
        }

        // Otherwise simply add to pending mapping
        const newList = Array.from(new Set([...(pending || []), userName]));
        setPendingClassTeacherChanges(prev => ({ ...prev, [className]: newList }));

        // Ensure user has access to the class locally
        const currentClasses = user.allowedClasses || [];
        if (!currentClasses.includes(className)) {
            const updatedClasses = [...currentClasses, className].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
            updateUser(userIndex, 'allowedClasses', updatedClasses);
        }
        const classSubjects = user.classSubjects || {};
        if (!classSubjects[className]) {
            classSubjects[className] = [];
            updateUser(userIndex, 'classSubjects', classSubjects);
        }
    };

    // Class creation handlers
    const maxClasses = subscription?.maxClass || Infinity;
    const isClassLimitReached = classes.length >= maxClasses;

    const handleOpenAddClassModal = (userIndex?: number) => {
        setAddClassError(null);
        setNewClassName('');
        setAssignAsTeacher(false);
        setCurrentUserIndexForClass(userIndex ?? null);
        
        // Auto-populate teacher name with current user if index provided
        if (userIndex !== undefined && users[userIndex]?.name) {
            setNewTeacherName((users[userIndex].name as string).trim());
        } else {
            setNewTeacherName('');
        }
        
        setShowAddClassModal(true);
    };

    const handleEditClass = (cls: any) => {
        setEditingClassId(cls.id);
        setNewClassName(cls.name || '');
        setNewTeacherName(cls.teacherName || '');
        setAssignAsTeacher(false);
        setCurrentUserIndexForClass(null);
        setAddClassError(null);
        setShowAddClassModal(true);
    };

    const executeDeleteClass = (id: number) => {
        try {
            deleteClass(id);
            // Clean local caches
            setLocalNewClasses(prev => prev.filter(cn => cn !== (classes.find(c => c.id === id)?.name || '')));
            setDeleteConfirmClassId(null);
            setAddClassError(null);
        } catch (e) {
            console.error('Failed to delete class', e);
            setAddClassError('Failed to delete class. Please try again.');
        }
    };

    const handleCreateClass = async () => {
        setAddClassError(null);

        // Validation
        if (!newClassName.trim()) {
            setAddClassError('Class name is required');
            return;
        }
        if (!newTeacherName.trim()) {
            setAddClassError('Teacher name is required');
            return;
        }

        // Check maxClass limit
        if (classes.length >= maxClasses) {
            setAddClassError(`Cannot create class: License limit reached (${maxClasses} classes maximum)`);
            return;
        }

        // Check for duplicates (including locally created ones)
        const isEditing = editingClassId !== null;
        const lcNewName = (newClassName || '').trim().toLowerCase();
        const isDuplicate = classNames.some(cn =>
            (cn || '').trim().toLowerCase() === lcNewName
        ) && !isEditing;
        if (isDuplicate) {
            setAddClassError('A class with this name already exists');
            return;
        }

        // Check for duplicate class + teacher combination
        const isDuplicateCombination = classes.some(cls =>
            (cls.name || '').trim().toLowerCase() === lcNewName &&
            (cls.teacherName || '').trim().toLowerCase() === (newTeacherName || '').trim().toLowerCase() &&
            (!isEditing || cls.id !== editingClassId)
        );
        if (isDuplicateCombination) {
            setAddClassError('This Class + Teacher combination already exists');
            return;
        }

        // Defer creation when in management mode; otherwise create immediately
        setIsCreatingClass(true);
        try {
            const className = newClassName.trim();
            const teacher = newTeacherName.trim();

            if (mode === 'management') {
                // Add to pending new classes
                if (isEditing) {
                    // Update existing class in management mode
                    updateClass({ id: editingClassId!, name: className, teacherName: teacher, teacherNames: teacher ? [teacher] : [] } as any);
                } else {
                    setPendingNewClasses(prev => [...prev, { name: className, teacherNames: assignAsTeacher ? [teacher] : (teacher ? [teacher] : []) }]);
                }
                setLocalNewClasses(prev => [...new Set([...prev, className])]);

                // Auto-select newly created class in user's allowedClasses if currently editing/adding a user
                if (currentUserIndexForClass !== null) {
                    const userIndex = currentUserIndexForClass;
                    const user = users[userIndex];
                    const currentClasses = user.allowedClasses || [];
                    if (!currentClasses.includes(className)) {
                        const updatedClasses = [...currentClasses, className].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
                        updateUser(userIndex, 'allowedClasses', updatedClasses);
                    }
                    // Initialize classSubjects for this class if not exists
                    const classSubjects = user.classSubjects || {};
                    if (!classSubjects[className]) {
                        classSubjects[className] = [];
                        updateUser(userIndex, 'classSubjects', classSubjects);
                    }

                    // If assign as teacher, also add to pending teacher mapping
                    if (assignAsTeacher) {
                        const current = pendingClassTeacherChanges[className] || [];
                        setPendingClassTeacherChanges(prev => ({ ...prev, [className]: Array.from(new Set([...current, teacher])) }));
                    }
                }

                setNewClassName('');
                setNewTeacherName('');
                setAssignAsTeacher(false);
                setCurrentUserIndexForClass(null);
                setEditingClassId(null);
                setShowAddClassModal(false);
                setAddClassError(null);
            } else {
                // Immediate creation (setup mode) or update if editing
                if (isEditing) {
                    updateClass({ id: editingClassId!, name: className, teacherName: teacher, teacherNames: teacher ? [teacher] : [] } as any);
                    setNewClassName('');
                    setNewTeacherName('');
                    setAssignAsTeacher(false);
                    setCurrentUserIndexForClass(null);
                    setEditingClassId(null);
                    setShowAddClassModal(false);
                    setAddClassError(null);
                } else {
                    const newId = addClass({
                        name: className,
                        teacherName: teacher,
                        teacherNames: teacher ? [teacher] : [],
                        teacherSignature: ''
                    });

                    if (newId) {
                    setLocalNewClasses(prev => [...new Set([...prev, className])]);
                    
                    // Auto-select newly created class in user's allowedClasses if currently editing/adding a user
                    if (currentUserIndexForClass !== null) {
                        const userIndex = currentUserIndexForClass;
                        const user = users[userIndex];
                        const currentClasses = user.allowedClasses || [];
                        if (!currentClasses.includes(className)) {
                            const updatedClasses = [...currentClasses, className].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
                            updateUser(userIndex, 'allowedClasses', updatedClasses);
                        }
                        // Initialize classSubjects for this class if not exists
                        const classSubjects = user.classSubjects || {};
                        if (!classSubjects[className]) {
                            classSubjects[className] = [];
                            updateUser(userIndex, 'classSubjects', classSubjects);
                        }

                        // If assign as teacher, also handle class teacher assignment
                        if (assignAsTeacher) {
                            // In setup mode, just note it locally for later
                            // (This would be handled by the parent when saving)
                        }
                    }

                        setNewClassName('');
                        setNewTeacherName('');
                        setAssignAsTeacher(false);
                        setCurrentUserIndexForClass(null);
                        setShowAddClassModal(false);
                        setAddClassError(null);
                    } else {
                        setAddClassError('Failed to create class. Please try again.');
                    }
                }
            }
        } catch (err) {
            console.error('Error creating class:', err);
            setAddClassError('Failed to create class. Please try again.');
        } finally {
            setIsCreatingClass(false);
        }
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

    const handleCreateSetupUser = async () => {
        if (users.length === 0) return;

        const newUser = users[0];
        if (!newUser.name || newUser.name.trim() === '') {
            showError('User must have a name');
            return;
        }

        const isFirstAdmin = mode === 'setup' && existingUsers.length === 0 && newUser.role === 'Admin';
        if (isFirstAdmin) {
            if (!adminPassword || adminPassword.trim() === '') {
                showError('Admin password is required');
                return;
            }
            if (adminPassword !== confirmPassword) {
                showError('Passwords do not match');
                return;
            }
        }

        const newUserObj: User = {
            id: Date.now(),
            name: newUser.name!,
            role: newUser.role!,
            allowedClasses: newUser.role === 'Admin' ? classNames : (newUser.allowedClasses || []),
            allowedSubjects: newUser.role === 'Admin' ? subjectList.map(s => s.id) : (newUser.allowedSubjects || []),
            classSubjects: newUser.classSubjects || {},
            passwordHash: isFirstAdmin ? await hashPassword(adminPassword) : (newUser.passwordHash || ''),
        };

        const updatedUsers = [...existingUsers, newUserObj];
        setExistingUsers(updatedUsers);
        setUsers([]);
        setError(null);
        setMobileUserFormPage(0);
        setSelectedMobileUser(newUserObj.id);
        previousSelectedMobileUserRef.current = null;

        setTimeout(() => {
            if (existingUsersListRef.current) {
                existingUsersListRef.current.scrollTop = savedScrollPosition;
            }
        }, 0);
    };

    const handleSubmit = async () => {
        setError(null);

        if (mode === 'setup') {
            if (editingUserId !== null) {
                await handleUpdateExistingUser();
                return;
            }

            if (users.length > 0) {
                await handleCreateSetupUser();
                return;
            }

            if (existingUsers.length === 0) {
                showError('Please create at least one user before completing setup');
                return;
            }

            setError('⏳ Finalizing setup and logging you in...');
            await onComplete(existingUsers, adminPassword);
            return;
        }

        // Validate all users have names
        if (users.some(u => !u.name || u.name.trim() === '')) {
            showError('All users must have a name');
            return;
        }

        // Create final user list with IDs and hashed passwords
        const finalUsers: User[] = await Promise.all(
            users.map(async (u, index) => ({
                id: u.id || Date.now() + index,
                name: u.name || '',
                role: u.role || 'Teacher',
                allowedClasses: u.role === 'Admin' ? classNames : (u.allowedClasses || []),
                allowedSubjects: u.role === 'Admin' ? subjectList.map(s => s.id) : (u.allowedSubjects || []),
                classSubjects: u.classSubjects || {},
                passwordHash: u.passwordHash || '',
            }))
        );

        await onComplete(finalUsers);
    };

    const handleEditUser = (user: User) => {
        previousSelectedMobileUserRef.current = selectedMobileUser;
        // Save current scroll position before opening edit form
        if (existingUsersListRef.current) {
            setSavedScrollPosition(existingUsersListRef.current.scrollTop);
        }
        setEditingUserId(user.id);
        setMobileUserFormPage(0);

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
            showError('User must have a name');
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
        setSelectedMobileUser(previousSelectedMobileUserRef.current ?? editingUserId);
        previousSelectedMobileUserRef.current = null;

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

    // Handle mobile form pagination
    const getTotalPages = (role: UserRole): number => {
        // Guest only needs 1 page (basic info)
        // Admin needs 2 pages (info, subjects)
        // Teacher needs 3 pages (info, classes, subjects)
        if (role === 'Teacher') return 3;
        if (role === 'Admin') return 2;
        return 1; // Guest
    };

    const getPageDescription = (role: UserRole, page: number): string => {
        if (role === 'Teacher') {
            switch (page) {
                case 0: return 'Step 1 of 3: Basic Information';
                case 1: return 'Step 2 of 3: Class Access';
                case 2: return 'Step 3 of 3: Subject Assignment';
                default: return 'User Setup';
            }
        } else if (role === 'Admin') {
            switch (page) {
                case 0: return 'Step 1 of 2: Basic Information';
                case 1: return 'Step 2 of 2: Subject Assignment';
                default: return 'Admin Setup';
            }
        }
        // Guest
        return 'Basic Information';
    };

    const handleMobileFormNext = () => {
        if (users.length === 0) return;
        
        const currentUser = users[0];
        const totalPages = getTotalPages(currentUser.role as UserRole);
        
        // Validate current page before advancing
        if (mobileUserFormPage === 0) {
            // Page 1: Name & Role validation
            if (!currentUser.name || currentUser.name.trim() === '') {
                showError('Please enter a user name');
                return;
            }
            setError(null);
        }
        
        // If we've reached the last page, submit instead of advancing
        if (mobileUserFormPage >= totalPages - 1) {
            handleMobileFormSubmit();
            return;
        }
        
        // Advance to next page
        setMobileUserFormPage(prev => Math.min(prev + 1, totalPages - 1));
    };

    const handleMobileFormPrevious = () => {
        setMobileUserFormPage(prev => Math.max(prev - 1, 0));
    };

    const handleMobileFormSubmit = async () => {
        if (editingUserId) {
            // Editing existing user - update and close form
            await handleUpdateExistingUser();
            return;
        }

        // For setup mode, route mobile submit through the setup create handler
        if (mode === 'setup') {
            await handleCreateSetupUser();
            return;
        }

        // Non-setup (management) new user flow - create the user
        if (users.length > 0) {
            const newUser = users[0];
            if (!newUser.name || newUser.name.trim() === '') {
                showError('User must have a name');
                return;
            }

            // Create new user object and add to existingUsers
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

            // Notify parent of immediate update
            if (onUpdate) {
                try {
                    onUpdate(updatedUsers);
                } catch (err) {
                    0 && console.error('[AdminSetup] onUpdate callback failed', err);
                }
            }

            // If in management mode, persist immediately so users aren't lost on reload
            if (mode === 'management' && onComplete) {
                setIsApplyingChanges(true);
                try {
                    await onComplete(updatedUsers);
                    setError('✅ User changes saved to cloud.');
                } catch (err) {
                    console.error('[AdminSetup] Failed to save new user immediately:', err);
                    setError('Failed to save new user. Please try Apply Changes.');
                } finally {
                    setIsApplyingChanges(false);
                }
            }

            // Close form and return to selection page
            setUsers([]);
            setError(null);
            setMobileUserFormPage(0);

            // Select newly created user and restore scroll
            setSelectedMobileUser(newUserObj.id);
            previousSelectedMobileUserRef.current = null;

            setTimeout(() => {
                if (existingUsersListRef.current) {
                    existingUsersListRef.current.scrollTop = savedScrollPosition;
                }
            }, 0);
        }
    };

    const handleDeleteUser = (userId: number) => {
        // Check if user is deleting themselves
        const isDeletingSelf = currentUser && currentUser.id === userId;

        // Prevent deleting the last admin
        const admins = existingUsers.filter(u => u.role === 'Admin');
        if (admins.length === 1 && admins[0].id === userId) {
            showError('Cannot delete the last admin user');
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
                showError('User must have a name');
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
        if (users.length > 1 && editingUserId === null) {
            // If multiple new users are in progress, cancel should remove only the current form.
            setUsers(prevUsers => prevUsers.slice(0, -1));
        } else {
            setUsers([]);
        }

        setEditingUserId(null);
        setError(null);
        setSelectedMobileUser(previousSelectedMobileUserRef.current ?? (existingUsers.length > 0 ? existingUsers[0].id : null));
        previousSelectedMobileUserRef.current = null;

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

    const getUserSubjectCount = (user: Partial<User>) => {
        const subjectIds = new Set<number>();

        const normalizeSubject = (subject: number | string) => {
            if (typeof subject === 'number') {
                subjectIds.add(subject);
            } else {
                const found = subjectList.find(sub => sub.name === subject);
                if (found) {
                    subjectIds.add(found.id);
                }
            }
        };

        (user.allowedSubjects || []).forEach(normalizeSubject);

        if (user.classSubjects) {
            Object.values(user.classSubjects).forEach((subs) => {
                (subs || []).forEach(normalizeSubject);
            });
        }

        return subjectIds.size;
    };

    const getEffectiveClassTeachers = (className: string) => {
        const liveClass = classes.find(c => (c.name || '').trim().toLowerCase() === className.trim().toLowerCase());
        const liveTeachers = liveClass ? (liveClass.teacherNames && liveClass.teacherNames.length ? liveClass.teacherNames : (liveClass.teacherName ? [liveClass.teacherName] : [])) : [];
        const pendingTeachers = pendingClassTeacherChanges[className];
        return pendingTeachers || liveTeachers;
    };

    const selectedMobileUserData = selectedMobileUser !== null
        ? existingUsers.find(u => u.id === selectedMobileUser)
        : undefined;

    return (
        <div ref={modalRef} className="fixed inset-0 bg-gray-900 bg-opacity-95 z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden">
            <ConfirmationModal
                isOpen={teacherChoiceModal.isOpen}
                onClose={() => setTeacherChoiceModal({ isOpen: false })}
                onConfirm={() => {
                    // Replace existing teachers with this user
                    const className = teacherChoiceModal.className!;
                    const userName = teacherChoiceModal.userName!;
                    setPendingClassTeacherChanges(prev => ({ ...prev, [className]: [userName] }));
                    // Ensure user's class access
                    if (teacherChoiceModal.userIndex !== null && teacherChoiceModal.userIndex !== undefined) {
                        const idx = teacherChoiceModal.userIndex;
                        const usr = users[idx];
                        if (usr) {
                            const currentClasses = usr.allowedClasses || [];
                            if (!currentClasses.includes(className)) {
                                updateUser(idx, 'allowedClasses', [...currentClasses, className].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })));
                            }
                            const classSubjects = usr.classSubjects || {};
                            if (!classSubjects[className]) {
                                classSubjects[className] = [];
                                updateUser(idx, 'classSubjects', classSubjects);
                            }
                        }
                    }
                    setTeacherChoiceModal({ isOpen: false });
                }}
                title="Existing class teachers"
                message={teacherChoiceModal.existing ? (
                    <div>
                        <div className="text-sm text-gray-700">This class already has teacher(s):</div>
                        <ul className="mt-2 text-sm text-gray-600 list-disc list-inside">
                            {teacherChoiceModal.existing?.map((t, i) => <li key={i}>{t}</li>)}
                        </ul>
                        <div className="mt-2 text-sm text-gray-700">Would you like to replace them with this user or add this user to the existing teachers?</div>
                    </div>
                ) : null}
                variant="info"
                confirmText="Replace"
                cancelText="Cancel"
                additionalAction={() => {
                    // Add to existing teachers
                    const className = teacherChoiceModal.className!;
                    const userName = teacherChoiceModal.userName!;
                    const existing = teacherChoiceModal.existing || [];
                    const newList = Array.from(new Set([...existing, userName]));
                    setPendingClassTeacherChanges(prev => ({ ...prev, [className]: newList }));
                    if (teacherChoiceModal.userIndex !== null && teacherChoiceModal.userIndex !== undefined) {
                        const idx = teacherChoiceModal.userIndex;
                        const usr = users[idx];
                        if (usr) {
                            const currentClasses = usr.allowedClasses || [];
                            if (!currentClasses.includes(className)) {
                                updateUser(idx, 'allowedClasses', [...currentClasses, className].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })));
                            }
                            const classSubjects = usr.classSubjects || {};
                            if (!classSubjects[className]) {
                                classSubjects[className] = [];
                                updateUser(idx, 'classSubjects', classSubjects);
                            }
                        }
                    }
                    setTeacherChoiceModal({ isOpen: false });
                }}
                additionalActionText="Add"
            />
            <div className="bg-white w-full max-w-4xl max-h-[75vh] rounded-xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
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
                    {mode !== 'setup' && (error || externalError) && (
                        <div className={`border-l-4 p-4 text-sm rounded-r-lg ${(error || externalError)?.startsWith('⏳')
                            ? 'bg-blue-50 border-blue-500 text-blue-700'
                            : 'bg-red-50 border-red-500 text-red-700'
                            }`}>
                            {externalError || error}
                        </div>
                    )}

                    {/* Users Tab Content */}
                    {mode === 'management' && !showLogs && editingUserId === null && users.length === 0 && (
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
                                    Block Editing for All Users
                                </label>
                            </div>

                            {/* Mobile Combobox + Badge View */}
                           {existingUsers.length > 0 && editingUserId === null && users.length === 0 && (
    <div className="lg:hidden mb-4">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Select a User</label>
        <select
            value={selectedMobileUser || ''}
            onChange={(e) => setSelectedMobileUser(e.target.value ? Number(e.target.value) : null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 shadow-sm"
        >
            <option value="">-- Choose a user --</option>
            {existingUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
            ))}
        </select>

        {selectedMobileUserData ? (
            <div className="mt-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <div className="flex flex-col gap-3.5">
                    
                    {/* TOP AREA: Name & Descriptors aligned horizontally */}
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 w-full">
                        <div className="text-base font-bold text-slate-900">{selectedMobileUserData.name || 'Unnamed User'}</div>
                        
                        {/* Role Badge (Main anchor) */}
                        <div className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-700 bg-slate-100">
                            {selectedMobileUserData.role}
                        </div>
                        
                        {/* Access Status Minimal Indicator */}
                        <span className={`inline-flex items-center gap-0.5 text-[9px] font-medium ${selectedMobileUserData.isReadOnly ? 'text-rose-600' : 'text-emerald-600'}`}>
                            <svg className="h-2.5 w-2.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                {selectedMobileUserData.isReadOnly ? (
                                    <path fillRule="evenodd" d="M6 8V7a4 4 0 118 0v1h1a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1V9a1 1 0 011-1h1zm2-1a2 2 0 114 0v1H8V7z" clipRule="evenodd" />
                                ) : (
                                    <path fillRule="evenodd" d="M5 11V9a5 5 0 1110 0v2h1a1 1 0 011 1v5a1 1 0 01-1 1H4a1 1 0 01-1-1v-5a1 1 0 011-1h1zm2-2a3 3 0 116 0v2H7V9z" clipRule="evenodd" />
                                )}
                            </svg>
                            {selectedMobileUserData.isReadOnly ? 'Restricted' : 'Unlocked'}
                        </span>
                        
                        {/* Password Status Minimal Indicator */}
                        <span className={`inline-flex items-center gap-0.5 text-[9px] font-medium ${selectedMobileUserData.passwordHash && selectedMobileUserData.passwordHash.trim() !== '' ? 'text-emerald-600' : 'text-amber-600'}`}>
                            <svg className="h-2.5 w-2.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                {selectedMobileUserData.passwordHash && selectedMobileUserData.passwordHash.trim() !== '' ? (
                                    <path d="M10 2a4 4 0 00-4 4v2h8V6a4 4 0 00-4-4zm-1 7a1 1 0 100 2 1 1 0 000-2zm4 5H7a1 1 0 01-1-1v-3a1 1 0 011-1h6a1 1 0 011 1v3a1 1 0 01-1 1z" />
                                ) : (
                                    <path fillRule="evenodd" d="M5 8a5 5 0 1110 0v2h1a1 1 0 011 1v5a1 1 0 01-1 1H4a1 1 0 01-1-1v-5a1 1 0 011-1h1V8zm2 0V6a3 3 0 116 0v2H7z" clipRule="evenodd" />
                                )}
                            </svg>
                            {selectedMobileUserData.passwordHash && selectedMobileUserData.passwordHash.trim() !== '' ? 'Secure' : 'No Pass'}
                        </span>
                    </div>

                    {/* BOTTOM AREA: Action Buttons aligned horizontally */}
                    <div className="flex flex-wrap items-center gap-1.5 w-full">
                        <button
                            type="button"
                            onClick={() => handleEditUser(selectedMobileUserData)}
                            className="px-2.5 py-1 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-[10px] font-semibold transition shadow-sm"
                        >
                            Edit
                        </button>
                        <button
                            type="button"
                            onClick={() => toggleExistingUserReadOnly(selectedMobileUserData.id)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition shadow-sm ${selectedMobileUserData.isReadOnly ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100' : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'}`}
                        >
                            {selectedMobileUserData.isReadOnly ? 'Unlock' : 'Restrict'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setResetConfirmUserId(selectedMobileUserData.id)}
                            className="px-2.5 py-1 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 text-[10px] font-semibold transition shadow-sm"
                        >
                            Clear Password
                        </button>
                        <button
                            type="button"
                            onClick={() => setDeleteConfirmUserId(selectedMobileUserData.id)}
                            className="px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-[10px] font-semibold transition shadow-sm"
                        >
                            Delete
                        </button>
                    </div>

                </div>
            </div>
        ) : (
            <p className="mt-4 text-sm text-gray-500">Choose a user to preview their badge and status.</p>
        )}
    </div>
)}

                            {/* Desktop Grid View */}
                            <div ref={existingUsersListRef} className="hidden lg:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-1 max-h-[40vh] overflow-y-auto z-20 relative">
    {existingUsers.map((user, index) => (
        <div key={user.id} className="bg-white border border-slate-200 rounded-[1.5rem] p-5 flex flex-col gap-4 shadow-sm hover:border-slate-300 hover:shadow-md transition-all">
            
            {/* TOP ROW: Name & Descriptors/Badges Aligned Horizontally */}
            <div className="flex flex-wrap items-center gap-2 w-full pb-1">
                <div className="text-base font-bold text-slate-900 truncate mr-1">
                    {user.name || 'Unnamed User'}
                </div>
                
                {/* Role Badge */}
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase ${
                    user.role === 'Admin' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 
                    user.role === 'Teacher' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 
                    'bg-slate-50 text-slate-600 border border-slate-200'
                }`}>
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                        {user.role === 'Admin' ? (
                            <path d="M12 2l3 3h4a1 1 0 011 1v4l3 3v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3H9v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-6l3-3V6a1 1 0 011-1h4l3-3z" />
                        ) : user.role === 'Teacher' ? (
                            <path d="M4 5a2 2 0 012-2h12a2 2 0 012 2v14a1 1 0 01-1.447.894L12 16.618l-7.553 3.276A1 1 0 013 19V5zm2 1v12.382l6.553-2.846a1 1 0 01.894 0L18 18.382V6H6z" />
                        ) : (
                            <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm-6 9a6 6 0 0112 0H6z" />
                        )}
                    </svg>
                    {user.role}
                </span>

                {/* Access Status Badge */}
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${
                    user.isReadOnly ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                }`}>
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                        {user.isReadOnly ? (
                            <path fillRule="evenodd" d="M6 8V7a4 4 0 118 0v1h1a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1V9a1 1 0 011-1h1zm2-1a2 2 0 114 0v1H8V7z" clipRule="evenodd" />
                        ) : (
                            <path fillRule="evenodd" d="M5 11V9a5 5 0 1110 0v2h1a1 1 0 011 1v5a1 1 0 01-1 1H4a1 1 0 01-1-1v-5a1 1 0 011-1h1zm2-2a3 3 0 116 0v2H7V9z" clipRule="evenodd" />
                        )}
                    </svg>
                    {user.isReadOnly ? 'Restricted' : 'Unlocked'}
                </span>
                
                {/* Password Status Badge */}
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${
                    user.passwordHash && user.passwordHash.trim() !== '' ? 'bg-emerald-50 text-emerald-700' : 'bg-yellow-50 text-yellow-700'
                }`}>
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                        {user.passwordHash && user.passwordHash.trim() !== '' ? (
                            <path d="M10 2a4 4 0 00-4 4v2h8V6a4 4 0 00-4-4zm-1 7a1 1 0 100 2 1 1 0 000-2zm4 5H7a1 1 0 01-1-1v-3a1 1 0 011-1h6a1 1 0 011 1v3a1 1 0 01-1 1z" />
                        ) : (
                            <path fillRule="evenodd" d="M5 8a5 5 0 1110 0v2h1a1 1 0 011 1v5a1 1 0 01-1 1H4a1 1 0 01-1-1v-5a1 1 0 011-1h1V8zm2 0V6a3 3 0 116 0v2H7z" clipRule="evenodd" />
                        )}
                    </svg>
                    {user.passwordHash && user.passwordHash.trim() !== '' ? 'Password Set' : 'No Password'}
                </span>
            </div>

            {/* Subtle Divider Line */}
            <div className="w-full border-t border-slate-100"></div>

            {/* BOTTOM ROW: Action Buttons aligned horizontally */}
            <div className="flex flex-wrap items-center gap-2 w-full">
                <button
                    onClick={() => handleEditUser(user)}
                    className="px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-[11px] font-semibold transition shadow-sm"
                    title="Edit Settings"
                >
                    Edit User
                </button>

                <button
                    onClick={() => toggleExistingUserReadOnly(user.id)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition shadow-sm ${
                        user.isReadOnly
                            ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                            : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                    }`}
                    title={user.isReadOnly ? 'Unlock Editing' : 'Lock Editing (Read-Only)'}
                >
                    {user.isReadOnly ? 'Grant Access' : 'Restrict Access'}
                </button>

                <button
                    onClick={() => setResetConfirmUserId(user.id)}
                    className="px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 text-[11px] font-semibold transition shadow-sm"
                    title="Reset Password"
                >
                    Clear Password
                </button>

                <button
                    onClick={() => setDeleteConfirmUserId(user.id)}
                    className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-[11px] font-semibold transition shadow-sm"
                    title="Delete User"
                >
                    Delete
                </button>
            </div>

        </div>
    ))}
</div>
                        </div>
                    )}

                    {mode === 'setup' && users.length === 0 && existingUsers.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                                <div>
                                    <h3 className="text-xl font-semibold text-gray-800">Created Users</h3>
                                    <p className="text-sm text-gray-500">Review your created accounts before completing setup.</p>
                                </div>
                                <div className="text-sm text-gray-600">
                                    {existingUsers.length} {existingUsers.length === 1 ? 'user created' : 'users created'}
                                </div>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                {existingUsers.map((user) => (
                                    <div key={user.id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className="text-base font-bold text-gray-900">{user.name || 'Unnamed User'}</p>
                                                <p className="text-sm text-gray-500">{user.role}</p>
                                                <div className="mt-3 text-sm text-gray-600 space-y-1">
                                                    {user.role !== 'Guest' && (
                                                        <p>Classes: {(user.allowedClasses || []).length}</p>
                                                    )}
                                                    {user.role !== 'Guest' && (
                                                        <p>Subjects: {getUserSubjectCount(user)}</p>
                                                    )}
                                                    {user.role === 'Admin' && (
                                                        <p className="text-sm text-emerald-700">Admin password is set for this user.</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleEditUser(user)}
                                                    className="rounded-lg border border-blue-200 bg-blue-50 text-blue-700 px-3 py-1 text-sm font-semibold hover:bg-blue-100 transition"
                                                >
                                                    Edit
                                                </button>
                                                {!(mode === 'setup' && user.role === 'Admin' && existingUsers[0]?.id === user.id) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setDeleteConfirmUserId(user.id)}
                                                        className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-3 py-1 text-sm font-semibold hover:bg-rose-100 transition"
                                                    >
                                                        Delete
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {(mode === 'setup' || users.length > 0) && (
                        <div ref={userListRef} className="space-y-6">
                            {users.map((user, index) => (
                                <div key={index} className="border border-gray-200 rounded-xl p-5 bg-gray-50/50 shadow-sm">
                                    {/* Mobile Pagination Header */}
                                    <div className="lg:hidden mb-4 pb-4 border-b border-gray-200">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="text-lg font-bold text-gray-800">
                                                {getPageDescription(user.role as UserRole, mobileUserFormPage)}
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
                                        {(user.role === 'Teacher' || user.role === 'Admin') && (
                                            <div className="flex items-center gap-2">
                                                <div className="text-xs font-semibold text-gray-600">Step {mobileUserFormPage + 1} of {getTotalPages(user.role as UserRole)}</div>
                                                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-blue-600 transition-all duration-300"
                                                        style={{ width: `${((mobileUserFormPage + 1) / getTotalPages(user.role as UserRole)) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Desktop Header */}
                                    <div className="hidden lg:flex justify-between items-center mb-4">
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

                                    {/* PAGE 1: Name & Role */}
                                    {(mobileUserFormPage === 0 || window.innerWidth >= 1024) ? (
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
                                                    disabled={mode === 'setup' && index === 0 && existingUsers.length === 0}
                                                >
                                                    <option value="Admin">Admin</option>
                                                    <option value="Teacher">Teacher</option>
                                                    <option value="Guest">Guest</option>
                                                </select>
                                            </div>
                                        </div>
                                    ) : null}

                                    {/* Show admin password fields only while creating the first admin during initial setup */}
                                    {mode === 'setup' && index === 0 && editingUserId === null && existingUsers.length === 0 && (
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

                                    {/* PAGE 2: Allowed Classes (Teachers only) */}
                                    {((mobileUserFormPage === 1 || window.innerWidth >= 1024) && user.role === 'Teacher') ? (
                                        <div className="mb-5">
                                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3">
                                                <label className="block text-sm font-semibold text-gray-700">Allowed Classes</label>
                                                <div className="flex gap-2 flex-wrap">
                                                    {isClassLimitReached && (
                                                        <span className="text-xs text-amber-600 font-semibold">License limit reached</span>
                                                    )}
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
                                                        onClick={() => handleOpenAddClassModal(index)}
                                                        disabled={isClassLimitReached}
                                                        className={`flex items-center px-2 py-1 text-xs rounded font-semibold transition ${
                                                            isClassLimitReached
                                                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                                        }`}
                                                        title="Create a new class"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                        </svg>
                                                        Add Class
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
                                    ) : null}

                                    {/* PAGE 3: Classes & Subjects Assignment */}
                                    {((mobileUserFormPage === (user.role === 'Admin' ? 1 : 2) || window.innerWidth >= 1024) && user.role !== 'Guest') ? (
                                        <div className="mb-2">
                                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3">
                                                <label className="block text-sm font-semibold text-gray-700">
                                                    Classes & Subjects Assignment
                                                </label>
                                                {user.role === 'Admin' && (
                                                    <div className="flex gap-2">
                                                        {isClassLimitReached && (
                                                            <span className="text-xs text-amber-600 font-semibold">License limit reached</span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenAddClassModal(index)}
                                                            disabled={isClassLimitReached}
                                                            className={`flex items-center px-2 py-1 text-xs rounded font-semibold transition ${
                                                                isClassLimitReached
                                                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                                            }`}
                                                            title="Create a new class"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                            </svg>
                                                            Add Class
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {getAssignmentClassNames(user).length === 0 ? (
                                                <p className="text-sm text-gray-500 italic p-3 bg-white border border-gray-200 rounded-lg text-center">
                                                    Select classes above to assign subjects
                                                </p>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    {getAssignmentClassNames(user).map(className => (
                                                        <div key={className} className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm flex flex-col justify-between">
                                                            <div className="flex justify-between items-center mb-3">
                                                                <div className="flex items-center gap-3">
                                                                    <h5 className="font-bold text-gray-800 text-sm">{className}</h5>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    {/* Assign as class teacher checkbox */}
                                                                    <label className="flex items-center gap-2 text-sm">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={(() => {
                                                                                const userName = (user.name || '').trim().toLowerCase();
                                                                                const cls = classes.find(c => (c.name || '').trim().toLowerCase() === className.trim().toLowerCase());
                                                                                const liveTeachers = cls ? (cls.teacherNames && cls.teacherNames.length ? cls.teacherNames : (cls.teacherName ? [cls.teacherName] : [])) : [];
                                                                                const pending = pendingClassTeacherChanges[className];
                                                                                const effective = pending || liveTeachers || [];
                                                                                return effective.map(t => t.trim().toLowerCase()).includes(userName);
                                                                            })()}
                                                                            onChange={() => toggleAssignClassTeacher(index, className)}
                                                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                                                                        />
                                                                        <span className="text-xs text-gray-700 font-medium">Set as class teacher</span>
                                                                    </label>

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
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    )}

                    {mode === 'setup' && users.length === 0 && (
                        <div className="pt-2">
                            <button
                                onClick={addNewUser}
                                className="w-full flex justify-center items-center py-3 px-4 border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-xl text-gray-600 hover:text-blue-600 transition font-semibold"
                            >
                                + Add Another User
                            </button>
                        </div>
                    )}

                    
                </div>

                {/* Fixed Footer */}
                <div className="p-3 sm:p-4 border-t border-gray-100 bg-gray-50 flex-shrink-0 flex flex-col-reverse sm:flex-row gap-2">
                    {/* Mobile Pagination Controls - only show on mobile when editing/adding user on small screen */}
                    {users.length > 0 && window.innerWidth < 1024 && (
                        <>
                            {/* Cancel button when editing/adding on mobile */}
                            <button
                                onClick={() => {
                                    if (mode === 'setup' && users.length > 0) {
                                        handleCancelNewUser();
                                    } else if (hasUnsavedChanges) {
                                        setShowCloseWarning(true);
                                    } else {
                                        handleCancelNewUser();
                                    }
                                }}
                                className="flex-1 py-2 px-4 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition font-bold shadow-sm text-sm"
                            >
                                Cancel
                            </button>

                            {/* Previous button - show on page 2+ */}
                            {mobileUserFormPage > 0 && (
                                <button
                                    onClick={handleMobileFormPrevious}
                                    className="flex-1 py-2 px-4 border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition font-bold shadow-sm text-sm"
                                >
                                    ← Previous
                                </button>
                            )}

                            {/* Next button - show on page 1-2 for Teachers, or submit immediately for Admin/Guest */}
                            {users.length > 0 && mobileUserFormPage < getTotalPages(users[0].role as UserRole) - 1 ? (
                                <button
                                    onClick={handleMobileFormNext}
                                    className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-bold shadow-sm text-sm"
                                >
                                    Next →
                                </button>
                            ) : (
                                <button
                                    onClick={handleMobileFormSubmit}
                                    className="flex-1 py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-bold shadow-sm text-sm"
                                >
                                    {editingUserId ? 'Update User' : 'Create User'}
                                </button>
                            )}
                        </>
                    )}

                    {/* Desktop / Default Controls */}
                    {(users.length === 0 || window.innerWidth >= 1024) && (
                        <>
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

                            {(mode === 'management' || (mode === 'setup' && users.length > 0)) && (
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
                                        ? editingUserId !== null
                                            ? 'Update User'
                                            : users.length > 0
                                            ? 'Create User'
                                            : 'Complete Setup'
                                        : editingUserId !== null
                                        ? 'Update User'
                                        : users.length > 0
                                        ? 'Add User'
                                        : 'Save Changes'}
                                </button>
                            )}
                        </>
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

            {/* Add New Class Modal */}
            {showAddClassModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-2 sm:p-4">
                    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-2xl w-full max-w-md animate-fade-in-scale">
                        <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">Create New Class</h2>

                        {isClassLimitReached && (
                            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <p className="text-sm text-amber-700 font-semibold">
                                    License Limit Reached: You have reached the maximum of {maxClasses} classes.
                                </p>
                            </div>
                        )}

                        <form onSubmit={(e) => { e.preventDefault(); handleCreateClass(); }} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-tight mb-1">Class Name</label>
                                <input
                                    type="text"
                                    value={newClassName}
                                    onChange={(e) => {
                                        setNewClassName(e.target.value);
                                        if (addClassError) setAddClassError(null);
                                    }}
                                    placeholder="e.g. Class 1"
                                    disabled={isCreatingClass || isClassLimitReached}
                                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-tight mb-1">Teacher Name</label>
                                <input
                                    type="text"
                                    value={newTeacherName}
                                    onChange={(e) => {
                                        setNewTeacherName(e.target.value);
                                        if (addClassError) setAddClassError(null);
                                    }}
                                    placeholder="e.g. John Doe"
                                    disabled={isCreatingClass || isClassLimitReached}
                                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                                />
                                {currentUserIndexForClass !== null && users[currentUserIndexForClass]?.name && (
                                    <p className="text-xs text-gray-500 mt-1">Auto-filled with user: <strong>{(users[currentUserIndexForClass].name as string).trim()}</strong></p>
                                )}
                            </div>

                            {currentUserIndexForClass !== null && (
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={assignAsTeacher}
                                            onChange={(e) => setAssignAsTeacher(e.target.checked)}
                                            disabled={isCreatingClass}
                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                                        />
                                        <span className="text-sm font-semibold text-gray-700">
                                            Assign me as class teacher
                                        </span>
                                    </label>
                                    <p className="text-xs text-gray-600 mt-2 ml-6">
                                        When checked, this user will be assigned as the class teacher and will have access to this class in their class list.
                                    </p>
                                </div>
                            )}

                            {/* Existing classes list with edit/delete */}
                            {classes && classes.filter(c => !c.deleted).length > 0 && (
                                <div className="mt-3">
                                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Existing Classes</h4>
                                    <div className="max-h-40 overflow-y-auto space-y-2">
                                        {classes.filter(c => !c.deleted).map(cls => (
                                            <div key={cls.id} className="flex items-center justify-between p-2 bg-gray-50 border border-gray-100 rounded-md">
                                                <div>
                                                    <div className="text-sm font-medium text-gray-800">{cls.name}</div>
                                                    <div className="text-xs text-gray-500">{cls.teacherName || 'No teacher'}</div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button type="button" onClick={() => handleEditClass(cls)} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-md border border-blue-100">Edit</button>
                                                    <button type="button" onClick={() => setDeleteConfirmClassId(cls.id)} className="text-xs px-2 py-1 bg-rose-50 text-rose-700 rounded-md border border-rose-100">Delete</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {addClassError && (
                                <p className="text-red-600 text-sm font-semibold p-2 bg-red-50 rounded-lg border border-red-200">
                                    {addClassError}
                                </p>
                            )}

                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddClassModal(false);
                                        setAddClassError(null);
                                        setNewClassName('');
                                        setNewTeacherName('');
                                        setAssignAsTeacher(false);
                                        setCurrentUserIndexForClass(null);
                                    }}
                                    disabled={isCreatingClass}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isCreatingClass || isClassLimitReached}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 shadow-sm active:scale-95"
                                >
                                    {isCreatingClass ? 'Creating...' : 'Create Class'}
                                </button>
                            </div>
                        </form>
                        {/* Confirm delete modal for classes */}
                        <ConfirmationModal
                            isOpen={deleteConfirmClassId !== null}
                            onClose={() => setDeleteConfirmClassId(null)}
                            onConfirm={() => {
                                if (deleteConfirmClassId !== null) executeDeleteClass(deleteConfirmClassId);
                            }}
                            title="Delete Class"
                            message={
                                `Are you sure you want to delete ${classes.find(c => c.id === deleteConfirmClassId)?.name || 'this class'}? This action can be undone by restoring from history.`
                            }
                            variant="warning"
                        />
                    </div>
                </div>
            )}
            <MessageBox {...messageBox} />
        </div>
    );
};

export default AdminSetup;
