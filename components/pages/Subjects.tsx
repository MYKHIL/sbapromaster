import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import type { Subject } from '../../types';
import ConfirmationModal from '../ConfirmationModal';
import ReadOnlyWrapper from '../ReadOnlyWrapper';
import { useUser } from '../../context/UserContext';

const EMPTY_SUBJECT_FORM: Omit<Subject, 'id'> = {
    subject: '',
    type: 'Core',
    facilitator: '',
    signature: '',
};

const Subjects: React.FC = () => {
    const { subjects, addSubject, updateSubject, deleteSubject } = useData();
    const { currentUser } = useUser();
    const isAdmin = currentUser?.role === 'Admin';
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentSubject, setCurrentSubject] = useState<Subject | Omit<Subject, 'id'> | null>(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [itemIdToDelete, setItemIdToDelete] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const inputStyles = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500";
    const searchInputStyles = "w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

    const filteredSubjects = useMemo(() => {
        const query = searchQuery.toLowerCase();
        if (!query) return subjects;
        return subjects.filter(subject =>
            subject.subject.toLowerCase().includes(query) ||
            subject.type.toLowerCase().includes(query)
        );
    }, [subjects, searchQuery]);

    const handleAddNew = () => {
        setCurrentSubject(EMPTY_SUBJECT_FORM);
        setIsModalOpen(true);
    };

    const handleEdit = (subject: Subject) => {
        setCurrentSubject(subject);
        setIsModalOpen(true);
    };

    const handleDeleteClick = (id: number) => {
        setItemIdToDelete(id);
        setIsConfirmOpen(true);
    };

    const handleConfirmDelete = () => {
        if (itemIdToDelete !== null) {
            deleteSubject(itemIdToDelete);
        }
        setIsConfirmOpen(false);
        setItemIdToDelete(null);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentSubject(null);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setCurrentSubject(prev => prev ? { ...prev, [name]: value } : null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentSubject) return;

        if ('id' in currentSubject) {
            updateSubject(currentSubject);
        } else {
            addSubject(currentSubject);
        }
        handleCloseModal();
    };

    return (
        <ReadOnlyWrapper allowedRoles={['Admin']}>
            <div className="space-y-6">
                <h1 className="text-3xl font-bold text-gray-800">Manage Subjects</h1>

                <div className="bg-gray-100 py-4">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="relative w-full md:w-1/3">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                            <input
                                type="text"
                                placeholder="Search by subject or type..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={searchInputStyles}
                            />
                        </div>

                        {isAdmin && (
                            <button onClick={handleAddNew} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition-colors w-full md:w-auto justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                                Add New Subject
                            </button>
                        )}
                    </div>
                </div>

                {/* Desktop Table View */}
                <div className="hidden lg:block bg-white p-6 rounded-xl shadow-md border border-gray-200">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50 border-b">
                                    <th className="p-4 font-semibold text-gray-600">#</th>
                                    <th className="p-4 font-semibold text-gray-600">Subject Name</th>
                                    <th className="p-4 font-semibold text-gray-600">Type</th>
                                    <th className="p-4 font-semibold text-gray-600">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSubjects.length > 0 ? (
                                    filteredSubjects.map((subject, index) => (
                                        <tr key={subject.id} className="border-b hover:bg-gray-50">
                                            <td className="p-4 text-gray-600 font-semibold">{index + 1}</td>
                                            <td className="p-4 font-medium text-gray-900">{subject.subject}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${subject.type === 'Core' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                    {subject.type}
                                                </span>
                                            </td>
                                            <td className="p-4 space-x-4 flex items-center">
                                                {isAdmin && (
                                                    <>
                                                        <button onClick={() => handleEdit(subject)} className="text-blue-600 hover:text-blue-800" title="Edit">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" />
                                                            </svg>
                                                        </button>
                                                        <button onClick={() => handleDeleteClick(subject.id)} className="text-red-600 hover:text-red-800" title="Delete">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="text-center p-8 text-gray-500">
                                            No subjects found matching your search.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden space-y-4">
                    {filteredSubjects.length > 0 ? (
                        filteredSubjects.map((subject, index) => (
                            <div key={subject.id} className="bg-white p-4 rounded-xl shadow-md border border-gray-200 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                        <span className="text-blue-700 font-bold text-sm">{index + 1}</span>
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800">{subject.subject}</p>
                                        <span className={`mt-1 inline-block px-2 py-1 text-xs font-semibold rounded-full ${subject.type === 'Core' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                            {subject.type}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex space-x-2 flex-shrink-0">
                                    {isAdmin && (
                                        <>
                                            <button onClick={() => handleEdit(subject)} className="text-blue-600 p-2 rounded-full hover:bg-blue-100" title="Edit">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>
                                            </button>
                                            <button onClick={() => handleDeleteClick(subject.id)} className="text-red-600 p-2 rounded-full hover:bg-red-100" title="Delete">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center p-8 text-gray-500 bg-white rounded-xl shadow-md border border-gray-200">
                            No subjects found matching your search.
                        </div>
                    )}
                </div>


                {isModalOpen && currentSubject && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                        <div className="bg-white p-6 md:p-8 rounded-xl shadow-2xl w-full max-w-lg m-4">
                            <h2 className="text-2xl font-bold mb-6 text-gray-800">{'id' in currentSubject ? 'Edit Subject' : 'Add New Subject'}</h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Subject Name</label>
                                    <input type="text" name="subject" value={currentSubject.subject} onChange={handleChange} required className={inputStyles} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Type</label>
                                    <select name="type" value={currentSubject.type} onChange={handleChange} className={inputStyles}>
                                        <option>Core</option>
                                        <option>Elective</option>
                                    </select>
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
                    title="Delete Subject"
                    message="Are you sure you want to delete this subject? This action cannot be undone."
                />
            </div>
        </ReadOnlyWrapper >
    );
};

export default Subjects;