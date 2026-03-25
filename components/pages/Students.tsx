import React, { useState, useMemo, useEffect, useRef } from 'react';
import CameraCapture from '../CameraCapture';
import { useData } from '../../context/DataContext';
import type { Student } from '../../types';
import ConfirmationModal from '../ConfirmationModal';
import { useFirebaseAnalytics } from '../../context/FirebaseAnalyticsContext';
import RestoreModal from '../modals/RestoreModal';
import { enhanceImage } from '../../services/geminiService';
import { AI_FEATURES_ENABLED, DIRTY_INDICATOR_BG, DIRTY_INDICATOR_TEXT, DIRTY_INDICATOR_SECONDARY_TEXT, DIRTY_INDICATOR_HOVER_BG, DIRTY_INDICATOR_BORDER } from '../../constants';
import { useUser } from '../../context/UserContext';
import ReadOnlyWrapper from '../ReadOnlyWrapper';
import { getAvailableClasses, canManageStudentsInClass } from '../../utils/permissions';
import { processImageForUpload, validateImageSize } from '../../utils/imageUtils';
import { generateIndexNumber } from '../../utils/indexNumberGenerator';
import { getNextAvailableCounter } from '../../utils/indexNumberCounter';
import { sortClassesByName } from '../../utils/classSort';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';
import { useUserAction } from '../../context/UserActionContext';
import useLocalStorage from '../../hooks/useLocalStorage';
import type { Page, NavigationMeta } from '../../types';

interface StudentsProps {
    onNavigate?: (page: Page, meta?: NavigationMeta) => void;
}

const EMPTY_STUDENT_FORM: Omit<Student, 'id'> = {
    name: '',
    indexNumber: '',
    gender: 'Male',
    class: '',
    dateOfBirth: '',
    age: '',
    picture: '',
};

const USER_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjZDFkOSI+PHBhdGggZD0iTTI0IDIwLjk5M1YyNEgwdjItMi45OTdBNTQuOTc3IDE0Ljk3NyAwIDAxMTIuMDA0IDE1YzQuOTA0IDAgOS4yNiAyLjM1NCAxMS45OTYgNS45OTN6TTE2LjAwMiA4Ljk5OWE0IDQgMCAxMS04IDAgNCA0IDAgMDE4IDB6IiAvPjwvc3ZnPg==';

const calculateAge = (dobString: string): string => {
    if (!dobString || !/^\d{4}-\d{2}-\d{2}$/.test(dobString)) return '';
    const dob = new Date(dobString);
    const today = new Date();
    if (dob.getTime() > today.getTime()) return ''; // Can't be born in the future
    let age = today.getFullYear() - dob.getFullYear();
    const monthDifference = today.getMonth() - dob.getMonth();
    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < dob.getDate())) {
        age--;
    }
    return age >= 1 ? age.toString() : '';
};


