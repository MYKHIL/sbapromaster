import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import type { Grade } from '../../types';
import ReadOnlyWrapper from '../ReadOnlyWrapper';
import ConfirmationModal from '../ConfirmationModal';
import { useUser } from '../../context/UserContext';

const EMPTY_GRADE_FORM: Omit<Grade, 'id'> = {
    name: '',
    minScore: 0,
    maxScore: 100,
    remark: '',
};

const GradingSystem: React.FC = () => {
    const { grades, addGrade, updateGrade, deleteGrade, blockRemoteUpdates, allowRemoteUpdates, saveGrades, isDirty, isSyncing, isOnline } = useData();
    const { currentUser } = useUser();
    const isAdmin = currentUser?.role === 'Admin';
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentGrade, setCurrentGrade] = useState<Grade | Omit<Grade, 'id'> | null>(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [itemIdToDelete, setItemIdToDelete] = useState<number | null>(null);
    const [modalError, setModalError] = useState('');

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
            // Allow a gap of 1 (integer boundaries) or less (decimal precision)
            // e.g. 59 -> 60 (diff 1) is ok. 59.9 -> 60 (diff 0.1) is ok.
            // But 59 -> 61 (diff 2) is a gap.
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

    const handleAddNew = () => {
        blockRemoteUpdates(); // Block sync while editing
        setCurrentGrade(EMPTY_GRADE_FORM);
        setIsModalOpen(true);
    };

    const handleEdit = (grade: Grade) => {
        blockRemoteUpdates(); // Block sync while editing
        setCurrentGrade(grade);
        setIsModalOpen(true);
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

    const handleCloseModal = () => {
        allowRemoteUpdates(); // Re-enable sync after closing
        setIsModalOpen(false);
        setCurrentGrade(null);
        setModalError('');
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setCurrentGrade(prev => prev ? { ...prev, [name]: name === 'name' || name === 'remark' ? value : Number(value) } : null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentGrade) return;
        setModalError('');

        if (currentGrade.minScore > currentGrade.maxScore) {
            setModalError("Minimum score cannot be greater than maximum score.");
            return;
        }

        const isOverlapping = grades.some(grade => {
            if ('id' in currentGrade && grade.id === currentGrade.id) {
                return false; // Skip self-check when editing
            }
            // Check if the new range [min, max] overlaps with an existing range [g.min, g.max]
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
        }
        handleCloseModal();
    };

    return (
        <ReadOnlyWrapper allowedRoles={['Admin']}>
            <div className="space-y-6 pb-20">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold text-gray-800">Manage Grading System</h1>
                    {/* Save Button Removed - Using Global Action Bar */}
                </div>

                <div className="bg-gray-100 py-4">
                    <div className="flex justify-start">
                        {isAdmin && (
                            <button onClick={handleAddNew} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                                Add New Grade
                            </button>
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
                                {[...grades].sort((a, b) => b.minScore - a.minScore).map((grade, index) => (
                                    <tr key={grade.id} className="border-b hover:bg-gray-50">
                                        <td className="p-4 text-gray-600 font-semibold">{index + 1}</td>
                                        <td className="p-4 font-medium text-gray-900">{grade.name}</td>
                                        <td className="p-4 text-gray-900">{grade.minScore}% - {grade.maxScore}%</td>
                                        <td className="p-4 text-gray-900">{grade.remark}</td>
                                        <td className="p-4 space-x-4 flex items-center">
                                            {isAdmin && (
                                                <>
                                                    <button onClick={() => handleEdit(grade)} className="text-blue-600 hover:text-blue-800" title="Edit">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>
                                                    </button>
                                                    <button onClick={() => handleDeleteClick(grade.id)} className="text-red-600 hover:text-red-800" title="Delete">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden space-y-4">
                    {[...grades].sort((a, b) => b.minScore - a.minScore).map((grade, index) => (
                        <div key={grade.id} className="bg-white p-4 rounded-xl shadow-md border border-gray-200 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                    <span className="text-blue-700 font-bold text-sm">{index + 1}</span>
                                </div>
                                <div>
                                    <p className="font-bold text-gray-800">{grade.name} <span className="font-normal text-gray-600">({grade.minScore}% - {grade.maxScore}%)</span></p>
                                    <p className="text-sm text-gray-600">{grade.remark}</p>
                                </div>
                            </div>
                            <div className="flex space-x-2 flex-shrink-0">
                                {isAdmin && (
                                    <>
                                        <button onClick={() => handleEdit(grade)} className="text-blue-600 p-2 rounded-full hover:bg-blue-100" title="Edit">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>
                                        </button>
                                        <button onClick={() => handleDeleteClick(grade.id)} className="text-red-600 p-2 rounded-full hover:bg-red-100" title="Delete">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>


                {isModalOpen && currentGrade && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                        <div className="bg-white p-6 md:p-8 rounded-xl shadow-2xl w-full max-w-lg m-4">
                            <h2 className="text-2xl font-bold mb-6 text-gray-800">{'id' in currentGrade ? 'Edit Grade' : 'Add New Grade'}</h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Grade Name</label>
                                    <input type="text" name="name" value={currentGrade.name} onChange={handleChange} required className={inputStyles} />
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
                                {modalError && <p className="text-sm text-red-600">{modalError}</p>}
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
                    title="Delete Grade"
                    message="Are you sure you want to delete this grade? This will affect report card generation."
                />
            </div>
        </ReadOnlyWrapper>
    );
};

export default GradingSystem;