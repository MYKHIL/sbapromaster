import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import InlineScoreInput from '../InlineScoreInput';
import ScoreManagementModal from '../ScoreManagementModal';
import type { Student, Assessment } from '../../types';

const ScoreEntry: React.FC = () => {
    // Destructure with default empty arrays to prevent undefined errors
    const { students = [], subjects = [], assessments = [], classes = [], getStudentScores, updateStudentScores } = useData();

    // Safe initialization for selectedClass
    const [selectedClass, setSelectedClass] = useState<string>(() => {
        try {
            const saved = localStorage.getItem('scoreEntry_selectedClass');
            if (saved) return saved;
            return classes.length > 0 ? classes[0].name : '';
        } catch (e) {
            return '';
        }
    });

    // Safe initialization for selectedSubjectId
    const [selectedSubjectId, setSelectedSubjectId] = useState<number>(() => {
        try {
            const saved = localStorage.getItem('scoreEntry_selectedSubjectId');
            if (saved) return Number(saved);
            return subjects.length > 0 ? subjects[0].id : 0;
        } catch (e) {
            return 0;
        }
    });

    // Mobile View State
    const [selectedStudentIndex, setSelectedStudentIndex] = useState(0);

    // Safe initialization for selectedAssessmentId
    const [selectedAssessmentId, setSelectedAssessmentId] = useState<number>(() => {
        return assessments.length > 0 ? assessments[0].id : 0;
    });

    const [mobileScoreError, setMobileScoreError] = useState<string>('');
    const [useMobileView, setUseMobileView] = useState(true);

    // Ensure selectedAssessmentId is valid when assessments change
    useEffect(() => {
        if (assessments.length > 0) {
            const exists = assessments.find(a => a.id === selectedAssessmentId);
            if (!exists) {
                setSelectedAssessmentId(assessments[0].id);
            }
        }
    }, [assessments, selectedAssessmentId]);

    const filteredStudents = useMemo(() => {
        if (!students) return [];
        if (!selectedClass) return students;
        return students.filter(student => student.class === selectedClass);
    }, [students, selectedClass]);

    const handleNextStudent = () => {
        if (selectedStudentIndex < filteredStudents.length - 1) {
            setSelectedStudentIndex(prev => prev + 1);
            setMobileScoreError('');
        }
    };

    const handlePrevStudent = () => {
        if (selectedStudentIndex > 0) {
            setSelectedStudentIndex(prev => prev - 1);
            setMobileScoreError('');
        }
    };

    const scoreInputRef = React.useRef<HTMLInputElement>(null);

    // Auto-focus score input when student changes in mobile view
    useEffect(() => {
        if (useMobileView && scoreInputRef.current) {
            scoreInputRef.current.focus();
        }
    }, [selectedStudentIndex, useMobileView]);

    const handleMobileScoreUpdate = (value: string) => {
        const student = filteredStudents[selectedStudentIndex];
        if (!student) return;

        const assessment = assessments.find(a => a.id === selectedAssessmentId);
        if (!assessment) return;

        const rawScoreInput = value.trim();
        const isExam = assessment.name.toLowerCase().includes('exam');
        const maxScore = isExam ? 100 : assessment.weight;
        const basis = isExam ? 100 : assessment.weight;

        setMobileScoreError('');

        if (!rawScoreInput) {
            updateStudentScores(student.id, selectedSubjectId, assessment.id, []);
            return;
        }

        let convertedScore: number;
        if (rawScoreInput.includes('/')) {
            const parts = rawScoreInput.split('/');
            if (parts.length !== 2) { setMobileScoreError("Use 'x' or 'x/y'"); return; }
            const [x, y] = parts.map(Number);
            if (isNaN(x) || isNaN(y)) { setMobileScoreError("Numbers only"); return; }
            if (y === 0) { setMobileScoreError("Base cannot be 0"); return; }
            convertedScore = (x / y) * maxScore;
        } else {
            const z = Number(rawScoreInput);
            if (isNaN(z)) { setMobileScoreError("Score must be a number"); return; }
            convertedScore = z;
        }

        if (convertedScore > maxScore) { setMobileScoreError(`Max is ${maxScore}`); return; }
        if (convertedScore < 0) { setMobileScoreError("Cannot be negative"); return; }

        const finalScore = `${Number(convertedScore.toFixed(1))}/${basis}`;
        updateStudentScores(student.id, selectedSubjectId, assessment.id, [finalScore]);
    };

    const getMobileCurrentScore = () => {
        const student = filteredStudents[selectedStudentIndex];
        if (!student) return '';
        const scores = getStudentScores(student.id, selectedSubjectId, selectedAssessmentId);
        return scores[0] || '';
    };

    const getPlaceholder = () => {
        const assessment = assessments.find(a => a.id === selectedAssessmentId);
        if (!assessment) return '-';
        return assessment.name.toLowerCase().includes('exam') ? 'e.g., 85' : '-';
    };

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalData, setModalData] = useState<{ student: Student; assessment: Assessment, isExam: boolean } | null>(null);

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
                <div className="flex flex-col gap-4 p-4 bg-white rounded-xl shadow-md border border-gray-200">

                    {/* Mobile View Toggle - Top */}
                    <div className="lg:hidden flex items-center pb-2 border-b border-gray-100 mb-2">
                        <label className="flex items-center space-x-2 cursor-pointer select-none w-full">
                            <input
                                type="checkbox"
                                checked={useMobileView}
                                onChange={(e) => setUseMobileView(e.target.checked)}
                                className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                            />
                            <span className="text-sm font-bold text-gray-700">Compact View</span>
                        </label>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
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

                    {/* Mobile Compact View Controls */}
                    {useMobileView && (
                        <div className="lg:hidden space-y-4 border-t border-gray-100 pt-4 mt-2">
                            {filteredStudents.length > 0 ? (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
                                            <select
                                                value={selectedStudentIndex}
                                                onChange={(e) => setSelectedStudentIndex(Number(e.target.value))}
                                                className={selectStyles}
                                            >
                                                {filteredStudents.map((student, index) => (
                                                    <option key={student.id} value={index}>{student.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Assessment</label>
                                            <select
                                                value={selectedAssessmentId}
                                                onChange={(e) => setSelectedAssessmentId(Number(e.target.value))}
                                                className={selectStyles}
                                            >
                                                {assessments.map(assessment => (
                                                    <option key={assessment.id} value={assessment.id}>
                                                        {assessment.name} ({assessment.name.toLowerCase().includes('exam') ? 100 : assessment.weight}%)
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Score</label>
                                        <div className="flex flex-col">
                                            <input
                                                type="text"
                                                value={getMobileCurrentScore()}
                                                onChange={(e) => handleMobileScoreUpdate(e.target.value)}
                                                placeholder={getPlaceholder()}
                                                className="w-full p-3 text-center text-2xl font-mono bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                            />
                                            {mobileScoreError && <p className="text-red-500 text-sm mt-1">{mobileScoreError}</p>}
                                        </div>
                                    </div>

                                    <div className="flex justify-between pt-2">
                                        <button
                                            onClick={handlePrevStudent}
                                            disabled={selectedStudentIndex === 0}
                                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                            Previous
                                        </button>
                                        <button
                                            onClick={handleNextStudent}
                                            disabled={selectedStudentIndex === filteredStudents.length - 1}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                                        >
                                            Next
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-4 text-gray-500">
                                    No students in the selected class.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {totalWeight !== 100 && (
                <div className="p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 rounded-md">
                    <p className="font-bold">Warning</p>
                    <p>The sum of weights for all assessments is {totalWeight}%, not 100%. Please review assessment types in settings.</p>
                </div>
            )}

            {/* Desktop View: Grid Table */}
            <div className={`bg-white rounded-xl shadow-md border border-gray-200 ${useMobileView ? 'hidden lg:block' : 'block'}`}>
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