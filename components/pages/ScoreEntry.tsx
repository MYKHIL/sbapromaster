import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useData } from '../../context/DataContext';
import { useUser } from '../../context/UserContext';
import ReadOnlyWrapper from '../ReadOnlyWrapper';
import InlineScoreInput from '../InlineScoreInput';
import ScoreManagementModal from '../ScoreManagementModal';
import PreviewDataModal from '../PreviewDataModal';
import { NetworkIndicator } from '../NetworkIndicator';
import type { Student, Assessment } from '../../types';

import { getAvailableClasses, getSubjectsForUserAndClass } from '../../utils/permissions';

const ScoreEntry: React.FC = () => {
    // Destructure with default empty arrays to prevent undefined errors
    const { students = [], subjects: allSubjects = [], assessments = [], classes: allClasses = [], getStudentScores, updateStudentScores, isOnline, isSyncing, queuedCount, hasLocalChanges, setHasLocalChanges, timeToSync, isDirty, updateDraftScore, removeDraftScore, getComputedScore, draftVersion, scores, saveToCloud, refreshFromCloud, pendingCount, getPendingUploadData } = useData();
    const { currentUser } = useUser();
    const isReadOnly = currentUser?.role === 'Guest';

    // Debug Modal State
    const [isDebugModalOpen, setIsDebugModalOpen] = useState(false);
    const [debugData, setDebugData] = useState<any>(null);

    const handleShowDebugData = () => {
        const data = getPendingUploadData();
        setDebugData(data);
        setIsDebugModalOpen(true);
    };

    const handleCloseDebugModal = () => {
        setIsDebugModalOpen(false);
        setDebugData(null);
    };

    const MobileControls = ({ className = "" }: { className?: string }) => (
        <div className="flex flex-col items-end">
            <div className={`flex items-center gap-2 ${className}`}>
                {/* Preview Button */}
                {pendingCount > 0 && (
                    <button
                        onClick={handleShowDebugData}
                        className="p-1.5 text-gray-500 hover:text-blue-600 bg-gray-100 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200"
                        title="Preview changes"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                    </button>
                )}

                {/* Refresh Button */}
                <button
                    onClick={() => refreshFromCloud()}
                    disabled={isSyncing || !isOnline}
                    className={`p-1.5 text-gray-500 hover:text-green-600 bg-gray-100 hover:bg-green-50 rounded-lg transition-colors border border-gray-200 ${(isSyncing || !isOnline) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title="Refresh"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>

                {/* Save Button */}
                <button
                    onClick={() => saveToCloud(true)}
                    disabled={pendingCount === 0 || isSyncing || !isOnline}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all shadow-sm ${(pendingCount === 0 || isSyncing || !isOnline)
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                    title="Save"
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
                            <span className="text-sm font-bold">Save {pendingCount > 0 ? `(${pendingCount})` : ''}</span>
                        </>
                    )}
                </button>
            </div>
            {pendingCount > 0 && (
                <div className="text-[10px] font-bold text-amber-600 text-right mt-1 px-1 leading-tight max-w-[250px] animate-pulse">
                    Please SAVE when you complete all modifications
                </div>
            )}
        </div>
    );

    // Filter available data based on permissions
    const classes = useMemo(() => getAvailableClasses(currentUser, allClasses), [currentUser, allClasses]);

    // Safe initialization for selectedClass (must be before subjects useMemo)
    const [selectedClass, setSelectedClass] = useState<string>(() => {
        try {
            const saved = localStorage.getItem('scoreEntry_selectedClass');
            if (saved && allClasses.find(c => c.name === saved)) return saved;
            return allClasses.length > 0 ? allClasses[0].name : '';
        } catch (e) {
            return '';
        }
    });

    // Filter subjects based on selected class (per-class mapping)
    const subjects = useMemo(() => {
        if (!selectedClass) return allSubjects; // Show all when "All Classes" selected
        return getSubjectsForUserAndClass(currentUser, selectedClass, allSubjects);
    }, [currentUser, selectedClass, allSubjects]);

    // Safe initialization for selectedSubjectId
    const [selectedSubjectId, setSelectedSubjectId] = useState<number>(() => {
        try {
            const saved = localStorage.getItem('scoreEntry_selectedSubjectId');
            if (saved && subjects.find(s => s.id === Number(saved))) return Number(saved);
            return subjects.length > 0 ? subjects[0].id : 0;
        } catch (e) {
            return 0;
        }
    });

    // Mobile View State
    // PERSISTENCE: Initialize from localStorage
    const [selectedStudentIndex, setSelectedStudentIndex] = useState(() => {
        try {
            const saved = localStorage.getItem('scoreEntry_selectedStudentIndex');
            return saved ? Number(saved) : 0;
        } catch (e) {
            return 0;
        }
    });

    // PERSISTENCE: Save on change
    useEffect(() => {
        localStorage.setItem('scoreEntry_selectedStudentIndex', String(selectedStudentIndex));
    }, [selectedStudentIndex]);

    // Safe initialization for selectedAssessmentId
    const [selectedAssessmentId, setSelectedAssessmentId] = useState<number>(() => {
        try {
            const saved = localStorage.getItem('scoreEntry_selectedAssessmentId');
            if (saved) return Number(saved);
            return assessments.length > 0 ? assessments[0].id : 0;
        } catch (e) {
            return assessments.length > 0 ? assessments[0].id : 0;
        }
    });

    // PERSISTENCE: Save assessment selection on change
    useEffect(() => {
        if (selectedAssessmentId) {
            localStorage.setItem('scoreEntry_selectedAssessmentId', String(selectedAssessmentId));
        }
    }, [selectedAssessmentId]);

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
        if (!selectedClass) {
            // If "All Classes" is selected, filter by user permissions
            if (currentUser?.role === 'Admin') return students;
            if (currentUser?.allowedClasses) {
                return students.filter(student => currentUser.allowedClasses.includes(student.class));
            }
            return []; // Should not happen if permissions are correct
        }
        return students.filter(student => student.class === selectedClass);
    }, [students, selectedClass, currentUser]);

    // Reset student index if it goes out of bounds (e.g. class change)
    useEffect(() => {
        if (selectedStudentIndex >= filteredStudents.length && filteredStudents.length > 0) {
            setSelectedStudentIndex(0);
        }
    }, [filteredStudents.length, selectedStudentIndex]);

    const unfilledCount = useMemo(() => {
        if (!filteredStudents || !selectedSubjectId || !selectedAssessmentId) return 0;
        return filteredStudents.filter(s => {
            const scores = getStudentScores(s.id, selectedSubjectId, selectedAssessmentId);
            return !scores || scores.length === 0 || scores[0] === '';
        }).length;
    }, [filteredStudents, selectedSubjectId, selectedAssessmentId, getStudentScores]);


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

    const scoreInputRef = useRef<HTMLInputElement>(null);

    // Auto-focus score input when student changes in mobile view
    useEffect(() => {
        if (useMobileView && scoreInputRef.current) {
            scoreInputRef.current.focus();
        }
    }, [selectedStudentIndex, useMobileView]);

    // BUFFERED INPUT LOGIC
    const [localScore, setLocalScore] = useState('');
    const [scoreModified, setScoreModified] = useState(false); // Track if user has modified the score

    // Sync local score when student/assessment changes OR when scores in DataContext change
    useEffect(() => {
        const student = filteredStudents[selectedStudentIndex];
        if (student) {
            // Get computed score (draft > saved)
            const score = getComputedScore(student.id, selectedAssessmentId, selectedSubjectId);
            setLocalScore(score);

            // Check if modified from SAVED
            const saved = getStudentScores(student.id, selectedSubjectId, selectedAssessmentId)[0] || '';
            const isDraftDifferent = score !== saved;
            setScoreModified(isDraftDifferent);
        } else {
            setLocalScore('');
            setScoreModified(false);
        }
    }, [selectedStudentIndex, selectedSubjectId, selectedAssessmentId, filteredStudents, draftVersion, scores]); // Listen to scores and draftVersion for sync






    const commitScore = () => {
        const student = filteredStudents[selectedStudentIndex];
        if (!student) return;

        const assessment = assessments.find(a => a.id === selectedAssessmentId);
        if (!assessment) return;

        console.log('[ScoreEntry - Mobile] commitScore called:', {
            studentId: student.id,
            studentName: student.name,
            subjectId: selectedSubjectId,
            assessmentId: assessment.id,
            assessmentName: assessment.name,
            rawInput: localScore
        });

        const rawScoreInput = localScore.trim();
        const isExam = assessment.name.toLowerCase().includes('exam');
        const maxScore = isExam ? 100 : assessment.weight;
        const basis = isExam ? 100 : assessment.weight;

        setMobileScoreError('');

        if (!rawScoreInput) {
            console.log('[ScoreEntry - Mobile] Empty score - clearing:', {
                studentId: student.id,
                studentName: student.name
            });
            updateStudentScores(student.id, selectedSubjectId, assessment.id, []);
            setScoreModified(false); // Clear modification flag
            return;
        }

        let convertedScore: number;
        if (rawScoreInput.includes('/')) {
            const parts = rawScoreInput.split('/');
            if (parts.length !== 2) {
                console.log('[ScoreEntry - Mobile] Validation error: Invalid fraction format');
                setMobileScoreError("Use 'x' or 'x/y'");
                return;
            }
            const [x, y] = parts.map(Number);
            if (isNaN(x) || isNaN(y)) {
                console.log('[ScoreEntry - Mobile] Validation error: Non-numeric values in fraction');
                setMobileScoreError("Numbers only");
                return;
            }
            if (y === 0) {
                console.log('[ScoreEntry - Mobile] Validation error: Division by zero');
                setMobileScoreError("Base cannot be 0");
                return;
            }
            convertedScore = (x / y) * maxScore;
            console.log('[ScoreEntry - Mobile] Fraction conversion:', { x, y, maxScore, convertedScore });
        } else {
            const z = Number(rawScoreInput);
            if (isNaN(z)) {
                console.log('[ScoreEntry - Mobile] Validation error: Not a number');
                setMobileScoreError("Score must be a number");
                return;
            }
            convertedScore = z;
            console.log('[ScoreEntry - Mobile] Direct score:', { rawInput: z, convertedScore });
        }

        if (convertedScore > maxScore) {
            console.log('[ScoreEntry - Mobile] Validation error: Exceeds max score', { convertedScore, maxScore });
            setMobileScoreError(`Max is ${maxScore}`);
            return;
        }
        if (convertedScore < 0) {
            console.log('[ScoreEntry - Mobile] Validation error: Negative score');
            setMobileScoreError("Cannot be negative");
            return;
        }

        const finalScore = `${Number(convertedScore.toFixed(1))}/${basis}`;
        console.log('[ScoreEntry - Mobile] ✅ Score validated and formatted:', {
            studentId: student.id,
            studentName: student.name,
            subjectId: selectedSubjectId,
            assessmentId: assessment.id,
            assessmentName: assessment.name,
            rawInput: rawScoreInput,
            convertedScore,
            finalScore
        });

        console.log('[ScoreEntry - Mobile] 💾 Calling updateStudentScores (saving to local cache)...');
        updateStudentScores(student.id, selectedSubjectId, assessment.id, [finalScore]);

        // Update local score to formatted version and clear modification flag
        setLocalScore(finalScore);
        setScoreModified(false);

        // Unregister pending change / remove from draft
        removeDraftScore(student.id, assessment.id);

        console.log('[ScoreEntry - Mobile] ✅ Score committed successfully');
    };

    const getPlaceholder = () => {
        const assessment = assessments.find(a => a.id === selectedAssessmentId);
        if (!assessment) return '-';
        return assessment.name.toLowerCase().includes('exam') ? 'e.g., 85' : '-';
    };

    // ... (Modal logic remains same)
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
        <ReadOnlyWrapper allowedRoles={['Admin', 'Teacher']}>
            <div className="space-y-6 pt-14">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold text-gray-800">Score Entry</h1>

                    {/* Save Button - Desktop View (Moved to GlobalActionBar) */}
                </div>

                <div className="bg-gray-100 py-4 sticky top-20 lg:top-0 z-20 shadow-md transition-all duration-300">
                    <div className="flex flex-col gap-4 p-4 bg-white rounded-xl shadow-md border border-gray-200">

                        {/* Mobile View Toggle - Top */}
                        <div className="lg:hidden flex items-center justify-between pb-2 border-b border-gray-100 mb-2">
                            <label className="flex items-center space-x-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={useMobileView}
                                    onChange={(e) => setUseMobileView(e.target.checked)}
                                    className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                                />
                                <span className="text-sm font-bold text-gray-700">Compact View</span>
                            </label>
                            {!useMobileView && <MobileControls />}
                        </div>

                        {/* Save Button for Mobile Table View (!Compact) (Moved to GlobalActionBar) */}

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
                                                <div className="flex justify-between items-center mb-1">
                                                    <label className="block text-sm font-medium text-gray-700">Assessment</label>
                                                    {unfilledCount > 0 ? (
                                                        <button
                                                            onClick={() => {
                                                                // Find the first unscored student
                                                                const firstUnscoredIndex = filteredStudents.findIndex(s => {
                                                                    const scores = getStudentScores(s.id, selectedSubjectId, selectedAssessmentId);
                                                                    return !scores || scores.length === 0 || scores[0] === '';
                                                                });
                                                                if (firstUnscoredIndex !== -1) {
                                                                    setSelectedStudentIndex(firstUnscoredIndex);
                                                                    setMobileScoreError('');
                                                                }
                                                            }}
                                                            className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700 hover:bg-red-200 hover:text-red-800 transition-colors cursor-pointer"
                                                        >
                                                            {unfilledCount} unscored • Tap to jump
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
                                                            All students scored
                                                        </span>
                                                    )}
                                                </div>
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
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="block text-sm font-medium text-gray-700">Score</label>
                                                <MobileControls />
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="relative">
                                                    <input
                                                        ref={scoreInputRef}
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={localScore}
                                                        onChange={(e) => {
                                                            // Only allow numbers, forward slash (/), and dot (.)
                                                            const filtered = e.target.value.replace(/[^0-9/.]/g, '');
                                                            console.log('[ScoreEntry - Mobile] User input:', {
                                                                studentId: filteredStudents[selectedStudentIndex]?.id,
                                                                studentName: filteredStudents[selectedStudentIndex]?.name,
                                                                subjectId: selectedSubjectId,
                                                                assessmentId: selectedAssessmentId,
                                                                rawInput: e.target.value,
                                                                filteredInput: filtered,
                                                                previousValue: localScore
                                                            });
                                                            setLocalScore(filtered);
                                                            setScoreModified(true);

                                                            // Update global draft
                                                            const student = filteredStudents[selectedStudentIndex];
                                                            if (student) {
                                                                updateDraftScore(student.id, selectedAssessmentId, filtered);
                                                            }
                                                        }}
                                                        onBlur={commitScore}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                commitScore();
                                                                e.currentTarget.blur();
                                                            }
                                                        }}
                                                        placeholder={getPlaceholder()}
                                                        className={`w-full p-3 text-center text-2xl font-mono bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${isReadOnly ? 'cursor-not-allowed text-gray-500' : ''}`}
                                                        readOnly={isReadOnly}
                                                    />
                                                    {localScore && !isReadOnly && (
                                                        <button
                                                            onClick={() => {
                                                                // 1. Update UI immediately
                                                                setLocalScore('');
                                                                setScoreModified(true);

                                                                // 2. FORCE COMMIT the empty value to global state
                                                                // commitScore() skips empty strings, so we must manually trigger the update here.
                                                                const student = filteredStudents[selectedStudentIndex];
                                                                if (student) {
                                                                    console.log('[ScoreEntry] 🧹 Clearing score for:', student.name);
                                                                    // Send [''] to signify cleared/empty. DataContext treats this as a change against []
                                                                    updateStudentScores(student.id, selectedSubjectId, selectedAssessmentId, ['']);

                                                                    // 3. Clean up draft state (since we just committed)
                                                                    removeDraftScore(student.id, selectedAssessmentId);
                                                                }

                                                                scoreInputRef.current?.focus();
                                                            }}
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-red-500 transition-colors"
                                                            title="Clear score"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
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
                </div >

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
                                    <th className="p-4 font-semibold text-gray-600 w-12 text-center">#</th>
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
                                    filteredStudents.map((student, index) => (
                                        <InlineScoreInput
                                            key={student.id}
                                            index={index + 1}
                                            student={student}
                                            subjectId={selectedSubjectId}
                                            assessments={assessments}
                                            onOpenModal={handleOpenModal}
                                            readOnly={isReadOnly}
                                        />
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={assessments.length + 3} className="text-center p-8 text-gray-500">
                                            No students in the selected class.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {
                    isModalOpen && modalData && (
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
                    )
                }

            </div >

            <PreviewDataModal
                isOpen={isDebugModalOpen}
                onClose={handleCloseDebugModal}
                debugData={debugData}
                pendingCount={pendingCount}
                onSave={() => saveToCloud(true)}
                isSyncing={isSyncing}
                isOnline={isOnline}
                hasLocalChanges={hasLocalChanges}
            />

        </ReadOnlyWrapper >
    );
};

export default ScoreEntry;