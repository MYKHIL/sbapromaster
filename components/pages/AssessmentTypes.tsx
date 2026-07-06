import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import type { Assessment } from '../../types';
import ReadOnlyWrapper from '../ReadOnlyWrapper';
import ConfirmationModal from '../ConfirmationModal';
import { useUser } from '../../context/UserContext';
import { useUserAction } from '../../context/UserActionContext';
import RestoreModal from '../modals/RestoreModal';
import { DIRTY_INDICATOR_BG, DIRTY_INDICATOR_TEXT, DIRTY_INDICATOR_SECONDARY_TEXT, DIRTY_INDICATOR_HOVER_BG, DIRTY_INDICATOR_BORDER } from '../../constants';

const EMPTY_ASSESSMENT_FORM: Omit<Assessment, 'id'> = {
    name: '',
    weight: 10,
    type: 'Class',
};

const DragHandleIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 16 16">
        <path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
    </svg>
);


const AssessmentTypes: React.FC = () => {
    const { recordAction } = useUserAction();
    const { assessments, deletedAssessments, restoreItem, permanentlyDeleteItem, setAssessments, addAssessment, updateAssessment, deleteAssessment, saveAssessments, isDirty, isItemDirty, isSyncing, isOnline, loadMetadata } = useData();
    const { currentUser } = useUser();


    // TRIGGER RECONCILIATION: Identify unsaved local items on mount
    React.useEffect(() => {
        loadMetadata();
    }, [loadMetadata]);
    const isAdmin = currentUser?.role === 'Admin';
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
    const [currentAssessment, setCurrentAssessment] = useState<Assessment | Omit<Assessment, 'id'> | null>(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isPermanentConfirmOpen, setIsPermanentConfirmOpen] = useState(false);
    const [itemIdToDelete, setItemIdToDelete] = useState<number | null>(null);
    const [idsToPermanentlyDelete, setIdsToPermanentlyDelete] = useState<number[]>([]);
    const [modalError, setModalError] = useState('');
    const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
    const [sessionAddedIds, setSessionAddedIds] = useState<number[]>([]);
    const [isSessionListOpen, setIsSessionListOpen] = useState(false);
    const firstInputRef = React.useRef<HTMLInputElement>(null);


    const [draggedItem, setDraggedItem] = useState<Assessment | null>(null);
    const [dragOverItem, setDragOverItem] = useState<Assessment | null>(null);

    const inputStyles = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500";

    const isExam = (assessment: Assessment | Omit<Assessment, 'id'>) => assessment.name.toLowerCase().includes('exam');

    const examAssessments = useMemo(() => assessments.filter(a => isExam(a)), [assessments]);
    const lockedExamId = useMemo(() => {
        if (examAssessments.length === 0) return null;
        return Math.min(...examAssessments.map(a => a.id));
    }, [examAssessments]);

    const lockedExam = useMemo(() => assessments.find(a => a.id === lockedExamId), [assessments, lockedExamId]);
    
    // Non-exam assessments and other exams that are not locked
    const reorderableAssessments = useMemo(() => {
        // First, get all assessments except the locked one
        const others = assessments.filter(a => a.id !== lockedExamId);
        // Sort them: Non-exams first, then other exams
        return others.sort((a, b) => {
            const isAExam = isExam(a);
            const isBExam = isExam(b);
            if (isAExam && !isBExam) return 1;
            if (!isAExam && isBExam) return -1;
            return 0; // Maintain relative order for same type
        });
    }, [assessments, lockedExamId]);

    const totalWeight = useMemo(() => {
        return assessments.reduce((acc, curr) => acc + curr.weight, 0);
    }, [assessments]);

    const visibleDeletedAssessments = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.role === 'Admin') return deletedAssessments;
        return deletedAssessments.filter(a => a.deletedBy === currentUser.id);
    }, [deletedAssessments, currentUser]);

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

        const currentIndex = assessments.findIndex(item => item.id === draggedItem.id);
        const targetIndex = assessments.findIndex(item => item.id === dragOverItem.id);

        let newAssessmentsList = [...assessments];
        const [removed] = newAssessmentsList.splice(currentIndex, 1);
        newAssessmentsList.splice(targetIndex, 0, removed);

        // RE-SORT to ensure exams are always last and locked is at the very bottom
        const sortedList = newAssessmentsList.sort((a, b) => {
            if (a.id === lockedExamId) return 1;
            if (b.id === lockedExamId) return -1;
            const isAExam = isExam(a);
            const isBExam = isExam(b);
            if (isAExam && !isBExam) return 1;
            if (!isAExam && isBExam) return -1;
            return 0;
        });

        setAssessments(sortedList);
        handleDragEnd();
    };


    const handleAddNew = () => {
        setCurrentAssessment(EMPTY_ASSESSMENT_FORM);
        setIsModalOpen(true);
        recordAction('Opened modal to add new assessment type');
    };

    const handleEdit = (assessment: Assessment) => {
        setCurrentAssessment(assessment);
        setIsModalOpen(true);
        recordAction(`Opened modal to edit assessment: ${assessment.name}`);
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

    const handlePermanentDeleteClick = (ids: number[] | number) => {
        setIdsToPermanentlyDelete(Array.isArray(ids) ? ids : [ids]);
        setIsPermanentConfirmOpen(true);
    };

    const handleConfirmPermanentDelete = () => {
        if (idsToPermanentlyDelete.length > 0) {
            idsToPermanentlyDelete.forEach(id => permanentlyDeleteItem('assessments', id));
        }
        setIsPermanentConfirmOpen(false);
        setIdsToPermanentlyDelete([]);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentAssessment(null);
        setModalError('');
        setSaveFeedback(null);
        setSessionAddedIds([]);
        setIsSessionListOpen(false);
    };

    // Auto-focus logic: Trigger ONLY on initial modal open
    React.useEffect(() => {
        if (isModalOpen && firstInputRef.current) {
            const timer = setTimeout(() => {
                firstInputRef.current?.focus();
                firstInputRef.current?.select();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isModalOpen]);


    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setCurrentAssessment(prev => prev ? { ...prev, [name]: name === 'name' ? value : Number(value) } : null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        recordAction(`Clicked Commit on ${currentAssessment && 'id' in currentAssessment ? 'Edit' : 'Add'} Assessment modal`);
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

        const assessmentToSave = {
            ...currentAssessment,
            type: (isExam(currentAssessment) ? 'Exam' : 'Class') as 'Class' | 'Exam'
        };

        if ('id' in assessmentToSave) {
            updateAssessment(assessmentToSave as Assessment);
        } else {
            const newId = addAssessment(assessmentToSave);
            if (newId) {
                setSessionAddedIds(prev => [newId, ...prev]);
            }
            // STAY OPEN ON ADD for continuous entry
            setSaveFeedback(`Assessment "${assessmentToSave.name}" Added!`);
            setCurrentAssessment(EMPTY_ASSESSMENT_FORM);

            // Explicit focus AND select for batch entry (after reset)
            setTimeout(() => {
                if (firstInputRef.current) {
                    firstInputRef.current.focus();
                    firstInputRef.current.select();
                }
            }, 150);

            setTimeout(() => setSaveFeedback(null), 3000);
            return;
        }
        handleCloseModal();
    };


    return (
        <ReadOnlyWrapper allowedRoles={['Admin']}>
            <div className=" space-y-6 pb-24 lg:pb-0">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold text-gray-800">Manage Assessment Types</h1>
                    {/* Save Button Removed - Using Global Action Bar */}
                </div>

                <div className="bg-gray-100 py-4">
                    <div className="flex flex-wrap justify-start gap-2 sm:gap-3">
                        {isAdmin && (
                            <>
                                <button onClick={handleAddNew} className="flex min-w-[180px] flex-1 items-center justify-center bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                    </svg>
                                    Add New Assessment
                                </button>
                                {visibleDeletedAssessments.length > 0 && (
                                    <button
                                        onClick={() => setIsRestoreModalOpen(true)}
                                        className="group flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-all shadow-sm font-semibold border border-red-200"
                                        title="Restore Deleted Assessments"
                                    >
                                        <span className="text-lg leading-none transition-transform duration-300 group-hover:rotate-180 group-hover:scale-110" aria-hidden="true">♻</span>
                                        <span className="font-semibold">Recycle Bin</span>
                                    </button>
                                )}
                            </>
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
                                    const isDirtyRow = isItemDirty('assessments', assessment.id);
                                    return (
                                        <tr
                                            key={assessment.id}
                                            draggable={isAdmin}
                                            onDragStart={() => handleDragStart(assessment)}
                                            onDragEnter={() => handleDragEnter(assessment)}
                                            onDragEnd={handleDragEnd}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={handleDrop}
                                            className={`border-b transition-colors ${isDirtyRow ? `${DIRTY_INDICATOR_BG} ${DIRTY_INDICATOR_TEXT} ${DIRTY_INDICATOR_HOVER_BG}` : (isDragging ? 'opacity-30 bg-gray-200' : 'hover:bg-gray-50')} ${isDragTarget && !isDragging ? 'bg-blue-100' : ''}`}
                                        >
                                            <td className="p-4 relative">
                                                {index + 1}
                                                {isDirtyRow && (
                                                    <span className="absolute left-0 top-0 text-[10px] font-bold uppercase tracking-wider px-1 py-0.5 bg-yellow-400 text-black leading-none rounded-br z-10">
                                                        Unsaved
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 font-medium flex items-center">
                                                {isAdmin && (
                                                    <span className={`cursor-move mr-3 ${isDirtyRow ? DIRTY_INDICATOR_SECONDARY_TEXT : 'text-gray-400 hover:text-gray-700'}`} title="Drag to reorder">
                                                        <DragHandleIcon />
                                                    </span>
                                                )}
                                                {assessment.name}
                                            </td>
                                            <td className={`p-4 ${isDirtyRow ? DIRTY_INDICATOR_SECONDARY_TEXT : 'text-gray-900'}`}>{assessment.weight}%</td>
                                            <td className="p-4 space-x-4 flex items-center">
                                                {isAdmin && (
                                                    <>
                                                        <button onClick={() => handleEdit(assessment)} className={`${isDirtyRow ? `${DIRTY_INDICATOR_SECONDARY_TEXT} hover:text-white` : 'text-blue-600 hover:text-blue-800'}`} title="Edit">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteClick(assessment.id)}
                                                            className={`${isDirtyRow ? 'text-white hover:text-gray-200 opacity-90' : 'text-red-600 hover:text-red-800'}`}
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
                                {lockedExam && (() => {
                                    const isDirtyRow = isItemDirty('assessments', lockedExam.id);
                                    return (
                                        <tr key={lockedExam.id} className={`border-b transition-colors ${isDirtyRow ? `${DIRTY_INDICATOR_BG} ${DIRTY_INDICATOR_TEXT} ${DIRTY_INDICATOR_HOVER_BG}` : 'bg-gray-50 hover:bg-gray-50'}`}>
                                            <td className="p-4 relative">
                                                {reorderableAssessments.length + 1}
                                                {isDirtyRow && (
                                                    <span className="absolute left-0 top-0 text-[10px] font-bold uppercase tracking-wider px-1 py-0.5 bg-yellow-400 text-black leading-none rounded-br z-10">
                                                        Unsaved
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 font-medium flex items-center">
                                                <span className="w-5 mr-3"></span> {/* Spacer for alignment */}
                                                {lockedExam.name} <span className={`ml-2 text-xs font-normal ${isDirtyRow ? DIRTY_INDICATOR_SECONDARY_TEXT : 'text-gray-500'}`}>(Locked)</span>
                                            </td>
                                            <td className={`p-4 ${isDirtyRow ? DIRTY_INDICATOR_SECONDARY_TEXT : 'text-gray-900'}`}>{lockedExam.weight}%</td>
                                            <td className="p-4 space-x-4 flex items-center">
                                                {isAdmin && (
                                                    <>
                                                        <button onClick={() => handleEdit(lockedExam)} className={`${isDirtyRow ? `${DIRTY_INDICATOR_SECONDARY_TEXT} hover:text-white` : 'text-blue-600 hover:text-blue-800'}`} title="Edit">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>
                                                        </button>
                                                        <button
                                                            disabled
                                                            className={`${isDirtyRow ? 'text-blue-800' : 'text-gray-400'} cursor-not-allowed`}
                                                            title="The exam with the minimum ID is locked and cannot be deleted."
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })()}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden space-y-4">
                    {assessments.map((assessment, index) => {
                        const isDirtyRow = isItemDirty('assessments', assessment.id);
                        return (
                            <div key={assessment.id} className={`p-4 rounded-xl shadow-md border transition-colors flex justify-between items-center ${isDirtyRow ? 'bg-blue-900 border-blue-800 text-white' : 'bg-white border-gray-200'}`}>
                                <div className="flex items-center gap-3">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center relative">
                                        <div className={`absolute inset-0 rounded-full opacity-20 ${isDirtyRow ? 'bg-white' : 'bg-blue-500'}`}></div>
                                        <span className={`${isDirtyRow ? 'text-white' : 'text-blue-700'} font-bold text-sm z-10`}>{index + 1}</span>
                                    </div>
                                    <div>
                                        <p className={`font-bold ${isDirtyRow ? 'text-white' : 'text-gray-800'}`}>{assessment.name}</p>
                                        <p className={`text-sm ${isDirtyRow ? 'text-blue-100' : 'text-gray-600'}`}>Weight: {assessment.weight}%</p>
                                    </div>
                                </div>
                                <div className="flex space-x-2 flex-shrink-0">
                                    {isAdmin && (
                                        <>
                                            <button onClick={() => handleEdit(assessment)} className={`${isDirtyRow ? 'text-blue-200 hover:bg-blue-800' : 'text-blue-600 hover:bg-blue-100'} p-2 rounded-full`} title="Edit">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>
                                            </button>
                                            <button
                                                onClick={() => handleDeleteClick(assessment.id)}
                                                disabled={assessment.id === lockedExamId}
                                                className={`p-2 rounded-full ${isDirtyRow ? (assessment.id === lockedExamId ? 'text-blue-800 cursor-not-allowed' : 'text-red-300 hover:bg-red-900/50') : (assessment.id === lockedExamId ? 'text-gray-400 cursor-not-allowed' : 'text-red-600 hover:bg-red-100')}`}
                                                title={assessment.id === lockedExamId ? "Cannot delete locked exam assessment" : "Delete"}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {isModalOpen && currentAssessment && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-2 sm:p-4">
                        <div className="bg-white p-3 sm:p-5 rounded-xl shadow-2xl w-full max-w-lg relative animate-fade-in-scale overflow-y-auto max-h-[98vh] sm:max-h-[95vh]">

                            <div className="flex items-center justify-between mb-3 border-b pb-2">
                                <h2 className="text-lg sm:text-xl font-bold text-gray-800">{'id' in currentAssessment ? 'Edit Assessment' : 'Add New Assessment'}</h2>
                                
                                {/* Session Counter Badge (Header position) */}
                                {sessionAddedIds.length > 0 && (
                                    <button 
                                        type="button"
                                        onClick={() => setIsSessionListOpen(!isSessionListOpen)}
                                        className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-sm border border-blue-500 active:scale-95"
                                    >
                                        <span className="text-[10px] font-bold">{sessionAddedIds.length} Added</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 transition-transform ${isSessionListOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                )}
                            </div>

                            {/* Feedback label removed from top */}

                            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                                <div className="grid grid-cols-2 gap-2.5">
                                    <div className="col-span-1">
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-tight mb-1">Assessment Name</label>
                                        <div className="relative">
                                            <input ref={firstInputRef} type="text" name="name" value={currentAssessment.name} onChange={handleChange} required className={`${inputStyles} py-1.5 text-sm`} placeholder="e.g. Class Test 1" />
                                            
                                            {/* Session List Dropdown */}
                                            {isSessionListOpen && sessionAddedIds.length > 0 && (
                                                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-100 p-2 max-h-40 overflow-y-auto animate-fade-in-down ring-1 ring-black/5">
                                                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 px-1 flex justify-between">
                                                        <span>Session History</span>
                                                        <span>({sessionAddedIds.length})</span>
                                                    </div>
                                                    <div className="space-y-1">
                                                        {sessionAddedIds.map(id => {
                                                            const a = assessments.find(item => item.id === id);
                                                            const isDirty = isItemDirty('assessments', id);
                                                            return (
                                                                <div key={id} className="flex items-center justify-between px-2 py-1.5 bg-gray-50 rounded text-xs">
                                                                    <span className="truncate flex-1 text-gray-700 font-medium">{a?.name || 'Unknown'}</span>
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

                                    <div className="col-span-1">
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-tight mb-1">Weight (%)</label>
                                        <input type="number" name="weight" value={currentAssessment.weight} onChange={handleChange} required className={`${inputStyles} py-1.5 text-sm`} />
                                    </div>
                                </div>

                                {modalError && <p className="text-red-500 text-[10px] mt-0.5 font-bold animate-pulse">{modalError}</p>}

                                <div className="flex justify-end pt-2 space-x-2 border-t mt-2">
                                    <button type="button" onClick={handleCloseModal} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors">Close</button>
                                    <button type="submit" className="px-5 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-sm transition-all active:scale-95">Commit</button>
                                </div>
                            </form>

                        </div>
                    </div>
                )}
                <ConfirmationModal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Delete Assessment Type"
                message="Are you sure you want to delete this assessment type? Its records will be hidden."
            />

            <RestoreModal
                isOpen={isRestoreModalOpen}
                onClose={() => setIsRestoreModalOpen(false)}
                title="Restore Deleted Assessments"
                items={deletedAssessments}
                onRestore={(ids) => restoreItem('assessments', ids)}
                onDeletePermanently={handlePermanentDeleteClick}
                itemNameKey="name"
            />

            <ConfirmationModal
                isOpen={isPermanentConfirmOpen}
                message={
                    <>
                        Are you sure you want to <span className="font-bold text-red-600 underline">permanently delete</span> {idsToPermanentlyDelete.length > 1 ? 'these selected assessment types' : 'this assessment type'}? 
                        <br /><br />
                        This action <span className="font-bold">cannot be undone</span> and all related records will be completely removed from the system.
                    </>
                }
                onConfirm={handleConfirmPermanentDelete}
                onClose={() => {
                    setIsPermanentConfirmOpen(false);
                    setIdsToPermanentlyDelete([]);
                }}
                title="Permanent Deletion"
                variant="danger"
                confirmText="Yes, Delete Permanently"
            />
        </div>
        </ReadOnlyWrapper>
    );
};

export default AssessmentTypes;