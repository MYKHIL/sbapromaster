import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import type { Assessment } from '../../types';
import ReadOnlyWrapper from '../ReadOnlyWrapper';
import ConfirmationModal from '../ConfirmationModal';
import { useUser } from '../../context/UserContext';

const EMPTY_ASSESSMENT_FORM: Omit<Assessment, 'id'> = {
    name: '',
    weight: 10,
};

const DragHandleIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 16 16">
        <path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
    </svg>
);


const AssessmentTypes: React.FC = () => {
    const { assessments, setAssessments, addAssessment, updateAssessment, deleteAssessment, saveAssessments, isDirty, isSyncing, isOnline } = useData();
    const { currentUser } = useUser();
    const isAdmin = currentUser?.role === 'Admin';
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentAssessment, setCurrentAssessment] = useState<Assessment | Omit<Assessment, 'id'> | null>(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [itemIdToDelete, setItemIdToDelete] = useState<number | null>(null);
    const [modalError, setModalError] = useState('');

    const [draggedItem, setDraggedItem] = useState<Assessment | null>(null);
    const [dragOverItem, setDragOverItem] = useState<Assessment | null>(null);

    const inputStyles = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500";

    const isExam = (assessment: Assessment | Omit<Assessment, 'id'>) => assessment.name.toLowerCase().includes('exam');

    const examAssessment = useMemo(() => assessments.find(a => isExam(a)), [assessments]);
    const reorderableAssessments = useMemo(() => assessments.filter(a => !isExam(a)), [assessments]);

    const totalWeight = useMemo(() => {
        return assessments.reduce((acc, curr) => acc + curr.weight, 0);
    }, [assessments]);

    const handleDragStart = (item: Assessment) => {
        setDraggedItem(item);
    };

    const handleDragEnter = (item: Assessment) => {
        if (draggedItem && draggedItem.id !== item.id) {
            setDragOverItem(item);
        }
    };

    const handleDragEnd = () => {
        setDraggedItem(null);
        setDragOverItem(null);
    };

    const handleDrop = () => {
        if (!draggedItem || !dragOverItem || draggedItem.id === dragOverItem.id) {
            handleDragEnd();
            return;
        }

        const currentIndex = reorderableAssessments.findIndex(item => item.id === draggedItem.id);
        const targetIndex = reorderableAssessments.findIndex(item => item.id === dragOverItem.id);

        let newReorderableList = [...reorderableAssessments];
        const [removed] = newReorderableList.splice(currentIndex, 1);
        newReorderableList.splice(targetIndex, 0, removed);

        const finalAssessments = examAssessment ? [...newReorderableList, examAssessment] : newReorderableList;
        setAssessments(finalAssessments);

        handleDragEnd();
    };


    const handleAddNew = () => {
        setCurrentAssessment(EMPTY_ASSESSMENT_FORM);
        setIsModalOpen(true);
    };

    const handleEdit = (assessment: Assessment) => {
        setCurrentAssessment(assessment);
        setIsModalOpen(true);
    };

    const handleDeleteClick = (id: number) => {
        setItemIdToDelete(id);
        setIsConfirmOpen(true);
    };

    const handleConfirmDelete = () => {
        if (itemIdToDelete !== null) {
            deleteAssessment(itemIdToDelete);
        }
        setIsConfirmOpen(false);
        setItemIdToDelete(null);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentAssessment(null);
        setModalError('');
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setCurrentAssessment(prev => prev ? { ...prev, [name]: name === 'name' ? value : Number(value) } : null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentAssessment) return;
        setModalError('');

        if ('id' in currentAssessment) {
            const originalAssessment = assessments.find(a => a.id === (currentAssessment as Assessment).id);
            if (originalAssessment && isExam(originalAssessment)) {
                if (!isExam(currentAssessment)) {
                    setModalError("The name of an 'Exam' type assessment must contain the word 'exam'.");
                    return;
                }
            }
        }

        if ('id' in currentAssessment) {
            updateAssessment(currentAssessment);
        } else {
            addAssessment(currentAssessment);
        }
        handleCloseModal();
    };

    return (
        <ReadOnlyWrapper allowedRoles={['Admin']}>
            <div className=" space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold text-gray-800">Manage Assessment Types</h1>
                    {isAdmin && (
                        <button
                            onClick={() => saveAssessments()}
                            disabled={!isDirty('assessments') || isSyncing || !isOnline}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg transition-all shadow-md ${(!isDirty('assessments') || isSyncing || !isOnline)
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg'
                                }`}
                            title={!isOnline ? "You are offline" : !isDirty('assessments') ? "No unsaved changes" : "Save assessment types to the cloud"}
                        >
                            {isSyncing ? (
                                <>
                                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span className="text-sm font-bold">Saving...</span>
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                    </svg>
                                    <span className="text-sm font-bold">SAVE</span>
                                </>
                            )}
                        </button>
                    )}
                </div>

                <div className="bg-gray-100 py-4">
                    <div className="flex justify-end">
                        {isAdmin && (
                            <button onClick={handleAddNew} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                                Add New Assessment
                            </button>
                        )}
                    </div>
                </div>

                <div className={`p-4 rounded-md border ${totalWeight === 100 ? 'bg-green-50 border-green-400 text-green-800' : 'bg-yellow-50 border-yellow-400 text-yellow-800'}`}>
                    <p>
                        <span className="font-bold">Total Weight: {totalWeight}%.</span> It is recommended that the sum of all assessment weights equals 100%.
                    </p>
                </div>

                {/* Desktop Table View */}
                <div className="hidden lg:block bg-white p-6 rounded-xl shadow-md border border-gray-200">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50 border-b">
                                    <th className="p-4 font-semibold text-gray-600">#</th>
                                    <th className="p-4 font-semibold text-gray-600">Assessment Name</th>
                                    <th className="p-4 font-semibold text-gray-600">Weight (%)</th>
                                    <th className="p-4 font-semibold text-gray-600">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reorderableAssessments.map((assessment, index) => {
                                    const isDragging = draggedItem?.id === assessment.id;
                                    const isDragTarget = dragOverItem?.id === assessment.id;
                                    return (
                                        <tr
                                            key={assessment.id}
                                            draggable={isAdmin}
                                            onDragStart={() => handleDragStart(assessment)}
                                            onDragEnter={() => handleDragEnter(assessment)}
                                            onDragEnd={handleDragEnd}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={handleDrop}
                                            className={`border-b transition-colors ${isDragging ? 'opacity-30 bg-gray-200' : 'hover:bg-gray-50'} ${isDragTarget && !isDragging ? 'bg-blue-100' : ''}`}
                                        >
                                            <td className="p-4 text-gray-600 font-semibold">{index + 1}</td>
                                            <td className="p-4 font-medium text-gray-900 flex items-center">
                                                {isAdmin && (
                                                    <span className="cursor-move mr-3 text-gray-400 hover:text-gray-700" title="Drag to reorder">
                                                        <DragHandleIcon />
                                                    </span>
                                                )}
                                                {assessment.name}
                                            </td>
                                            <td className="p-4 text-gray-900">{assessment.weight}%</td>
                                            <td className="p-4 space-x-4 flex items-center">
                                                {isAdmin && (
                                                    <>
                                                        <button onClick={() => handleEdit(assessment)} className="text-blue-600 hover:text-blue-800" title="Edit">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteClick(assessment.id)}
                                                            className="text-red-600 hover:text-red-800"
                                                            title="Delete"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {examAssessment && (
                                    <tr key={examAssessment.id} className="border-b bg-gray-50 hover:bg-gray-50">
                                        <td className="p-4 text-gray-600 font-semibold">{reorderableAssessments.length + 1}</td>
                                        <td className="p-4 font-medium text-gray-900 flex items-center">
                                            <span className="w-5 mr-3"></span> {/* Spacer for alignment */}
                                            {examAssessment.name} <span className="ml-2 text-xs text-gray-500 font-normal">(Locked)</span>
                                        </td>
                                        <td className="p-4 text-gray-900">{examAssessment.weight}%</td>
                                        <td className="p-4 space-x-4 flex items-center">
                                            {isAdmin && (
                                                <>
                                                    <button onClick={() => handleEdit(examAssessment)} className="text-blue-600 hover:text-blue-800" title="Edit">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>
                                                    </button>
                                                    <button
                                                        disabled
                                                        className="text-gray-400 cursor-not-allowed"
                                                        title="Assessments with 'Exam' in the name cannot be deleted or reordered."
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden space-y-4">
                    {assessments.map((assessment, index) => (
                        <div key={assessment.id} className="bg-white p-4 rounded-xl shadow-md border border-gray-200 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                    <span className="text-blue-700 font-bold text-sm">{index + 1}</span>
                                </div>
                                <div>
                                    <p className="font-bold text-gray-800">{assessment.name}</p>
                                    <p className="text-sm text-gray-600">Weight: {assessment.weight}%</p>
                                </div>
                            </div>
                            <div className="flex space-x-2 flex-shrink-0">
                                {isAdmin && (
                                    <>
                                        <button onClick={() => handleEdit(assessment)} className="text-blue-600 p-2 rounded-full hover:bg-blue-100" title="Edit">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>
                                        </button>
                                        <button
                                            onClick={() => handleDeleteClick(assessment.id)}
                                            disabled={isExam(assessment)}
                                            className="p-2 rounded-full text-red-600 hover:bg-red-100 disabled:text-gray-400 disabled:hover:bg-transparent"
                                            title={isExam(assessment) ? "Cannot delete exam assessment" : "Delete"}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {isModalOpen && currentAssessment && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                        <div className="bg-white p-6 md:p-8 rounded-xl shadow-2xl w-full max-w-lg m-4">
                            <h2 className="text-2xl font-bold mb-6 text-gray-800">{'id' in currentAssessment ? 'Edit Assessment' : 'Add New Assessment'}</h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Assessment Name</label>
                                    <input type="text" name="name" value={currentAssessment.name} onChange={handleChange} required className={inputStyles} />
                                    {modalError && <p className="text-red-500 text-xs mt-1">{modalError}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Weight / Max Score (%)</label>
                                    <input type="number" name="weight" value={currentAssessment.weight} onChange={handleChange} required className={inputStyles} />
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
                    title="Delete Assessment"
                    message="Are you sure you want to delete this assessment? All related scores will also be removed."
                />
            </div>
        </ReadOnlyWrapper>
    );
};

export default AssessmentTypes;