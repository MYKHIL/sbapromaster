import React, { useState, useMemo } from 'react';
import CameraCapture from '../CameraCapture';
import { useData } from '../../context/DataContext';
import type { Student } from '../../types';
import ConfirmationModal from '../ConfirmationModal';
import { enhanceImage } from '../../services/geminiService';
import { AI_FEATURES_ENABLED } from '../../constants';

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
    const { students, classes, addStudent, updateStudent, deleteStudent } = useData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentStudent, setCurrentStudent] = useState<Student | Omit<Student, 'id'> | null>(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [itemIdToDelete, setItemIdToDelete] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isEnhancing, setIsEnhancing] = useState(false);

    const inputStyles = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500";
    const searchInputStyles = "w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

    const filteredStudents = useMemo(() => {
        const query = searchQuery.toLowerCase();
        if (!query) return students;
        return students.filter(student =>
            student.name.toLowerCase().includes(query) ||
            student.indexNumber.toLowerCase().includes(query) ||
            student.class.toLowerCase().includes(query)
        );
    }, [students, searchQuery]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setCurrentStudent(prev => prev ? { ...prev, picture: event.target?.result as string } : null);
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const handleCameraCapture = (imageData: string) => {
        setCurrentStudent(prev => prev ? { ...prev, picture: imageData } : null);
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
        setCurrentStudent(student);
        setIsModalOpen(true);
    };

    const handleDeleteClick = (id: number) => {
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

        if (!currentStudent.name.trim() || !currentStudent.indexNumber.trim() || !currentStudent.class) {
            alert("Please ensure Name, Index Number, and Class are filled out.");
            return;
        }

        if ('id' in currentStudent) {
            updateStudent(currentStudent);
        } else {
            addStudent(currentStudent);
        }
        handleCloseModal();
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Manage Students</h1>

            <div className="bg-gray-100 py-4">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
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
                    <button onClick={handleAddNew} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition-colors w-full md:w-auto justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Add New Student
                    </button>
                </div>
            </div>


            {/* Desktop Table View */}
            <div className="hidden lg:block bg-white p-6 rounded-xl shadow-md border border-gray-200">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 border-b">
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
                                filteredStudents.map((student) => (
                                    <tr key={student.id} className="border-b hover:bg-gray-50">
                                        <td className="p-2">
                                            <img src={student.picture || USER_PLACEHOLDER} alt={student.name} className="h-10 w-10 rounded-full object-cover bg-gray-200" />
                                        </td>
                                        <td className="p-4 text-gray-900">{student.indexNumber}</td>
                                        <td className="p-4 font-medium text-gray-900">{student.name}</td>
                                        <td className="p-4 text-gray-900">{student.class}</td>
                                        <td className="p-4 text-gray-900">{student.gender}</td>
                                        <td className="p-4 space-x-4 flex items-center">
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
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="text-center p-8 text-gray-500">
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
                    filteredStudents.map(student => (
                        <div key={student.id} className="bg-white p-4 rounded-xl shadow-md border border-gray-200">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center space-x-4">
                                    <img src={student.picture || USER_PLACEHOLDER} alt={student.name} className="h-12 w-12 rounded-full object-cover bg-gray-200" />
                                    <div>
                                        <p className="font-bold text-gray-800">{student.name}</p>
                                        <p className="text-sm text-gray-600">{student.indexNumber}</p>
                                        <p className="text-sm text-gray-600">{student.class} &middot; {student.gender}</p>
                                    </div>
                                </div>
                                <div className="flex space-x-2 flex-shrink-0">
                                    <button onClick={() => handleEdit(student)} className="text-blue-600 p-2 rounded-full hover:bg-blue-100" title="Edit">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>
                                    </button>
                                    <button onClick={() => handleDeleteClick(student.id)} className="text-red-600 p-2 rounded-full hover:bg-red-100" title="Delete">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center p-8 text-gray-500 bg-white rounded-xl shadow-md border border-gray-200">
                        No students found matching your search.
                    </div>
                )}
            </div>

            {isModalOpen && currentStudent && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                    <div className="bg-white p-6 md:p-8 rounded-xl shadow-2xl w-full max-w-lg m-4 overflow-y-auto max-h-[90vh]">
                        <h2 className="text-2xl font-bold mb-6 text-gray-800">{'id' in currentStudent ? 'Edit Student' : 'Add New Student'}</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Student Photo</label>
                                <div className="mt-1 flex items-center space-x-4">
                                    <img src={currentStudent.picture || USER_PLACEHOLDER} alt="Preview" className="h-20 w-20 rounded-full object-cover bg-gray-200" />
                                    <div className="space-y-2 w-full">
                                        <input type="file" accept="image/*" onChange={handleFileChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                                        <CameraCapture onCapture={handleCameraCapture} label="Take Photo" />
                                    </div>
                                </div>
                                {AI_FEATURES_ENABLED && (
                                    <div className="mt-2">
                                        <button
                                            type="button"
                                            onClick={handleEnhanceImage}
                                            disabled={!currentStudent.picture || isEnhancing}
                                            className="flex items-center text-sm bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full font-semibold hover:bg-indigo-200 disabled:bg-gray-200 disabled:text-gray-500 transition-colors"
                                        >
                                            {isEnhancing ? (
                                                <>
                                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Enhancing...
                                                </>
                                            ) : '✨ Enhance Image'}
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Name</label>
                                <input type="text" name="name" value={currentStudent.name} onChange={handleChange} required className={inputStyles} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Index Number</label>
                                <input type="text" name="indexNumber" value={currentStudent.indexNumber} onChange={handleChange} required className={inputStyles} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Class</label>
                                <select name="class" value={currentStudent.class} onChange={handleChange} required className={inputStyles}>
                                    <option value="" disabled>-- Select a class --</option>
                                    {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Gender</label>
                                <select name="gender" value={currentStudent.gender} onChange={handleChange} required className={inputStyles}>
                                    <option>Male</option>
                                    <option>Female</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                                <input type="date" name="dateOfBirth" value={currentStudent.dateOfBirth} onChange={handleChange} className={inputStyles} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Age</label>
                                <input type="text" name="age" value={currentStudent.age} readOnly placeholder="Calculated from D.O.B." className={inputStyles + " bg-gray-100 cursor-not-allowed"} />
                            </div>
                            <div className="flex justify-end pt-4 space-x-2">
                                <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
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