import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import type { Grade } from '../../types';
import ReadOnlyWrapper from '../ReadOnlyWrapper';
import ConfirmationModal from '../ConfirmationModal';
import { useUser } from '../../context/UserContext';
import { useUserAction } from '../../context/UserActionContext';
import RestoreModal from '../modals/RestoreModal';
import { DIRTY_INDICATOR_BG, DIRTY_INDICATOR_TEXT, DIRTY_INDICATOR_SECONDARY_TEXT, DIRTY_INDICATOR_HOVER_BG, DIRTY_INDICATOR_BORDER } from '../../constants';
import { INITIAL_GRADES } from '../../constants';
import MessageBox from '../MessageBox';

const EMPTY_GRADE_FORM: Omit<Grade, 'id'> = {
    name: '',
    minScore: 0,
    maxScore: 100,
    remark: '',
};

const GradingSystem: React.FC = () => {
    const { recordAction } = useUserAction();
    const { grades, deletedGrades, restoreItem, permanentlyDeleteItem, addGrade, updateGrade, deleteGrade, blockRemoteUpdates, allowRemoteUpdates, saveGrades, isDirty, isItemDirty, isSyncing, isOnline, restoreDefaultGrades, loadMetadata } = useData();
    const { currentUser } = useUser();


    // TRIGGER RECONCILIATION: Identify unsaved local items on mount
    React.useEffect(() => {
        loadMetadata();
    }, [loadMetadata]);
    const isAdmin = currentUser?.role === 'Admin';
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
    const [currentGrade, setCurrentGrade] = useState<Grade | Omit<Grade, 'id'> | null>(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isPermanentConfirmOpen, setIsPermanentConfirmOpen] = useState(false);
    const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
    const [itemIdToDelete, setItemIdToDelete] = useState<number | null>(null);
    const [idToPermanentlyDelete, setIdToPermanentlyDelete] = useState<number | null>(null);
    const [modalError, setModalError] = useState('');
    const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
    const firstInputRef = React.useRef<HTMLInputElement>(null);


    const inputStyles = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500";

    const scaleStatus = useMemo(() => {
        if (grades.length === 0) {
            return {
                isValid: false,
                message: 'No grades defined. The scale must cover 0% to 100%.',
            };
        }

        const sortedGrades = [...grades].sort((a, b) => a.minScore - b.minScore);
        const issues: string[] = [];

        // Check start
        if (sortedGrades[0].minScore !== 0) {
            issues.push('The scale does not start at 0%.');
        }

        // Check end
        if (sortedGrades[sortedGrades.length - 1].maxScore !== 100) {
            issues.push('The scale does not end at 100%.');
        }

        // Check for gaps
        for (let i = 0; i < sortedGrades.length - 1; i++) {
            const diff = sortedGrades[i + 1].minScore - sortedGrades[i].maxScore;
            if (diff > 1 + Number.EPSILON) {
                issues.push(`There is a gap between ${sortedGrades[i].maxScore}% and ${sortedGrades[i + 1].minScore}%.`);
            }
        }

        if (issues.length > 0) {
            return {
                isValid: false,
                message: `The grading scale is incomplete: ${issues.join(' ')}`,
            };
        }

        return {
            isValid: true,
            message: 'The grading scale is complete and covers 0% to 100% without gaps.',
        };
    }, [grades]);

    const visibleDeletedGrades = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.role === 'Admin') return deletedGrades;
        return deletedGrades.filter(g => g.deletedBy === currentUser.id);
    }, [deletedGrades, currentUser]);

    const handleAddNew = () => {
        blockRemoteUpdates();
        setCurrentGrade(EMPTY_GRADE_FORM);
        setIsModalOpen(true);
        recordAction('Opened modal to add new grade');
    };


    const handleEdit = (grade: Grade) => {
        blockRemoteUpdates();
        setCurrentGrade(grade);
        setIsModalOpen(true);
        recordAction(`Opened modal to edit grade: ${grade.name}`);
    };


    const handleDeleteClick = (id: number) => {
        setItemIdToDelete(id);
        setIsConfirmOpen(true);
    };

    const handleConfirmDelete = () => {
        if (itemIdToDelete !== null) {
            deleteGrade(itemIdToDelete);
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
            permanentlyDeleteItem('grades', idToPermanentlyDelete);
        }
        setIsPermanentConfirmOpen(false);
        setIdToPermanentlyDelete(null);
    };

    const handleCloseModal = () => {
        allowRemoteUpdates();
        setIsModalOpen(false);
        setCurrentGrade(null);
        setModalError('');
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
    }, [isModalOpen, currentGrade]);


    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setCurrentGrade(prev => prev ? { ...prev, [name]: name === 'name' || name === 'remark' ? value : Number(value) } : null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        recordAction(`Clicked Commit on ${currentGrade && 'id' in currentGrade ? 'Edit' : 'Add'} Grade modal`);
        if (!currentGrade) return;

        setModalError('');

        if (currentGrade.minScore > currentGrade.maxScore) {
            setModalError("Minimum score cannot be greater than maximum score.");
            return;
        }

        const isOverlapping = grades.some(grade => {
            if ('id' in currentGrade && grade.id === currentGrade.id) {
                return false;
            }
            return currentGrade.minScore <= grade.maxScore && currentGrade.maxScore >= grade.minScore;
        });

        if (isOverlapping) {
            setModalError("The score range overlaps with an existing grade. Please adjust the values.");
            return;
        }

        if ('id' in currentGrade) {
            updateGrade(currentGrade);
        } else {
            addGrade(currentGrade);
            // STAY OPEN ON ADD for continuous entry
            setSaveFeedback(`Grade "${currentGrade.name}" Added!`);
            setCurrentGrade(EMPTY_GRADE_FORM);

            // Explicit focus for batch entry
            setTimeout(() => {
                firstInputRef.current?.focus();
            }, 150);

            setTimeout(() => setSaveFeedback(null), 3000);
            return;
        }
        handleCloseModal();
    };


    const handleRestoreDefault = () => {
        setIsRestoreConfirmOpen(true);
    };

    const confirmRestoreDefault = () => {
        restoreDefaultGrades();
        setIsRestoreConfirmOpen(false);
    };

    return (
        <ReadOnlyWrapper allowedRoles={['Admin']}>
            <div className="space-y-6 pb-24 lg:pb-0">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold text-gray-800">Manage Grading System</h1>
                </div>

                <div className="bg-gray-100 py-4">
                    <div className="flex justify-start gap-4">
                        {isAdmin && (
                            <>
                                <button onClick={handleAddNew} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                    </svg>
                                    Add New Grade
                                </button>
                                <button onClick={handleRestoreDefault} className="flex items-center bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg shadow-sm hover:bg-gray-50 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" />
                                    </svg>
                                    System Default
                                </button>
                                {visibleDeletedGrades.length > 0 && (
                                    <button
                                        onClick={() => setIsRestoreModalOpen(true)}
                                        className="flex items-center space-x-2 px-3 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition shadow-sm font-semibold border border-red-200 ml-auto"
                                        title="Restore Deleted Grades"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                        </svg>
                                        <span className="hidden sm:inline">Restore</span>
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                <div className={`p-4 rounded-md border ${scaleStatus.isValid ? 'bg-green-50 border-green-400 text-green-800' : 'bg-yellow-50 border-yellow-400 text-yellow-800'}`}>
                    <p>
                        <span className="font-bold">Grading Scale Status:</span> {scaleStatus.message}
                    </p>
                </div>

                {/* Desktop Table View */}
                <div className="hidden lg:block bg-white p-6 rounded-xl shadow-md border border-gray-200">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50 border-b">
                                    <th className="p-4 font-semibold text-gray-600">#</th>
                                    <th className="p-4 font-semibold text-gray-600">Grade</th>
                                    <th className="p-4 font-semibold text-gray-600">Score Range</th>
                                    <th className="p-4 font-semibold text-gray-600">Remark</th>
                                    <th className="p-4 font-semibold text-gray-600">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[...grades].sort((a, b) => b.minScore - a.minScore).map((grade, index) => {
                                    const isDirtyRow = isItemDirty('grades', grade.id);
                                    return (
                                        <tr key={grade.id} className={`border-b transition-colors ${isDirtyRow ? `${DIRTY_INDICATOR_BG} ${DIRTY_INDICATOR_TEXT} ${DIRTY_INDICATOR_HOVER_BG}` : 'hover:bg-gray-50'}`}>
                                            <td className="p-4 relative">
                                                {index + 1}
                                                {isDirtyRow && (
                                                    <span className="absolute left-0 top-0 text-[10px] font-bold uppercase tracking-wider px-1 py-0.5 bg-yellow-400 text-black leading-none rounded-br z-10">
                                                        Unsaved
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 font-medium">{grade.name}</td>
                                            <td className={`p-4 ${isDirtyRow ? DIRTY_INDICATOR_SECONDARY_TEXT : 'text-gray-900'}`}>{grade.minScore}% - {grade.maxScore}%</td>
                                            <td className={`p-4 ${isDirtyRow ? DIRTY_INDICATOR_SECONDARY_TEXT : 'text-gray-900'}`}>{grade.remark}</td>
                                            <td className="p-4 space-x-4 flex items-center">
                                                {isAdmin && (
                                                    <>
                                                        <button onClick={() => handleEdit(grade)} className={`${isDirtyRow ? `${DIRTY_INDICATOR_SECONDARY_TEXT} hover:text-white` : 'text-blue-600 hover:text-blue-800'}`} title="Edit">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>
                                                        </button>
                                                        <button onClick={() => handleDeleteClick(grade.id)} className={`${isDirtyRow ? 'text-white hover:text-gray-200 opacity-90' : 'text-red-600 hover:text-red-800'}`} title="Delete">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden space-y-4">
                    {[...grades].sort((a, b) => b.minScore - a.minScore).map((grade, index) => {
                        const isDirtyRow = isItemDirty('grades', grade.id);
                        return (
                            <div key={grade.id} className={`p-4 rounded-xl shadow-md border transition-colors flex justify-between items-center relative ${isDirtyRow ? `${DIRTY_INDICATOR_BG} ${DIRTY_INDICATOR_BORDER} ${DIRTY_INDICATOR_TEXT}` : 'bg-white border-gray-200'}`}>
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
                                        <p className="font-bold">{grade.name} <span className={`font-normal ${isDirtyRow ? DIRTY_INDICATOR_SECONDARY_TEXT : 'text-gray-600'}`}>({grade.minScore}% - {grade.maxScore}%)</span></p>
                                        <p className={`text-sm ${isDirtyRow ? DIRTY_INDICATOR_SECONDARY_TEXT : 'text-gray-600'}`}>{grade.remark}</p>
                                    </div>
                                </div>
                                <div className="flex space-x-2 flex-shrink-0">
                                    {isAdmin && (
                                        <>
                                            <button onClick={() => handleEdit(grade)} className={`${isDirtyRow ? `${DIRTY_INDICATOR_SECONDARY_TEXT} hover:text-white` : 'text-blue-600 hover:bg-blue-100'} p-2 rounded-full`} title="Edit">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>
                                            </button>
                                            <button onClick={() => handleDeleteClick(grade.id)} className={`${isDirtyRow ? 'text-white hover:bg-black/20' : 'text-red-600 hover:bg-red-100'} p-2 rounded-full`} title="Delete">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {isModalOpen && currentGrade && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                        <div className="bg-white p-5 rounded-xl shadow-2xl w-full max-w-lg relative animate-fade-in-scale">
                            {/* Vanishing Feedback Header - Stable DOM to prevent keyboard dismissal */}
                            <div 
                                className={`absolute top-0 left-0 right-0 bg-green-500 text-white py-2 px-4 text-center font-bold z-10 rounded-t-xl text-sm transition-all duration-300 pointer-events-none ${
                                    saveFeedback ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
                                }`}
                            >
                                {saveFeedback || 'Success'}
                            </div>
                            <h2 className="text-xl font-bold mb-4 text-gray-800">{'id' in currentGrade ? 'Edit Grade' : 'Add New Grade'}</h2>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Grade Name</label>
                                    <input ref={firstInputRef} type="text" name="name" value={currentGrade.name} onChange={handleChange} required className={inputStyles} placeholder="e.g. A1, B2" />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Minimum Score (%)</label>
                                        <input type="number" name="minScore" value={currentGrade.minScore} onChange={handleChange} required className={inputStyles} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Maximum Score (%)</label>
                                        <input type="number" name="maxScore" value={currentGrade.maxScore} onChange={handleChange} required className={inputStyles} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Remark</label>
                                    <input type="text" name="remark" value={currentGrade.remark} onChange={handleChange} required className={inputStyles} />
                                </div>
                                {modalError && <p className="text-[10px] text-red-600 font-semibold">{modalError}</p>}
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
                    onClose={() => setIsConfirmOpen(false)}
                    onConfirm={handleConfirmDelete}
                    title="Delete Grade"
                    message="Are you sure you want to delete this grade? Its records will be hidden."
                />

                <MessageBox
                    isOpen={isRestoreConfirmOpen}
                    onConfirm={confirmRestoreDefault}
                    onCancel={() => setIsRestoreConfirmOpen(false)}
                    title="Restore System Default Grades"
                    message={`Are you sure you want to restore the system default grading scale? \n\nThis will replace all your current grades with the standard scale (9 grades). All current grades will be deleted. You will need to save changes to persist this.`}
                    variant="warning"
                    confirmText="Restore Defaults"
                />

                <RestoreModal
                    isOpen={isRestoreModalOpen}
                    onClose={() => setIsRestoreModalOpen(false)}
                    title="Restore Deleted Grades"
                    items={deletedGrades}
                    onRestore={(id) => restoreItem('grades', id)}
                    onDeletePermanently={handlePermanentDeleteClick}
                    itemNameKey="name"
                />

                <ConfirmationModal
                    isOpen={isPermanentConfirmOpen}
                    message={
                        <>
                            Are you sure you want to <span className="font-bold text-red-600 underline">permanently delete</span> this grade? 
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
        </ReadOnlyWrapper>
    );
};

export default GradingSystem;