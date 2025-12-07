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
    onCancel?: () => void;
}

const AdminSetup: React.FC<AdminSetupProps> = ({ mode, users: initialUsers, currentUser, onComplete, onCancel }) => {
    const { classes, subjects } = useData();
    const { logout } = useUser();
    const [users, setUsers] = useState<Partial<User>[]>(mode === 'setup' ? [{ role: 'Admin' as UserRole, allowedClasses: [], allowedSubjects: [] }] : []);
    const [existingUsers, setExistingUsers] = useState<User[]>(initialUsers);
    const [adminPassword, setAdminPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [editingUserId, setEditingUserId] = useState<number | null>(null);
    const [deleteConfirmUserId, setDeleteConfirmUserId] = useState<number | null>(null);

    const classNames = classes.map(c => c.name);
    const subjectNames = subjects.map(s => s.subject);

    const addNewUser = () => {
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
        updateUser(index, 'allowedClasses', newClasses);
    };

    const toggleSubject = (index: number, subjectName: string) => {
        const user = users[index];
        const currentSubjects = user.allowedSubjects || [];
        const newSubjects = currentSubjects.includes(subjectName)
            ? currentSubjects.filter(s => s !== subjectName)
            : [...currentSubjects, subjectName];
        updateUser(index, 'allowedSubjects', newSubjects);
    };

    const toggleAllClasses = (index: number) => {
        const user = users[index];
        const allSelected = (user.allowedClasses || []).length === classNames.length;
        updateUser(index, 'allowedClasses', allSelected ? [] : [...classNames]);
    };

    const toggleAllSubjects = (index: number) => {
        const user = users[index];
        const allSelected = (user.allowedSubjects || []).length === subjectNames.length;
        updateUser(index, 'allowedSubjects', allSelected ? [] : [...subjectNames]);
    };

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

        // Create final user list with IDs and hashed passwords (if in setup mode)
        const finalUsers: User[] = await Promise.all(
            users.map(async (u, index) => ({
                id: mode === 'setup' ? Date.now() + index : (u.id || Date.now() + index),
                name: u.name!,
                role: u.role!,
                allowedClasses: u.role === 'Admin' ? classNames : (u.allowedClasses || []),
                allowedSubjects: u.role === 'Admin' ? subjectNames : (u.allowedSubjects || []),
                passwordHash: mode === 'setup' && index === 0
                    ? await hashPassword(adminPassword)
                    : (u.passwordHash || ''),
            }))
        );

        onComplete(finalUsers, mode === 'setup' ? adminPassword : undefined);
    };

    const handleEditUser = (user: User) => {
        setEditingUserId(user.id);
        setUsers([{ ...user }]);
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
                    allowedSubjects: updatedUser.role === 'Admin' ? subjectNames : (updatedUser.allowedSubjects || []),
                }
                : u
        );

        setExistingUsers(updatedUsers);
        setEditingUserId(null);
        setUsers([]);
        setError(null);
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

        setExistingUsers(existingUsers.filter(u => u.id !== userId));
        setDeleteConfirmUserId(null);
        setError(null);

        // If user deleted themselves, logout
        if (isDeletingSelf && mode === 'management') {
            // Save changes first
            const updatedUsers = existingUsers.filter(u => u.id !== userId);
            onComplete(updatedUsers);
            // Then logout
            setTimeout(() => {
                logout();
            }, 500);
        }
    };

    const handleSaveManagement = async () => {
        // If we have users in the editing form, save them first
        if (users.length > 0) {
            const newUser = users[0];
            if (!newUser.name || newUser.name.trim() === '') {
                setError('User must have a name');
                return;
            }

            const finalUser: User = {
                id: Date.now(),
                name: newUser.name!,
                role: newUser.role!,
                allowedClasses: newUser.role === 'Admin' ? classNames : (newUser.allowedClasses || []),
                allowedSubjects: newUser.role === 'Admin' ? subjectNames : (newUser.allowedSubjects || []),
                passwordHash: '',
            };

            const updatedUsers = [...existingUsers, finalUser];
            setExistingUsers(updatedUsers);
            setUsers([]);
            setError(null);
            return;
        }

        // Otherwise just save existing users
        onComplete(existingUsers);
    };

    const handleCancelNewUser = () => {
        setUsers([]);
        setEditingUserId(null);
        setError(null);
    };

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-95 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-2xl p-6 md:p-8 max-w-4xl w-full my-8">
                <div className="text-center mb-6">
                    <h2 className="text-3xl font-bold text-gray-800">
                        {mode === 'setup' ? 'Admin Setup - Register Users' : 'User Management'}
                    </h2>
                    {mode === 'setup' && (
                        <p className="text-gray-600 mt-2">
                            Welcome! Please register users for your school. The first user will be the administrator.
                        </p>
                    )}
                </div>

                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {mode === 'management' && editingUserId === null && (
                    <div className="mb-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-semibold text-gray-700">
                                Existing Users ({existingUsers.length})
                            </h3>
                            <button
                                onClick={addNewUser}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                            >
                                + Add New User
                            </button>
                        </div>
                        <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                            {existingUsers.map((user, index) => (
                                <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                            {index + 1}
                                        </span>
                                        <div>
                                            <span className="font-medium">{user.name}</span>
                                            <span className="ml-3 text-sm text-gray-600">({user.role})</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleEditUser(user)}
                                            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => setDeleteConfirmUserId(user.id)}
                                            className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {(mode === 'setup' || users.length > 0) && (
                    <div className="space-y-6 max-h-96 overflow-y-auto">
                        {users.map((user, index) => (
                            <div key={index} className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="text-lg font-semibold text-gray-700">
                                        {mode === 'setup' && index === 0 ? 'Admin User' : `User ${index + 1}`}
                                    </h4>
                                    {mode === 'setup' && index > 0 && (
                                        <button
                                            onClick={() => removeUser(index)}
                                            className="text-red-600 hover:text-red-800 text-sm"
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                        <input
                                            type="text"
                                            value={user.name || ''}
                                            onChange={(e) => updateUser(index, 'name', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Enter user name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                                        <select
                                            value={user.role || 'Teacher'}
                                            onChange={(e) => updateUser(index, 'role', e.target.value as UserRole)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                            disabled={mode === 'setup' && index === 0}
                                        >
                                            <option value="Admin">Admin</option>
                                            <option value="Teacher">Teacher</option>
                                            <option value="Guest">Guest</option>
                                        </select>
                                    </div>
                                </div>

                                {user.role !== 'Admin' && (
                                    <>
                                        <div className="mb-4">
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="block text-sm font-medium text-gray-700">Allowed Classes</label>
                                                <button
                                                    onClick={() => toggleAllClasses(index)}
                                                    className="text-xs text-blue-600 hover:text-blue-800"
                                                >
                                                    {(user.allowedClasses || []).length === classNames.length ? 'Deselect All' : 'Select All'}
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {classNames.map(className => (
                                                    <button
                                                        key={className}
                                                        onClick={() => toggleClass(index, className)}
                                                        className={`px-3 py-1 text-sm rounded-full transition ${(user.allowedClasses || []).includes(className)
                                                            ? 'bg-blue-600 text-white'
                                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                            }`}
                                                    >
                                                        {className}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="block text-sm font-medium text-gray-700">Allowed Subjects</label>
                                                <button
                                                    onClick={() => toggleAllSubjects(index)}
                                                    className="text-xs text-blue-600 hover:text-blue-800"
                                                >
                                                    {(user.allowedSubjects || []).length === subjectNames.length ? 'Deselect All' : 'Select All'}
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {subjectNames.map(subjectName => (
                                                    <button
                                                        key={subjectName}
                                                        onClick={() => toggleSubject(index, subjectName)}
                                                        className={`px-3 py-1 text-sm rounded-full transition ${(user.allowedSubjects || []).includes(subjectName)
                                                            ? 'bg-green-600 text-white'
                                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                            }`}
                                                    >
                                                        {subjectName}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {mode === 'setup' && (
                    <>
                        <div className="mt-6">
                            <button
                                onClick={addNewUser}
                                className="w-full flex justify-center items-center py-2 px-4 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-blue-500 hover:text-blue-600 transition"
                            >
                                + Add Another User
                            </button>
                        </div>

                        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Password</label>
                                <input
                                    type="password"
                                    value={adminPassword}
                                    onChange={(e) => setAdminPassword(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Set admin password"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Confirm password"
                                />
                            </div>
                        </div>
                    </>
                )}

                <div className="mt-6 flex gap-3">
                    {onCancel && mode === 'management' && users.length === 0 && (
                        <button
                            onClick={onCancel}
                            className="flex-1 py-3 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition"
                        >
                            Close
                        </button>
                    )}
                    {mode === 'management' && users.length > 0 && (
                        <button
                            onClick={handleCancelNewUser}
                            className="flex-1 py-3 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition"
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        onClick={mode === 'management' && editingUserId !== null ? handleUpdateExistingUser :
                            mode === 'management' ? handleSaveManagement : handleSubmit}
                        className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                    >
                        {mode === 'setup' ? 'Complete Setup' :
                            editingUserId !== null ? 'Update User' :
                                users.length > 0 ? 'Add User' : 'Save Changes'}
                    </button>
                </div>
            </div>

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
