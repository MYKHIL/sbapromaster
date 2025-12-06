import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import InlineScoreInput from '../InlineScoreInput';
import ScoreManagementModal from '../ScoreManagementModal';
import type { Student, Assessment } from '../../types';

const ScoreEntry: React.FC = () => {
    const { students, subjects, assessments, classes, getStudentScores, updateStudentScores } = useData();
    const [selectedClass, setSelectedClass] = useState<string>(() => {
        return localStorage.getItem('scoreEntry_selectedClass') || classes[0]?.name || '';
    });
    const [selectedSubjectId, setSelectedSubjectId] = useState<number>(() => {
        const saved = localStorage.getItem('scoreEntry_selectedSubjectId');
        return saved ? Number(saved) : (subjects[0]?.id || 0);
    });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalData, setModalData] = useState<{ student: Student; assessment: Assessment, isExam: boolean } | null>(null);

    const filteredStudents = useMemo(() => {
        if (!selectedClass) return students;
        return students.filter(student => student.class === selectedClass);
    }, [students, selectedClass]);

    const handleOpenModal = (student: Student, assessment: Assessment) => {
        setModalData({ student, assessment, isExam: assessment.name.toLowerCase().includes('exam') });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setModalData(null);
    };

    const handleAddScore = (newScore: string) => {
        if (!modalData) return;
        const { student, assessment } = modalData;
        const currentScores = getStudentScores(student.id, selectedSubjectId, assessment.id);
        updateStudentScores(student.id, selectedSubjectId, assessment.id, [...currentScores, newScore]);
    };

    const handleDeleteScore = (index: number) => {
        if (!modalData) return;
        const { student, assessment } = modalData;
        const currentScores = getStudentScores(student.id, selectedSubjectId, assessment.id);
        const updatedScores = currentScores.filter((_, i) => i !== index);
        updateStudentScores(student.id, selectedSubjectId, assessment.id, updatedScores);
    };

    const handleUpdateScore = (index: number, updatedScore: string) => {
        if (!modalData) return;
        const { student, assessment } = modalData;
        const currentScores = getStudentScores(student.id, selectedSubjectId, assessment.id);
        const updatedScores = [...currentScores];
        updatedScores[index] = updatedScore;
        updateStudentScores(student.id, selectedSubjectId, assessment.id, updatedScores);
    };

    const totalWeight = useMemo(() => {
        return assessments.reduce((acc, curr) => acc + curr.weight, 0);
    }, [assessments]);

    const selectStyles = "w-full p-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500";

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Score Entry</h1>

            <div className="bg-gray-100 py-4 sticky top-20 lg:top-0 z-20 shadow-md transition-all duration-300">
                <div className="flex flex-col sm:flex-row gap-4 p-4 bg-white rounded-xl shadow-md border border-gray-200">
                    <div className="flex-1">
                        <label htmlFor="class-select" className="block text-sm font-medium text-gray-700 mb-1">Select Class</label>
                        <select
                            id="class-select"
                            value={selectedClass}
                            onChange={(e) => {
                                const newValue = e.target.value;
                                setSelectedClass(newValue);
                                localStorage.setItem('scoreEntry_selectedClass', newValue);
                            }}
                            className={selectStyles}
                        >
                            <option value="">-- All Classes --</option>
                            {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label htmlFor="subject-select" className="block text-sm font-medium text-gray-700 mb-1">Select Subject</label>
                        <select
                            id="subject-select"
                            value={selectedSubjectId}
                            onChange={(e) => {
                                const newValue = Number(e.target.value);
                                setSelectedSubjectId(newValue);
                                localStorage.setItem('scoreEntry_selectedSubjectId', String(newValue));
                            }}
                            className={selectStyles}
                        >
                            {subjects.map(s => <option key={s.id} value={s.id}>{s.subject}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {totalWeight !== 100 && (
                <div className="p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 rounded-md">
                    <p className="font-bold">Warning</p>
                    <p>The sum of weights for all assessments is {totalWeight}%, not 100%. Please review assessment types in settings.</p>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-md border border-gray-200">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left">
                        <thead className="bg-gray-50">
                            <tr className="border-b">
                                <th className="p-4 font-semibold text-gray-600 w-1/4">Student Name</th>
                                {assessments.map(assessment => (
                                    <th key={assessment.id} className="p-4 font-semibold text-gray-600 text-center">
                                        {assessment.name} <br /> <span className="font-normal text-sm">({assessment.name.toLowerCase().includes('exam') ? 100 : assessment.weight}%)</span>
                                    </th>
                                ))}
                                <th className="p-4 font-semibold text-gray-600 text-center">Total (100%)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStudents.length > 0 ? (
                                filteredStudents.map(student => (
                                    <InlineScoreInput
                                        key={student.id}
                                        student={student}
                                        subjectId={selectedSubjectId}
                                        assessments={assessments}
                                        onOpenModal={handleOpenModal}
                                    />
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={assessments.length + 2} className="text-center p-8 text-gray-500">
                                        No students in the selected class.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && modalData && (
                <ScoreManagementModal
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    studentName={modalData.student.name}
                    assessment={modalData.assessment}
                    scores={getStudentScores(modalData.student.id, selectedSubjectId, modalData.assessment.id)}
                    onAddScore={handleAddScore}
                    onDeleteScore={handleDeleteScore}
                    onUpdateScore={handleUpdateScore}
                    isExam={modalData.isExam}
                />
            )}
        </div>
    );
};

export default ScoreEntry;