import React, { useState, useMemo, useEffect, useRef } from 'react';
import CameraCapture from '../CameraCapture';
import { useData } from '../../context/DataContext';
import type { Student } from '../../types';
import ConfirmationModal from '../ConfirmationModal';
import { enhanceImage } from '../../services/geminiService';
import { AI_FEATURES_ENABLED } from '../../constants';
import { useUser } from '../../context/UserContext';
import ReadOnlyWrapper from '../ReadOnlyWrapper';
import { getAvailableClasses, canManageStudentsInClass } from '../../utils/permissions';
import { compressImage } from '../../utils/imageUtils';
import { generateIndexNumber } from '../../utils/indexNumberGenerator';
import { getNextAvailableCounter } from '../../utils/indexNumberCounter';
import { sortClassesByName } from '../../utils/classSort';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';

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


const Students: React.FC = () => {
    const { students, classes, addStudent, updateStudent, deleteStudent, saveStudents, isDirty, isSyncing, isOnline, settings, updateSettings, loadStudents } = useData();
    const { currentUser, isAuthenticated } = useUser();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentStudent, setCurrentStudent] = useState<Student | Omit<Student, 'id'> | null>(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [itemIdToDelete, setItemIdToDelete] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [isEnhancing, setIsEnhancing] = useState(false);
    const hasSetDefaultClass = useRef(false);

    const inputStyles = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500";
    const searchInputStyles = "w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

    // Filter students based on user permissions
    const accessibleStudents = useMemo(() => {
        if (!isAuthenticated || !currentUser) return students;
        if (currentUser.role === 'Admin' || currentUser.role === 'Teacher') return students;
        // Guest restricted to allowed classes
        return students.filter(s => currentUser.allowedClasses.includes(s.class));
    }, [students, currentUser, isAuthenticated]);

    // Derived list of classes available for "Add Student" or filtering
    const availableClasses = useMemo(() => {
        const available = getAvailableClasses(currentUser, classes);
        // De-duplicate by class name to prevent redundant entries in the dropdown
        const unique = available.filter((cls, index, self) =>
            index === self.findIndex((t) => t.name.trim() === cls.name.trim())
        );
        return sortClassesByName(unique);
    }, [currentUser, classes]);

    // Initialize default class selection to first available class (only once on mount)
    useEffect(() => {
        if (availableClasses.length > 0 && !hasSetDefaultClass.current) {
            setSelectedClass(availableClasses[0].name);
            hasSetDefaultClass.current = true;
        }
    }, [availableClasses]);

    // Lazy Load Students on Mount
    useEffect(() => {
        loadStudents();
    }, [loadStudents]);

    const filteredStudents = useMemo(() => {
        const query = searchQuery.toLowerCase();
        let results = accessibleStudents;

        // Filter by selected class
        if (selectedClass) {
            results = results.filter(student => student.class === selectedClass);
        }

        // Filter by search query
        if (query) {
            results = results.filter(student =>
                student.name.toLowerCase().includes(query) ||
                student.indexNumber.toLowerCase().includes(query) ||
                student.class.toLowerCase().includes(query)
            );
        }

        return results;
    }, [accessibleStudents, selectedClass, searchQuery]);



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
            const reader = new FileReader();
            reader.onload = async (event) => {
                const raw = event.target?.result as string;
                try {
                    const compressed = await compressImage(raw);
                    setCurrentStudent(prev => prev ? { ...prev, picture: compressed } : null);
                } catch {
                    setCurrentStudent(prev => prev ? { ...prev, picture: raw } : null);
                }
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const handleCameraCapture = async (imageData: string) => {
        try {
            const compressed = await compressImage(imageData);
            setCurrentStudent(prev => prev ? { ...prev, picture: compressed } : null);
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
        setCurrentStudent(EMPTY_STUDENT_FORM);
        setIsModalOpen(true);
    };

    const handleEdit = (student: Student) => {
        if (!canManageStudentsInClass(currentUser, student.class)) {
            alert("You do not have permission to edit students in this class.");
            return;
        }
        setCurrentStudent(student);
        setIsModalOpen(true);
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

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentStudent(null);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
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
        if (!currentStudent) return;

        // Check auto-assignment mode
        const isAutoAssignMode = settings.autoAssignIndexNumbers;

        if (isAutoAssignMode) {
            // In auto-assign mode, only name and class are required
            if (!currentStudent.name.trim() || !currentStudent.class) {
                alert("Please ensure Name and Class are filled out.");
                return;
            }
        } else {
            // In manual mode, index number is also required
            if (!currentStudent.name.trim() || !currentStudent.indexNumber.trim() || !currentStudent.class) {
                alert("Please ensure Name, Index Number, and Class are filled out.");
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
                    // Update class counter
                    const updatedClasses = classes.map(c =>
                        c.id === classObj.id
                            ? { ...c, indexNumberCounter: (c.indexNumberCounter || 1) + 1 }
                            : c
                    );
                    // You'll need to update classes via DataContext
                    // For now, update settings with global counter
                    updateSettings({ indexNumberGlobalCounter: nextCounter + 1 });
                } else {
                    // Update global counter
                    updateSettings({ indexNumberGlobalCounter: nextCounter + 1 });
                }
            }

            addStudent(studentToAdd);
        }
        handleCloseModal();
    };

    return (
        <div className="space-y-6">
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
                        <option value="">All Classes</option>
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
                                <button onClick={handleAddNew} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm">
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
                                        return (
                                            <tr key={student.id} className="border-b hover:bg-gray-50">
                                                <td className="p-4 text-gray-600 font-semibold">{index + 1}</td>
                                                <td className="p-2">
                                                    <img src={student.picture || USER_PLACEHOLDER} alt={student.name} className="h-10 w-10 rounded-full object-cover bg-gray-200" />
                                                </td>
                                                <td className="p-4 text-gray-900">{student.indexNumber}</td>
                                                <td className="p-4 font-medium text-gray-900">{student.name}</td>
                                                <td className="p-4 text-gray-900">{student.class}</td>
                                                <td className="p-4 text-gray-900">{student.gender}</td>
                                                <td className="p-4 space-x-4 flex items-center">
                                                    {canManage && (
                                                        <>
                                                            <button onClick={() => handleEdit(student)} className="text-blue-600 hover:text-blue-800" title="Edit">
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" />
                                                                </svg>
                                                            </button>
                                                            <button onClick={() => handleDeleteClick(student.id)} className="text-red-600 hover:text-red-800" title="Delete">
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
                            return (
                                <div key={student.id} className="bg-white p-4 rounded-xl shadow-md border border-gray-200">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center space-x-4">
                                            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                                <span className="text-blue-700 font-bold text-sm">{index + 1}</span>
                                            </div>
                                            <img src={student.picture || USER_PLACEHOLDER} alt={student.name} className="h-12 w-12 rounded-full object-cover bg-gray-200" />
                                            <div>
                                                <p className="font-bold text-gray-800">{student.name}</p>
                                                <p className="text-sm text-gray-600">{student.indexNumber}</p>
                                                <p className="text-sm text-gray-600">{student.class} &middot; {student.gender}</p>
                                            </div>
                                        </div>
                                        {canManage && (
                                            <div className="flex space-x-2 flex-shrink-0">
                                                <button onClick={() => handleEdit(student)} className="text-blue-600 p-2 rounded-full hover:bg-blue-100" title="Edit">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>
                                                </button>
                                                <button onClick={() => handleDeleteClick(student.id)} className="text-red-600 p-2 rounded-full hover:bg-red-100" title="Delete">
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
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                    <div className="bg-white p-6 md:p-8 rounded-xl shadow-2xl w-full max-w-lg m-4 overflow-y-auto max-h-[90vh]">
                        <h2 className="text-2xl font-bold mb-6 text-gray-800">{'id' in currentStudent ? 'Edit Student' : 'Add New Student'}</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Student Photo</label>
                                <div className="mt-1 flex items-center space-x-4">
                                    <img src={currentStudent.picture || USER_PLACEHOLDER} alt="Preview" className="h-20 w-20 rounded-full object-cover bg-gray-200" />
                                    <div className="space-y-2">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileChange}
                                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                        />
                                        <CameraCapture onCapture={handleCameraCapture} />
                                        {currentStudent.picture && (
                                            <button type="button" onClick={handleClearImage} className="text-red-500 text-sm hover:underline">
                                                Remove Photo
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {AI_FEATURES_ENABLED && (
                                    <div className="mt-2">
                                        <button type="button" onClick={handleEnhanceImage} disabled={!currentStudent.picture || isEnhancing} className="flex items-center text-sm bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full font-semibold hover:bg-indigo-200 disabled:bg-gray-200 disabled:text-gray-500 transition-colors">
                                            {isEnhancing ? 'Enhancing...' : '✨ Enhance Photo with AI'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Name</label>
                                <input type="text" name="name" value={currentStudent.name} onChange={handleChange} className={inputStyles} placeholder="Full Name" required />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Index Number
                                    {settings.autoAssignIndexNumbers && (
                                        <span className="ml-2 text-xs text-blue-600">
                                            {('id' in currentStudent) ? '(Locked)' : '(Auto-generated)'}
                                        </span>
                                    )}
                                </label>
                                <input
                                    type="text"
                                    name="indexNumber"
                                    value={currentStudent.indexNumber}
                                    onChange={handleChange}
                                    className={`${inputStyles} ${settings.autoAssignIndexNumbers ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                    placeholder={settings.autoAssignIndexNumbers && !('id' in currentStudent) ? 'Will be auto-generated' : 'Index Number'}
                                    disabled={settings.autoAssignIndexNumbers}
                                    required={!settings.autoAssignIndexNumbers}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Class</label>
                                <select name="class" value={currentStudent.class} onChange={handleChange} className={inputStyles} required>
                                    <option value="">Select Class</option>
                                    {availableClasses.map((cls) => (
                                        <option key={cls.id} value={cls.name}>{cls.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Gender</label>
                                <select name="gender" value={currentStudent.gender} onChange={handleChange} className={inputStyles}>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                                    <input type="date" name="dateOfBirth" value={currentStudent.dateOfBirth} onChange={handleChange} className={inputStyles} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Age</label>
                                    <input type="text" name="age" value={currentStudent.age} readOnly className={`${inputStyles} bg-gray-50`} placeholder="Auto-calc" />
                                </div>
                            </div>

                            <div className="flex justify-end space-x-3 pt-4">
                                <button type="button" onClick={handleCloseModal} className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-md transform active:scale-95 transition-transform">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Delete Student"
                message="Are you sure you want to delete this student? This action cannot be undone."
            />
        </div>
    );
};

export default Students;