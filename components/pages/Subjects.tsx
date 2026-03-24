import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import type { Subject } from '../../types';
import ConfirmationModal from '../ConfirmationModal';
import ReadOnlyWrapper from '../ReadOnlyWrapper';
import { useUser } from '../../context/UserContext';
import { useUserAction } from '../../context/UserActionContext';
import RestoreModal from '../modals/RestoreModal';
import { DIRTY_INDICATOR_BG, DIRTY_INDICATOR_TEXT, DIRTY_INDICATOR_SECONDARY_TEXT, DIRTY_INDICATOR_HOVER_BG, DIRTY_INDICATOR_BORDER } from '../../constants';

const EMPTY_SUBJECT_FORM: Omit<Subject, 'id'> = {
    subject: '',
    type: 'Core',
    facilitator: '',
    signature: '',
};

const Subjects: React.FC = () => {
    const { recordAction } = useUserAction();
    const { subjects, deletedSubjects, restoreItem, permanentlyDeleteItem, addSubject, updateSubject, deleteSubject, saveSubjects, isDirty, isItemDirty, isSyncing, isOnline, loadMetadata } = useData();
    const { currentUser } = useUser();

    // TRIGGER RECONCILIATION: Identify unsaved local items on mount
    React.useEffect(() => {
        loadMetadata();
    }, [loadMetadata]);
    const isAdmin = currentUser?.role === 'Admin';
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
    const [currentSubject, setCurrentSubject] = useState<Subject | Omit<Subject, 'id'> | null>(null);
    const firstInputRef = React.useRef<HTMLInputElement>(null);
    const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isPermanentConfirmOpen, setIsPermanentConfirmOpen] = useState(false);
    const [itemIdToDelete, setItemIdToDelete] = useState<number | null>(null);
    const [idToPermanentlyDelete, setIdToPermanentlyDelete] = useState<number | null>(null);
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

    const visibleDeletedSubjects = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.role === 'Admin') return deletedSubjects;
        return deletedSubjects.filter(s => s.deletedBy === currentUser.id);
    }, [deletedSubjects, currentUser]);

    const handleAddNew = () => {
        setCurrentSubject(EMPTY_SUBJECT_FORM);
        setIsModalOpen(true);
        recordAction('Opened modal to add new subject');
    };

    const handleEdit = (subject: Subject) => {
        setCurrentSubject(subject);
        setIsModalOpen(true);
        recordAction(`Opened modal to edit subject: ${subject.subject}`);
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

    const handlePermanentDeleteClick = (id: number) => {
        setIdToPermanentlyDelete(id);
        setIsPermanentConfirmOpen(true);
    };

    const handleConfirmPermanentDelete = () => {
        if (idToPermanentlyDelete !== null) {
            permanentlyDeleteItem('subjects', idToPermanentlyDelete);
        }
        setIsPermanentConfirmOpen(false);
        setIdToPermanentlyDelete(null);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentSubject(null);
        setSaveFeedback(null);
    };

    // Auto-focus logic
    React.useEffect(() => {
        if (isModalOpen && firstInputRef.current) {
            setTimeout(() => {
                firstInputRef.current?.focus();
                firstInputRef.current?.select();
            }, 100);
        }
    }, [isModalOpen, currentSubject]);


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setCurrentSubject(prev => prev ? { ...prev, [name]: value } : null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        recordAction(`Clicked Commit on ${currentSubject && 'id' in currentSubject ? 'Edit' : 'Add'} Subject modal`);
        if (!currentSubject) return;

        if ('id' in currentSubject) {
            updateSubject(currentSubject);
        } else {
            addSubject(currentSubject);
            // STAY OPEN ON ADD for continuous entry
            setSaveFeedback(`Subject "${currentSubject.subject}" Added!`);
            setCurrentSubject(EMPTY_SUBJECT_FORM);
            setTimeout(() => setSaveFeedback(null), 3000);
            return;
        }
        handleCloseModal();
    };


    return (
        <div className="space-y-6 pb-24 lg:pb-0">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-800">Manage Subjects</h1>
                {/* Save Button Removed - Using Global Action Bar */}
            </div>

            <div className="bg-gray-100 py-4">
                <div className="flex flex-col md:flex-row justify-start items-center gap-4">
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

                    <ReadOnlyWrapper allowedRoles={['Admin']}>
                        {isAdmin && (
                            <div className="flex items-center gap-3">
                                <button onClick={handleAddNew} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition-colors w-full md:w-auto justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                    </svg>
                                    Add New Subject
                                </button>
                                {visibleDeletedSubjects.length > 0 && (
                                    <button
                                        onClick={() => setIsRestoreModalOpen(true)}
                                        className="flex items-center space-x-2 px-3 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition shadow-sm font-semibold border border-red-200"
                                        title="Restore Deleted Subjects"
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
            <ReadOnlyWrapper allowedRoles={['Admin']}>
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
                                    filteredSubjects.map((subject, index) => {
                                        const isDirtyRow = isItemDirty('subjects', subject.id);
                                        return (
                                            <tr key={subject.id} className={`border-b transition-colors ${isDirtyRow ? `${DIRTY_INDICATOR_BG} ${DIRTY_INDICATOR_TEXT} ${DIRTY_INDICATOR_HOVER_BG}` : 'hover:bg-gray-50'}`}>
                                                <td className="p-4 relative">
                                                    {index + 1}
                                                    {isDirtyRow && (
                                                        <span className="absolute left-0 top-0 text-[10px] font-bold uppercase tracking-wider px-1 py-0.5 bg-yellow-400 text-black leading-none rounded-br z-10">
                                                            Unsaved
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-4 font-medium">{subject.subject}</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${subject.type === 'Core' ? (isDirtyRow ? 'bg-green-900/50 text-green-100 border border-green-700' : 'bg-green-100 text-green-800') : (isDirtyRow ? 'bg-amber-900/50 text-amber-100 border border-amber-700' : 'bg-yellow-100 text-yellow-800')}`}>
                                                        {subject.type}
                                                    </span>
                                                </td>
                                                <td className="p-4 space-x-4 flex items-center">
                                                    {isAdmin && (
                                                        <>
                                                            <button onClick={() => handleEdit(subject)} className={`${isDirtyRow ? `${DIRTY_INDICATOR_SECONDARY_TEXT} hover:text-white` : 'text-blue-600 hover:text-blue-800'}`} title="Edit">
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" />
                                                                </svg>
                                                            </button>
                                                            <button onClick={() => handleDeleteClick(subject.id)} className={`${isDirtyRow ? 'text-white hover:text-gray-200 opacity-90' : 'text-red-600 hover:text-red-800'}`} title="Delete">
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
                        filteredSubjects.map((subject, index) => {
                            const isDirtyRow = isItemDirty('subjects', subject.id);
                            return (
                                <div key={subject.id} className={`p-4 rounded-xl shadow-md border transition-colors flex justify-between items-center relative ${isDirtyRow ? `${DIRTY_INDICATOR_BG} ${DIRTY_INDICATOR_BORDER} ${DIRTY_INDICATOR_TEXT}` : 'bg-white border-gray-200'}`}>
                                    {isDirtyRow && (
                                        <div className="absolute top-0 right-0 bg-yellow-400 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-bl uppercase z-10">
                                            Unsaved
                                        </div>
                                    )}
                                    <div className="flex items-center gap-3">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center relative">
                                            <div className={`absolute inset-0 rounded-full opacity-20 ${isDirtyRow ? 'bg-white' : 'bg-blue-500'}`}></div>
                                            <span className={`${isDirtyRow ? 'text-white' : 'text-blue-700'} font-bold text-sm z-10`}>{index + 1}</span>
                                        </div>
                                        <div>
                                            <p className={`font-bold ${isDirtyRow ? 'text-white' : 'text-gray-800'}`}>{subject.subject}</p>
                                            <span className={`mt-1 inline-block px-2 py-1 text-xs font-semibold rounded-full ${subject.type === 'Core' ? (isDirtyRow ? 'bg-green-900/50 text-green-100 border border-green-700' : 'bg-green-100 text-green-800') : (isDirtyRow ? 'bg-amber-900/50 text-amber-100 border border-amber-700' : 'bg-yellow-100 text-yellow-800')}`}>
                                                {subject.type}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex space-x-2 flex-shrink-0">
                                        {isAdmin && (
                                            <>
                                                <button onClick={() => handleEdit(subject)} className={`${isDirtyRow ? `${DIRTY_INDICATOR_SECONDARY_TEXT} hover:text-white` : 'text-blue-600 hover:bg-blue-100'} p-2 rounded-full`} title="Edit">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>
                                                </button>
                                                <button onClick={() => handleDeleteClick(subject.id)} className={`${isDirtyRow ? 'text-white hover:bg-black/20' : 'text-red-600 hover:bg-red-100'} p-2 rounded-full`} title="Delete">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center p-8 text-gray-500 bg-white rounded-xl shadow-md border border-gray-200">
                            No subjects found matching your search.
                        </div>
                    )}
                </div>
            </ReadOnlyWrapper>


            {isModalOpen && currentSubject && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                    <div className="bg-white p-5 rounded-xl shadow-2xl w-full max-w-lg relative animate-fade-in-scale">
                        {/* Vanishing Feedback Header */}
                        {saveFeedback && (
                            <div className="absolute top-0 left-0 right-0 bg-green-500 text-white py-2 px-4 text-center font-bold animate-fade-in-down z-10 rounded-t-xl text-sm">
                                {saveFeedback}
                            </div>
                        )}
                        <h2 className="text-xl font-bold mb-4 text-gray-800">{'id' in currentSubject ? 'Edit Subject' : 'Add New Subject'}</h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Subject Name</label>
                                    <input ref={firstInputRef} type="text" name="subject" value={currentSubject.subject} onChange={handleChange} required className={inputStyles} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Type</label>
                                    <select name="type" value={currentSubject.type} onChange={handleChange} className={inputStyles}>
                                        <option>Core</option>
                                        <option>Elective</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end pt-2 space-x-2">
                                <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">Close</button>
                                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold shadow-sm transition-all active:scale-95">Commit</button>
                            </div>
                        </form>

                    </div>
                </div>
            )}
            <ConfirmationModal
                isOpen={isConfirmOpen}
                message="Are you sure you want to delete this subject? Its records will be hidden."
                onConfirm={handleConfirmDelete}
                onClose={() => {
                    setIsConfirmOpen(false);
                    setItemIdToDelete(null);
                }}
                title="Delete Subject"
            />

            <RestoreModal
                isOpen={isRestoreModalOpen}
                onClose={() => setIsRestoreModalOpen(false)}
                title="Restore Deleted Subjects"
                items={deletedSubjects}
                onRestore={(id) => restoreItem('subjects', id)}
                onDeletePermanently={handlePermanentDeleteClick}
                itemNameKey="subject"
            />

            <ConfirmationModal
                isOpen={isPermanentConfirmOpen}
                message={
                    <>
                        Are you sure you want to <span className="font-bold text-red-600 underline">permanently delete</span> this subject? 
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

export default Subjects;