const Students: React.FC<StudentsProps> = ({ onNavigate }) => {
    const { recordAction } = useUserAction();
    const dataContext = useData();
    const { students, deletedStudents, restoreItem, permanentlyDeleteItem, classes, addStudent, updateStudent, updateClass, deleteStudent, saveStudents, isDirty, isItemDirty, isSyncing, isOnline, settings, updateSettings, loadStudents, subscription } = dataContext;
    const { currentUser, isAuthenticated } = useUser();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
    const [currentStudent, setCurrentStudent] = useState<Student | Omit<Student, 'id'> | null>(null);
    const firstInputRef = React.useRef<HTMLInputElement>(null);

    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isPermanentConfirmOpen, setIsPermanentConfirmOpen] = useState(false);
    const [itemIdToDelete, setItemIdToDelete] = useState<number | null>(null);
    const [idToPermanentlyDelete, setIdToPermanentlyDelete] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    // Preserve selected class filter
    const [selectedClass, setSelectedClass] = useLocalStorage<string>(`selected_class_${settings.schoolName || 'default'}`, '');
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
    const [sessionAddedIds, setSessionAddedIds] = useState<number[]>([]);
    const [isSessionListOpen, setIsSessionListOpen] = useState(false);
    const [modalError, setModalError] = useState<string | null>(null);
    const hasSetDefaultClass = useRef(false);

    // Auto-focus logic: Trigger ONLY on initial modal open
    React.useEffect(() => {
        if (isModalOpen && firstInputRef.current) {
            const timer = setTimeout(() => {
                firstInputRef.current?.focus();
                firstInputRef.current?.select();
            }, 100);
            return () => clearTimeout(timer);
        }
        if (!isModalOpen) {
            setSessionAddedIds([]);
            setIsSessionListOpen(false);
        }
    }, [isModalOpen]);

    const inputStyles = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500";
    const searchInputStyles = "w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

    // Filter students based on user permissions
    const accessibleStudents = useMemo(() => {
        if (!isAuthenticated || !currentUser) return students;
        if (currentUser.role === 'Admin') return students;
        // Teachers and Guests are restricted to allowed classes
        return students.filter(s => currentUser.allowedClasses.includes(s.class));
    }, [students, currentUser, isAuthenticated]);

    // Derived list of classes available for "Add Student" or filtering
    const availableClasses = useMemo(() => {
        const available = getAvailableClasses(currentUser, classes);
        // De-duplicate by class name to prevent redundant entries in the dropdown
        const unique = available.filter((cls, index, self) =>
            index === self.findIndex((t) => (t.name || '').trim() === (cls.name || '').trim())
        );
        return sortClassesByName(unique);
    }, [currentUser, classes]);

    // Initialize default class selection to first available class (only if none stored or stored is invalid)
    useEffect(() => {
    if (availableClasses.length > 0) {
        // Check if current selection is "All Classes" OR a valid specific class
        const isAllClassesSelected = currentUser?.role === 'Admin' && selectedClass === '';
        const isCurrentValid = isAllClassesSelected || (selectedClass && availableClasses.some(c => c.name === selectedClass));

        if (!isCurrentValid && !isAllClassesSelected) {
            const fallback = availableClasses[0].name;
            setSelectedClass(fallback);
        }
        hasSetDefaultClass.current = true;
    }
}, [availableClasses, selectedClass, setSelectedClass, currentUser]);

    // Lazy Load Students on Mount
    useEffect(() => {
        loadStudents();
    }, [loadStudents]);

    const filteredStudents = useMemo(() => {
        const query = searchQuery.toLowerCase();
        let results = [...accessibleStudents];

        // Apply standardized sort: Gender (Desc) -> Name (Asc)
        results.sort((a, b) => {
            if (a.gender !== b.gender) {
                return b.gender.localeCompare(a.gender);
            }
            return a.name.localeCompare(b.name);
        });

        // Filter by selected class
        if (selectedClass) {
            results = results.filter(student => student.class === selectedClass);
        }

        // Filter by search query
        if (query) {
            results = results.filter(student =>
                (student.name || '').toLowerCase().includes(query) ||
                (student.indexNumber || '').toLowerCase().includes(query) ||
                (student.class || '').toLowerCase().includes(query)
            );
        }

        return results;
    }, [accessibleStudents, selectedClass, searchQuery]);



    const visibleDeletedStudents = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.role === 'Admin') return deletedStudents;
        return deletedStudents.filter(s => s.deletedBy === currentUser.id);
    }, [deletedStudents, currentUser]);

    const handleExportExcel = () => {
        const headers = ['Name', 'Index Number', 'Gender', 'Class', 'Date of Birth', 'Age'];
        const keys = ['name', 'indexNumber', 'gender', 'class', 'dateOfBirth', 'age'];
        const data = filteredStudents.map(s => ({
            ...s,
            age: calculateAge(s.dateOfBirth)
        }));
        exportToExcel(data, headers, keys, 'Students_List', 'Students');
    };

    const handleExportPDF = () => {
        const headers = ['Name', 'Index Number', 'Gender', 'Class', 'Date of Birth', 'Age'];
        const data = filteredStudents.map(s => [
            s.name,
            s.indexNumber,
            s.gender,
            s.class,
            s.dateOfBirth,
            calculateAge(s.dateOfBirth)
        ]);
        exportToPDF('Students List', headers, data, 'Students_List');
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            if (!validateImageSize(e.target.files[0])) {
                e.target.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = async (event) => {
                const raw = event.target?.result as string;
                try {
                    const processed = await processImageForUpload(raw);
                    setCurrentStudent(prev => prev ? { ...prev, picture: processed } : null);
                } catch {
                    setCurrentStudent(prev => prev ? { ...prev, picture: raw } : null);
                }
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const handleCameraCapture = async (imageData: string) => {
        try {
            const processed = await processImageForUpload(imageData);
            setCurrentStudent(prev => prev ? { ...prev, picture: processed } : null);
        } catch {
            setCurrentStudent(prev => prev ? { ...prev, picture: imageData } : null);
        }
    };

    const handleClearImage = () => {
        setCurrentStudent(prev => prev ? { ...prev, picture: '' } : null);
    };

    const handleEnhanceImage = async () => {
        if (!currentStudent?.picture) {
            alert("Please upload a picture first.");
            return;
        }
        setIsEnhancing(true);
        try {
            const enhancedImage = await enhanceImage(currentStudent.picture);
            setCurrentStudent(prev => prev ? { ...prev, picture: enhancedImage } : null);
        } catch (error) {
            console.error(error);
            alert((error as Error).message);
        } finally {
            setIsEnhancing(false);
        }
    };

    const handleAddNew = () => {
        setModalError(null);
        setCurrentStudent({
            ...EMPTY_STUDENT_FORM,
            class: selectedClass || ''
        });
        setIsModalOpen(true);
        recordAction('Opened modal to add new student');
    };


    const handleEdit = (student: Student) => {
        if (!canManageStudentsInClass(currentUser, student.class)) {
            alert("You do not have permission to edit students in this class.");
            return;
        }
        setModalError(null);
        setCurrentStudent(student);
        setIsModalOpen(true);
        recordAction(`Opened modal to edit student: ${student.name}`);
    };


    const handleDeleteClick = (id: number) => {
        const student = students.find(s => s.id === id);
        if (student && !canManageStudentsInClass(currentUser, student.class)) {
            alert("You do not have permission to delete students from this class.");
            return;
        }
        setItemIdToDelete(id);
        setIsConfirmOpen(true);
    };

    const handleConfirmDelete = () => {
        if (itemIdToDelete !== null) {
            deleteStudent(itemIdToDelete);
        }
        setIsConfirmOpen(false);
        setItemIdToDelete(null);
    };

    const handlePermanentDeleteClick = (id: number) => {
        setIdToPermanentlyDelete(id);
        setIsPermanentConfirmOpen(true);
    };

    const handleConfirmPermanentDelete = () => {
        if (idToPermanentlyDelete !== null) {
            permanentlyDeleteItem('students', idToPermanentlyDelete);
        }
        setIsPermanentConfirmOpen(false);
        setIdToPermanentlyDelete(null);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentStudent(null);
        setSaveFeedback(null);
        setModalError(null);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (modalError) setModalError(null);
        setCurrentStudent(prev => {
            if (!prev) return null;
            const updatedStudent = { ...prev, [name]: value };
            if (name === 'dateOfBirth') {
                updatedStudent.age = calculateAge(value);
            }
            return updatedStudent;
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        recordAction(`Clicked Commit on ${currentStudent && 'id' in currentStudent ? 'Edit' : 'Add'} Student modal`);
        if (!currentStudent) return;


        // Check auto-assignment mode
        const isAutoAssignMode = settings.autoAssignIndexNumbers;

        if (isAutoAssignMode) {
            // In auto-assign mode, only name and class are required
            if (!currentStudent.name.trim() || !currentStudent.class) {
                setModalError("Please ensure Name and Class are filled out.");
                return;
            }
        } else {
            // In manual mode, index number is also required
            if (!currentStudent.name.trim() || !currentStudent.indexNumber.trim() || !currentStudent.class) {
                setModalError("Please ensure Name, Index Number, and Class are filled out.");
                return;
            }
        }

        if ('id' in currentStudent) {
            // Editing existing student
            updateStudent(currentStudent);
        } else {
            // Adding new student
            let studentToAdd = { ...currentStudent };

            // Auto-generate index number if enabled
            if (isAutoAssignMode) {
                // Find the class object for class-specific config
                const classObj = classes.find(c => c.name === studentToAdd.class);

                // Get the next available counter (checks existing students to avoid duplicates)
                const nextCounter = getNextAvailableCounter(students, settings, classObj);

                // Generate the index number using the next available counter
                studentToAdd.indexNumber = generateIndexNumber(settings, classObj, nextCounter);

                // Increment the appropriate counter
                if (settings.indexNumberPerClass && classObj) {
                    // Update class counter correctly via updateClass
                    updateClass({
                        ...classObj,
                        indexNumberCounter: (classObj.indexNumberCounter || 1) + 1
                    });
                } else {
                    // Update global counter
                    updateSettings({ indexNumberGlobalCounter: nextCounter + 1 });
                }
            }

            const newId = addStudent(studentToAdd);
            if (newId) {
                setSessionAddedIds(prev => [newId, ...prev]);
            }

            // STAY OPEN ON ADD for continuous entry
            setSaveFeedback(`Student "${studentToAdd.name}" Added!`);
            setCurrentStudent({
                ...EMPTY_STUDENT_FORM,
                class: studentToAdd.class, // Maintain context
                gender: studentToAdd.gender
            });

            // Explicit focus AND select for batch entry (after reset)
            setTimeout(() => {
                if (firstInputRef.current) {
                    firstInputRef.current.focus();
                    firstInputRef.current.select();
                }
            }, 150);

            // Vanish after 3s
            setTimeout(() => setSaveFeedback(null), 3000);
            return; // Don't close modal
        }
        handleCloseModal();
    };
    const maxStudents = subscription?.maxStudents || Infinity;
    const isLimitReached = students.length >= maxStudents;

    return (
        <div className="space-y-6">
            {isLimitReached && (
                <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-md shadow-sm animate-pulse">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-amber-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-amber-700">
                                <span className="font-bold">License Limit Reached:</span> You have reached the maximum number of students ({maxStudents}) allowed by your current subscription. Please upgrade your license to add more students.
                            </p>
                        </div>
                    </div>
                </div>
            )}
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-800">Manage Students</h1>

                {/* Save Button */}
                {/* Save Button Removed - Using Global Action Bar */}
            </div>

            <div className="bg-gray-100 py-4">
                <div className="flex flex-col md:flex-row justify-start items-center gap-4">
                    {/* Class Filter Dropdown */}
                    <select
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                        className="w-full md:w-1/4 px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        {currentUser?.role === 'Admin' && <option value="">All Classes</option>}
                        {availableClasses.map(cls => (
                            <option key={cls.id} value={cls.name}>{cls.name}</option>
                        ))}
                    </select>

                    {/* Search Input */}
                    <div className="relative w-full md:w-1/3">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Search by name, index no, or class..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={searchInputStyles}
                        />
                    </div>

                    {/* Add Student Button */}
                    <ReadOnlyWrapper allowedRoles={['Admin', 'Teacher']}>
                        {(currentUser?.role === 'Admin' || (currentUser?.role === 'Teacher' && currentUser.allowedClasses.length > 0)) && (
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleAddNew}
                                    disabled={isLimitReached}
                                    className={`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition shadow-sm ${isLimitReached ? 'bg-gray-400 cursor-not-allowed opacity-75' : 'bg-blue-600 hover:bg-blue-700'}`}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                    <span>Add Student</span>
                                </button>
                                <button
                                    onClick={handleExportExcel}
                                    className="p-2 hover:bg-gray-100 rounded-full transition-colors group"
                                    title="Export to Excel"
                                >
                                    <svg className="w-8 h-8 text-green-600 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 16 16">
                                        <path d="M9.293 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.707A1 1 0 0 0 13.707 4L10 .293A1 1 0 0 0 9.293 0zM9.5 3.5v-2l3 3h-2a1 1 0 0 1-1-1zM5.884 6.68 8 9.219l2.116-2.54a.5.5 0 1 1 .768.641L8.651 10l2.233 2.68a.5.5 0 0 1-.768.64L8 10.781l-2.116 2.54a.5.5 0 0 1-.768-.641L7.349 10 5.116 7.32a.5.5 0 1 1 .768-.64z" />
                                    </svg>
                                </button>
                                <button
                                    onClick={handleExportPDF}
                                    className="p-2 hover:bg-gray-100 rounded-full transition-colors group"
                                    title="Export to PDF"
                                >
                                    <svg className="w-8 h-8 text-red-600 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M20 2H8c-1.1 0-2 .9-2 2v12H4v5c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5v1.5H19v2h-1.5V7h2V8.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z" />
                                    </svg>
                                </button>
                                {visibleDeletedStudents.length > 0 && (
                                    <button
                                        onClick={() => setIsRestoreModalOpen(true)}
                                        className="flex items-center space-x-2 px-3 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition shadow-sm font-semibold ml-2 border border-red-200"
                                        title="Restore Deleted Students"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                        </svg>
                                        <span className="hidden sm:inline">Restore</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </ReadOnlyWrapper>
                </div>
            </div>

            {/* Desktop Table View */}
            <ReadOnlyWrapper allowedRoles={['Admin', 'Teacher']}>
                <div className="hidden lg:block bg-white p-6 rounded-xl shadow-md border border-gray-200">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50 border-b">
                                    <th className="p-4 font-semibold text-gray-600">#</th>
                                    <th className="p-4 font-semibold text-gray-600">Photo</th>
                                    <th className="p-4 font-semibold text-gray-600">Index Number</th>
                                    <th className="p-4 font-semibold text-gray-600">Name</th>
                                    <th className="p-4 font-semibold text-gray-600">Class</th>
                                    <th className="p-4 font-semibold text-gray-600">Gender</th>
                                    <th className="p-4 font-semibold text-gray-600">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStudents.length > 0 ? (
                                    filteredStudents.map((student, index) => {
                                        const canManage = canManageStudentsInClass(currentUser, student.class);
                                        const isDirtyRow = isItemDirty('students', student.id);
                                        return (
                                            <tr key={student.id} className={`border-b transition-colors ${isDirtyRow ? `${DIRTY_INDICATOR_BG} ${DIRTY_INDICATOR_TEXT} ${DIRTY_INDICATOR_HOVER_BG}` : 'hover:bg-gray-50'}`}>
                                                <td className="p-4 relative">
                                                    {index + 1}
                                                    {isDirtyRow && (
                                                        <span className="absolute left-0 top-0 text-[10px] font-bold uppercase tracking-wider px-1 py-0.5 bg-yellow-400 text-black leading-none rounded-br z-10">
                                                            Unsaved
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-2">
                                                    <img src={student.picture || USER_PLACEHOLDER} alt={student.name} className="h-10 w-10 rounded-full object-cover bg-gray-200" />
                                                </td>
                                                <td className={`p-4 ${isDirtyRow ? DIRTY_INDICATOR_SECONDARY_TEXT : 'text-gray-900'}`}>{student.indexNumber}</td>
                                                <td className="p-4 font-medium">{student.name}</td>
                                                <td className={`p-4 ${isDirtyRow ? DIRTY_INDICATOR_SECONDARY_TEXT : 'text-gray-900'}`}>{student.class}</td>
                                                <td className={`p-4 ${isDirtyRow ? DIRTY_INDICATOR_SECONDARY_TEXT : 'text-gray-900'}`}>{student.gender}</td>
                                                <td className="p-4 space-x-4 flex items-center">
                                                    {canManage && (
                                                        <>
                                                            <button onClick={() => handleEdit(student)} className={`${isDirtyRow ? `${DIRTY_INDICATOR_SECONDARY_TEXT} hover:text-white` : 'text-blue-600 hover:text-blue-800'}`} title="Edit">
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" />
                                                                </svg>
                                                            </button>
                                                            <button onClick={() => handleDeleteClick(student.id)} className={`${isDirtyRow ? 'text-white hover:text-gray-200 opacity-90' : 'text-red-600 hover:text-red-800'}`} title="Delete">
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                </svg>
                                                            </button>
                                                        </>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={7} className="text-center p-8 text-gray-500">
                                            No students found matching your search.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden space-y-4">
                    {filteredStudents.length > 0 ? (
                        filteredStudents.map((student, index) => {
                            const canManage = canManageStudentsInClass(currentUser, student.class);
                            const isDirtyRow = isItemDirty('students', student.id);
                            return (
                                <div key={student.id} className={`p-4 rounded-xl shadow-md border transition-colors relative ${isDirtyRow ? `${DIRTY_INDICATOR_BG} ${DIRTY_INDICATOR_BORDER} ${DIRTY_INDICATOR_TEXT}` : 'bg-white border-gray-200'}`}>
                                    {isDirtyRow && (
                                        <div className="absolute top-0 right-0 bg-yellow-400 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-bl uppercase z-10">
                                            Unsaved
                                        </div>
                                    )}
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center space-x-4">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center relative">
                                                <div className={`absolute inset-0 rounded-full opacity-20 ${isDirtyRow ? 'bg-white' : 'bg-blue-500'}`}></div>
                                                <span className={`${isDirtyRow ? 'text-white' : 'text-blue-700'} font-bold text-sm z-10`}>{index + 1}</span>
                                            </div>
                                            <img src={student.picture || USER_PLACEHOLDER} alt={student.name} className="h-12 w-12 rounded-full object-cover bg-gray-200" />
                                            <div>
                                                <p className="font-bold">{student.name}</p>
                                                <p className={`text-sm ${isDirtyRow ? DIRTY_INDICATOR_SECONDARY_TEXT : 'text-gray-600'}`}>{student.indexNumber}</p>
                                                <p className={`text-sm ${isDirtyRow ? DIRTY_INDICATOR_SECONDARY_TEXT : 'text-gray-600'}`}>{student.class} &middot; {student.gender}</p>
                                            </div>
                                        </div>
                                        {canManage && (
                                            <div className="flex space-x-2 flex-shrink-0">
                                                <button onClick={() => handleEdit(student)} className={`${isDirtyRow ? `${DIRTY_INDICATOR_SECONDARY_TEXT} hover:text-white` : 'text-blue-600 hover:bg-blue-100'} p-2 rounded-full`} title="Edit">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>
                                                </button>
                                                <button onClick={() => handleDeleteClick(student.id)} className={`${isDirtyRow ? 'text-white hover:bg-black/20' : 'text-red-600 hover:bg-red-100'} p-2 rounded-full`} title="Delete">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center p-8 text-gray-500 bg-white rounded-xl shadow-md border border-gray-200">
                            No students found matching your search.
                        </div>
                    )}
                </div>
            </ReadOnlyWrapper>

            {isModalOpen && currentStudent && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-2 sm:p-4">
                    <div className="bg-white p-3 sm:p-5 rounded-xl shadow-2xl w-full max-w-lg relative animate-fade-in-scale overflow-y-auto max-h-[98vh] sm:max-h-[95vh]">

                        <div className="flex items-center justify-between mb-3 border-b pb-2">
                            <h2 className="text-lg sm:text-xl font-bold text-gray-800">{'id' in currentStudent ? 'Edit Student' : 'Add New Student'}</h2>
                        </div>

                        {/* Feedback label removed from top */}

                        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                            <div className="bg-gray-50 p-2 sm:p-3 rounded-lg border border-gray-100">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-tight mb-2">Student Photo</label>
                                <div className="flex items-center space-x-3 sm:space-x-4">
                                    <div className="relative group">
                                        <img src={currentStudent.picture || USER_PLACEHOLDER} alt="Preview" className="h-16 w-16 sm:h-20 sm:w-20 rounded-full object-cover bg-gray-200 border-2 border-white shadow-sm" />
                                        {isEnhancing && (
                                            <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center">
                                                <div className="h-4 w-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <div className="flex flex-wrap gap-2">
                                            <input
                                                type="file"
                                                id="student-photo-upload"
                                                accept="image/*"
                                                onChange={handleFileChange}
                                                className="hidden"
                                            />
                                            <label htmlFor="student-photo-upload" className="cursor-pointer text-[11px] bg-white border border-gray-300 px-3 py-1.5 rounded-full font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
                                                Upload
                                            </label>
                                            <CameraCapture onCapture={handleCameraCapture} />
                                            {currentStudent.picture && (
                                                <button type="button" onClick={handleClearImage} className="text-red-500 text-[11px] font-bold hover:underline px-1">
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                        {AI_FEATURES_ENABLED && currentStudent.picture && (
                                            <button type="button" onClick={handleEnhanceImage} disabled={isEnhancing} className="flex items-center text-[10px] bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-bold hover:bg-indigo-100 disabled:opacity-50 transition-colors border border-indigo-100">
                                                {isEnhancing ? 'Enhancing...' : '✨ Enhance with AI'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-2.5">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-tight mb-1">Student Name</label>
                                    <div className="flex items-center space-x-2">
                                        <div className="relative flex-1">
                                            <input ref={firstInputRef} type="text" name="name" value={currentStudent.name} onChange={handleChange} className={`${inputStyles} py-1.5 text-sm`} placeholder="Full Name" required />
                                            
                                            {/* Session List Dropdown */}
                                            {isSessionListOpen && sessionAddedIds.length > 0 && (
                                                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 p-2 max-h-40 overflow-y-auto animate-fade-in-down ring-1 ring-black/5">
                                                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 px-1 flex justify-between">
                                                        <span>Session History</span>
                                                        <span>({sessionAddedIds.length})</span>
                                                    </div>
                                                    <div className="space-y-1">
                                                        {sessionAddedIds.map(id => {
                                                            const s = students.find(item => item.id === id);
                                                            const isDirty = dataContext.isItemDirty('students', id);
                                                            return (
                                                                <div key={id} className="flex items-center justify-between px-2 py-1.5 bg-gray-50 rounded text-xs">
                                                                    <span className="truncate flex-1 text-gray-700 font-medium">{s?.name || 'Unknown'}</span>
                                                                    <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                                                        isDirty ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'
                                                                    }`}>
                                                                        {isDirty ? 'Pending' : 'Saved'}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Session Counter Badge (Inline with input) */}
                                        {sessionAddedIds.length > 0 && (
                                            <button 
                                                type="button"
                                                onClick={() => setIsSessionListOpen(!isSessionListOpen)}
                                                className="flex-shrink-0 flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-sm border border-blue-500 active:scale-95"
                                            >
                                                <span className="text-[11px] font-bold">{sessionAddedIds.length}</span>
                                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 transition-transform ${isSessionListOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>

                                    {/* Push-Down Feedback */}
                                    <div className={`overflow-hidden transition-all duration-300 ${saveFeedback ? 'max-h-12 mt-1 opacity-100' : 'max-h-0 opacity-0'}`}>
                                        <div className="text-green-600 font-bold text-[11px] py-1 pl-1 flex items-center bg-green-50 rounded">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                            {saveFeedback || ''}
                                        </div>
                                    </div>
                                </div>
                            </div>
                                <div className="grid grid-cols-2 gap-2.5">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-tight mb-1">Index Number</label>
                                        <input
                                            type="text"
                                            name="indexNumber"
                                            value={currentStudent.indexNumber}
                                            onChange={handleChange}
                                            className={`${inputStyles} py-1.5 text-sm ${settings.autoAssignIndexNumbers ? 'bg-gray-100 opacity-75' : ''}`}
                                            placeholder={settings.autoAssignIndexNumbers && !('id' in currentStudent) ? 'Auto' : 'Index'}
                                            disabled={settings.autoAssignIndexNumbers}
                                            required={!settings.autoAssignIndexNumbers}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-tight mb-1">Gender</label>
                                        <select name="gender" value={currentStudent.gender} onChange={handleChange} className={`${inputStyles} py-1.5 text-sm`}>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2.5">
                                    <div className="col-span-1">
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-tight mb-1">Class</label>
                                        <select name="class" value={currentStudent.class} onChange={handleChange} className={`${inputStyles} py-1.5 text-sm`} required>
                                            <option value="">Select</option>
                                            {availableClasses.map((cls) => (
                                                <option key={cls.id} value={cls.name}>{cls.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-span-1">
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-tight mb-1">Date of Birth</label>
                                        <input type="date" name="dateOfBirth" value={currentStudent.dateOfBirth} onChange={handleChange} className={`${inputStyles} py-1.5 text-sm`} />
                                    </div>
                                </div>

                                {modalError && <p className="text-red-500 text-[10px] mt-0.5 font-bold animate-pulse">{modalError}</p>}
                            <div className="flex justify-end space-x-2 pt-2 border-t mt-2">
                                <button type="button" onClick={handleCloseModal} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors">Close</button>
                                <button type="submit" className="px-5 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-sm transition-all active:scale-95">Commit</button>
                            </div>

                        </form>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={isConfirmOpen}
                message="Are you sure you want to delete this student? Its records will be hidden."
                onConfirm={handleConfirmDelete}
                onClose={() => {
                    setIsConfirmOpen(false);
                    setItemIdToDelete(null);
                }}
                title="Delete Student"
            />

            <RestoreModal
                isOpen={isRestoreModalOpen}
                onClose={() => setIsRestoreModalOpen(false)}
                title="Restore Deleted Students"
                items={deletedStudents}
                onRestore={(id) => restoreItem('students', id)}
                onDeletePermanently={handlePermanentDeleteClick}
                itemNameKey="name"
            />

            <ConfirmationModal
                isOpen={isPermanentConfirmOpen}
                message={
                    <>
                        Are you sure you want to <span className="font-bold text-red-600 underline">permanently delete</span> this student? 
                        <br /><br />
                        This action <span className="font-bold">cannot be undone</span> and all related records will be completely removed from the system.
                    </>
                }
                onConfirm={handleConfirmPermanentDelete}
                onClose={() => {
                    setIsPermanentConfirmOpen(false);
                    setIdToPermanentlyDelete(null);
                }}
                title="Permanent Deletion"
                variant="danger"
                confirmText="Yes, Delete Permanently"
            />
        </div>
    );
};

export default Students;