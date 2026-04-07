import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useData } from '../../context/DataContext';
import { DIRTY_INDICATOR_BG, DIRTY_INDICATOR_TEXT, DIRTY_INDICATOR_SECONDARY_TEXT, DIRTY_INDICATOR_HOVER_BG, DIRTY_INDICATOR_BORDER } from '../../constants';
import { useUser } from '../../context/UserContext';
import ReadOnlyWrapper from '../ReadOnlyWrapper';
import InlineScoreInput from '../InlineScoreInput';
import ScoreManagementModal from '../ScoreManagementModal';
import PreviewDataModal from '../PreviewDataModal';
import { NetworkIndicator } from '../NetworkIndicator';
import type { Student, Assessment } from '../../types';

import { getAvailableClasses, getSubjectsForUserAndClass } from '../../utils/permissions';
import { sortClassesByName } from '../../utils/classSort';

const ScoreEntry: React.FC = () => {
    // Destructure with default empty arrays to prevent undefined errors
    const { students = [], subjects: allSubjects = [], assessments = [], classes: allClasses = [], getStudentScores, updateStudentScores, isOnline, isSyncing, isFetching, queuedCount, hasLocalChanges, setHasLocalChanges, isDirty, updateDraftScore, removeDraftScore, getComputedScore, draftVersion, scores, saveToCloud, refreshFromCloud, pendingCount, getPendingUploadData, loadScores, isDraftScore, isScoreDirty, refreshVersion } = useData();
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

    const MobileControls = ({ className = "", compact = false }: { className?: string, compact?: boolean }) => (
        <div className="flex flex-col items-end">
            <div className={`flex items-center ${compact ? 'gap-1' : 'gap-2'} ${className}`}>
                {/* Refresh Button */}
                <button
                    onClick={() => refreshFromCloud()}
                    disabled={isSyncing || isFetching || !isOnline}
                    className={`${compact ? 'p-1' : 'p-1.5'} text-gray-500 hover:text-green-600 bg-gray-100 hover:bg-green-50 rounded-lg transition-colors border border-gray-200 ${(isSyncing || isFetching || !isOnline) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title="Refresh"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} ${(isSyncing || isFetching) ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>

                {/* Preview Button */}
                {pendingCount > 0 && (
                    <button
                        onClick={handleShowDebugData}
                        className={`${compact ? 'p-1' : 'p-1.5'} text-gray-500 hover:text-blue-600 bg-gray-100 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200`}
                        title="Preview changes"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className={`${compact ? 'h-4 w-4' : 'h-5 w-5'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                    </button>
                )}

                {/* Save Button */}
                <button
                    onClick={() => saveToCloud(true)}
                    disabled={pendingCount === 0 || isSyncing || isFetching || !isOnline}
                    className={`flex items-center ${compact ? 'gap-1 px-2 py-1' : 'gap-2 px-3 py-1.5'} rounded-lg transition-all shadow-sm ${(pendingCount === 0 || isSyncing || isFetching || !isOnline)
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                    title="Save"
                >
                    {isSyncing ? (
                        <>
                            <svg className={`animate-spin ${compact ? 'h-4 w-4' : 'h-5 w-5'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className={`${compact ? 'text-[10px]' : 'text-sm'} font-bold`}>{isFetching ? 'Fetching...' : 'Saving...'}</span>
                        </>
                    ) : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`${compact ? 'h-4 w-4' : 'h-5 w-5'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                            </svg>
                            <span className={`${compact ? 'text-[10px]' : 'text-sm'} font-bold`}>Save {pendingCount > 0 ? `(${pendingCount})` : ''}</span>
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
    const classes = useMemo(() => {
        const available = getAvailableClasses(currentUser, allClasses);
        // De-duplicate by class name to prevent redundant entries in the dropdown
        const unique = available.filter((cls, index, self) =>
            index === self.findIndex((t) => (t.name || '').trim() === (cls.name || '').trim())
        );
        return sortClassesByName(unique);
    }, [currentUser, allClasses]);

    // Safe initialization for selectedClass (must be before subjects useMemo)
    const [selectedClass, setSelectedClass] = useState<string>(() => {
        try {
            const saved = localStorage.getItem('scoreEntry_selectedClass');
            return saved !== null ? saved : ''; // Initialize directly from localStorage, delay validation
        } catch (e) {
            return '';
        }
    });

    // Validation Effect: If currentUser or allClasses changes, ensure current selection is still valid
    useEffect(() => {
        // Prevent aggressive overwrite during initial hydration when allClasses hasn't loaded
        if (allClasses.length === 0) return;

        // Allow empty string for Admins ("All Classes" mode) - it is a valid selection
        if (selectedClass === '' && currentUser?.role === 'Admin') return;
        
        const availableNames = getAvailableClasses(currentUser, allClasses).map(c => c.name);
        
        if (selectedClass && !availableNames.includes(selectedClass)) {
            const fallback = availableNames.length > 0 ? availableNames[0] : '';
            setSelectedClass(fallback);
            if (fallback) localStorage.setItem('scoreEntry_selectedClass', fallback);
            else localStorage.removeItem('scoreEntry_selectedClass');
        } else if (!selectedClass && availableNames.length > 0 && currentUser?.role !== 'Admin') {
            const fallback = availableNames[0];
            setSelectedClass(fallback);
            localStorage.setItem('scoreEntry_selectedClass', fallback);
        }
    }, [currentUser, allClasses, selectedClass]);

    // Filter subjects based on selected class (per-class mapping)
    const subjects = useMemo(() => {
        if (!selectedClass) return allSubjects; // Show all when "All Classes" selected
        return getSubjectsForUserAndClass(currentUser, selectedClass, allSubjects);
    }, [currentUser, selectedClass, allSubjects]);

    // Safe initialization for selectedSubjectId
    const [selectedSubjectId, setSelectedSubjectId] = useState<number>(() => {
        try {
            const saved = localStorage.getItem('scoreEntry_selectedSubjectId');
            return saved ? Number(saved) : 0; // Initialize directly from localStorage
        } catch (e) {
            return 0;
        }
    });

    // Validation for Subject
    useEffect(() => {
        if (subjects.length === 0) return; // Wait for hydration
        if (selectedSubjectId) {
            const isValid = subjects.some(s => s.id === selectedSubjectId);
            if (!isValid) {
                const fallback = subjects[0].id;
                setSelectedSubjectId(fallback);
                localStorage.setItem('scoreEntry_selectedSubjectId', String(fallback));
            }
        } else if (!selectedSubjectId && subjects.length > 0) {
            setSelectedSubjectId(subjects[0].id);
            localStorage.setItem('scoreEntry_selectedSubjectId', String(subjects[0].id));
        }
    }, [subjects, selectedSubjectId]);

    // Lazy Load Scores when Class or Subject changes
    useEffect(() => {
        if (selectedSubjectId) {
            if (selectedClass) {
                const cls = allClasses.find(c => c.name === selectedClass);
                if (cls) {
                    loadScores(cls.id, selectedSubjectId);
                }
            } else if (currentUser?.role === 'Admin') {
                // For Admins, load all scores for the subject across all classes
                loadScores(undefined, selectedSubjectId);
            }
        }
    }, [selectedClass, selectedSubjectId, allClasses, loadScores, currentUser?.role]);

    // Mobile View State
    const filteredStudents = useMemo(() => {
        if (!students) return [];

        // FAIL-SAFE: If a class is selected, ensure the selectedSubjectId is valid for that class
        // This prevents the 'mismatch window' during transitions from showing or saving data.
        if (selectedClass && selectedSubjectId && currentUser?.role !== 'Admin') {
            const isValid = subjects.some(s => s.id === selectedSubjectId);
            if (!isValid) {
                console.warn(`[ScoreEntry] 🛡️ Fail-safe triggered: Subject ${selectedSubjectId} not valid for class ${selectedClass}.`);
                return [];
            }
        }

        let results = [...students];

        // Apply standardized sort: Gender (Desc) -> Name (Asc)
        results.sort((a, b) => {
            if (a.gender !== b.gender) {
                return b.gender.localeCompare(a.gender);
            }
            return a.name.localeCompare(b.name);
        });

        // If no class selected:
        if (!selectedClass) {
            // Admins see all students (All Classes mode)
            if (currentUser?.role === 'Admin') return results;
            // Others see nothing until they select a class
            return [];
        }

        return results.filter(student => student.class === selectedClass);
    }, [students, selectedClass, currentUser, selectedSubjectId, subjects]);

    // PERSISTENCE: Initialize from localStorage via Student ID
    const [persistedStudentId, setPersistedStudentId] = useState<number | null>(() => {
        try {
            const saved = localStorage.getItem('scoreEntry_persistedStudentId');
            return saved ? Number(saved) : null;
        } catch (e) {
            return null;
        }
    });

    const selectedStudentIndex = useMemo(() => {
        if (filteredStudents.length === 0) return 0;
        if (persistedStudentId !== null) {
            const index = filteredStudents.findIndex(s => s.id === persistedStudentId);
            return index !== -1 ? index : 0;
        }
        return 0;
    }, [filteredStudents, persistedStudentId]);

    const handleStudentIndexChange = (newIndex: number) => {
        if (filteredStudents[newIndex]) {
            const newId = filteredStudents[newIndex].id;
            setPersistedStudentId(newId);
            localStorage.setItem('scoreEntry_persistedStudentId', String(newId));
        }
    };


    // Safe initialization for selectedAssessmentId
    const [selectedAssessmentId, setSelectedAssessmentId] = useState<number>(() => {
        try {
            const saved = localStorage.getItem('scoreEntry_selectedAssessmentId');
            return saved ? Number(saved) : 0; // Initialize directly
        } catch (e) {
            return 0;
        }
    });

    // Validation for Assessment
    useEffect(() => {
        if (assessments.length === 0) return;
        if (selectedAssessmentId) {
            const isValid = assessments.some(a => a.id === selectedAssessmentId);
            if (!isValid) {
                const fallback = assessments[0].id;
                setSelectedAssessmentId(fallback);
                localStorage.setItem('scoreEntry_selectedAssessmentId', String(fallback));
            }
        } else if (!selectedAssessmentId && assessments.length > 0) {
            setSelectedAssessmentId(assessments[0].id);
            localStorage.setItem('scoreEntry_selectedAssessmentId', String(assessments[0].id));
        }
    }, [assessments, selectedAssessmentId]);

    const sortedAssessments = useMemo(() => {
        return [...assessments].sort((a, b) => {
            const isAExam = a.name.toLowerCase().includes('exam');
            const isBExam = b.name.toLowerCase().includes('exam');
            if (isAExam && !isBExam) return 1;
            if (!isAExam && isBExam) return -1;
            return 0;
        });
    }, [assessments]);

    // PERSISTENCE: Save assessment selection on change
    useEffect(() => {
        if (selectedAssessmentId) {
            localStorage.setItem('scoreEntry_selectedAssessmentId', String(selectedAssessmentId));
        }
    }, [selectedAssessmentId]);

    const [mobileScoreError, setMobileScoreError] = useState<string>('');
    const [useMobileView, setUseMobileView] = useState(() => {
        try {
            const saved = localStorage.getItem('scoreEntry_compactView');
            // Default to true (compact) if not set
            return saved !== null ? saved === 'true' : true;
        } catch (e) {
            return true;
        }
    });

    useEffect(() => {
        localStorage.setItem('scoreEntry_compactView', String(useMobileView));
    }, [useMobileView]);

    // Ensure selectedAssessmentId is valid when assessments change
    useEffect(() => {
        if (assessments.length > 0) {
            const exists = assessments.find(a => a.id === selectedAssessmentId);
            if (!exists) {
                setSelectedAssessmentId(assessments[0].id);
            }
        }
    }, [assessments, selectedAssessmentId]);



    // Reset student selection if filtering changes and causes out of bounds (handled by useMemo, but we can clean up any errors here if needed)

    const unfilledCount = useMemo(() => {
        if (!filteredStudents || !selectedSubjectId || !selectedAssessmentId) return 0;
        return filteredStudents.filter(s => {
            const scores = getStudentScores(s.id, selectedSubjectId, selectedAssessmentId);
            return !scores || scores.length === 0 || scores[0] === '';
        }).length;
    }, [filteredStudents, selectedSubjectId, selectedAssessmentId, getStudentScores, refreshVersion]);

    // NEW: Calculate rankings for all students in the filtered list
    // This allows us to display ranks even in non-compact mode
    const allStudentsRankings = useMemo(() => {
        if (!filteredStudents.length || !selectedSubjectId || !assessments.length) return {};

        const studentStats = filteredStudents.map(student => {
            const total = assessments.reduce((acc, assessment) => {
                const scores = getStudentScores(student.id, selectedSubjectId, assessment.id);
                // We use calculateDisplayScore from InlineScoreInput if we wanted to be identical,
                // but for ranking we just need the weighted sum.
                if (!scores || !scores[0]) return acc;
                const scoreStr = (scores[0] || '').toString();
                if (!scoreStr.includes('/')) return acc;
                const [numerator, denominator] = scoreStr.split('/').map(Number);
                const weight = assessment.weight;

                if (assessment.name.toLowerCase().includes('exam')) {
                    // Exams are out of 100
                    return acc + (numerator / 100 * weight);
                } else {
                    // Classwork are out of weight
                    return acc + (numerator / (denominator || weight) * weight);
                }
            }, 0);

            return { id: student.id, total };
        });

        // Filter out zero-score students if desired, or keep them
        const sorted = [...studentStats].sort((a, b) => b.total - a.total);

        const rankings: Record<string, { total: string, rank: string, rawRank: number }> = {};
        sorted.forEach((stat, i) => {
            const rank = i + 1;
            let suffix = 'th';
            if (rank % 10 === 1 && rank % 100 !== 11) suffix = 'st';
            else if (rank % 10 === 2 && rank % 100 !== 12) suffix = 'nd';
            else if (rank % 10 === 3 && rank % 100 !== 13) suffix = 'rd';

            rankings[stat.id] = {
                total: (stat.total).toFixed(1).replace(/\.0$/, ''),
                rank: `${rank}${suffix}`,
                rawRank: rank
            };
        });

        return rankings;
    }, [filteredStudents, assessments, selectedSubjectId, getStudentScores, refreshVersion, scores]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalData, setModalData] = useState<{ student: Student, assessment: Assessment, isExam: boolean } | null>(null);

    const handleOpenModal = (student: Student, assessment: Assessment) => {
        setModalData({
            student,
            assessment,
            isExam: assessment.name.toLowerCase().includes('exam')
        });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setModalData(null);
    };

    const handleScoreChange = (studentId: number, assessmentId: number, index: number, value: string) => {
        if (!selectedSubjectId) {
            console.warn('[ScoreEntry] Blocked score change: No subject selected.');
            return;
        }
        const currentScores = [...(getStudentScores(studentId, selectedSubjectId, assessmentId) || [])];
        currentScores[index] = value;
        updateStudentScores(studentId, selectedSubjectId, assessmentId, currentScores);
    };

    const handleAddScore = (score: string) => {
        if (!modalData) return;
        const currentScores = getStudentScores(modalData.student.id, selectedSubjectId, modalData.assessment.id);
        updateStudentScores(modalData.student.id, selectedSubjectId, modalData.assessment.id, [...currentScores, score]);
    };

    const handleDeleteScore = (index: number) => {
        if (!modalData) return;
        const currentScores = getStudentScores(modalData.student.id, selectedSubjectId, modalData.assessment.id);
        const newScores = [...currentScores];
        newScores.splice(index, 1);
        updateStudentScores(modalData.student.id, selectedSubjectId, modalData.assessment.id, newScores);
    };

    const handleUpdateScore = (index: number, score: string) => {
        if (!modalData) return;
        const currentScores = getStudentScores(modalData.student.id, selectedSubjectId, modalData.assessment.id);
        const newScores = [...currentScores];
        newScores[index] = score;
        updateStudentScores(modalData.student.id, selectedSubjectId, modalData.assessment.id, newScores);
    };

    const totalWeight = useMemo(() => {
        return assessments.reduce((sum, a) => sum + a.weight, 0);
    }, [assessments]);

    const scoreInputRef = useRef<HTMLInputElement>(null);
    const [localScore, setLocalScore] = useState('');
    const [scoreModified, setScoreModified] = useState(false);
    const mobileDebounceTimer = useRef<NodeJS.Timeout | null>(null);

    // Clear error only when student, subject, or assessment changes
    useEffect(() => {
        setMobileScoreError('');
    }, [selectedStudentIndex, selectedSubjectId, selectedAssessmentId]);

    // Update local score when student or assessment changes
    useEffect(() => {
        const student = filteredStudents[selectedStudentIndex];
        if (student && selectedSubjectId && selectedAssessmentId) {
            const val = getComputedScore(student.id, selectedSubjectId, selectedAssessmentId);
            
            // CRITICAL: If the user is currently typing/modified, DO NOT sync from context
            // to prevent clearing typed data.
            if (scoreModified) return;

            if (localScore !== val) {
                setLocalScore(val);
                setScoreModified(false);
            }
        }
    }, [selectedStudentIndex, selectedSubjectId, selectedAssessmentId, filteredStudents, draftVersion, scores, getComputedScore]); // Removed localScore and scoreModified from deps to prevent re-triggering during typing

    const commitScore = () => {
        // Clear any pending debounce
        if (mobileDebounceTimer.current) {
            clearTimeout(mobileDebounceTimer.current);
            mobileDebounceTimer.current = null;
        }

        if (!scoreModified) return;
        const student = filteredStudents[selectedStudentIndex];
        if (!student) return;

        // Validation logic similar to InlineScoreInput
        const rawScoreInput = localScore.trim();
        const assessment = assessments.find(a => a.id === selectedAssessmentId);
        if (!assessment) return;

        const isExam = assessment.name.toLowerCase().includes('exam');
        const maxScore = isExam ? 100 : assessment.weight;
        const basis = isExam ? 100 : assessment.weight;

        if (!rawScoreInput) {
            // Send [''] to signify cleared/empty. DataContext treats this as a change against []
            updateStudentScores(student.id, selectedSubjectId, assessment.id, ['']);
            removeDraftScore(student.id, selectedSubjectId, assessment.id);
            setScoreModified(false);
            setMobileScoreError('');
            return;
        }

        let convertedScore: number;
        if (rawScoreInput.includes('/')) {
            const parts = rawScoreInput.split('/');
            if (parts.length !== 2) {
                setMobileScoreError("Use 'x' or 'x/y'");
                removeDraftScore(student.id, selectedSubjectId, assessment.id);
                return;
            }
            const [x, y] = parts.map(Number);
            if (isNaN(x) || isNaN(y) || y === 0) {
                setMobileScoreError("Invalid fraction");
                removeDraftScore(student.id, selectedSubjectId, assessment.id);
                return;
            }
            convertedScore = (x / y) * maxScore;
        } else {
            const z = Number(rawScoreInput);
            if (isNaN(z)) {
                setMobileScoreError("Numbers only");
                removeDraftScore(student.id, selectedSubjectId, assessment.id);
                return;
            }
            convertedScore = z;
        }

        if (convertedScore / basis > 1 || convertedScore < 0) {
            setMobileScoreError(`Score cannot exceed assessment weight (max 100%)`);
            setLocalScore(''); // Clear input on error as requested
            setScoreModified(false);
            removeDraftScore(student.id, selectedSubjectId, assessment.id);
            return;
        }

        const finalScore = `${Number(convertedScore.toFixed(1))}/${basis}`;
        updateStudentScores(student.id, selectedSubjectId, assessment.id, [finalScore]);
        removeDraftScore(student.id, selectedSubjectId, assessment.id);
        setScoreModified(false);
        setMobileScoreError('');
    };

    const getPlaceholder = () => {
        const assessment = assessments.find(a => a.id === selectedAssessmentId);
        if (!assessment) return '-';
        return assessment.name.toLowerCase().includes('exam') ? 'Exam Score (out of 100)' : `Score (out of ${assessment.weight})`;
    };

    const projectedStats = useMemo(() => {
        const currentStudent = filteredStudents[selectedStudentIndex];
        if (!currentStudent || !selectedSubjectId) return null;

        // If score modified, we calculate a local "Total" preview
        if (scoreModified) {
            const baseline = allStudentsRankings[currentStudent.id] || { total: '0', rank: '-', rawRank: 0 };
            
            // Re-calculate total with the localScore
            let displayTotal = 0;
            assessments.forEach(assessment => {
                let scoreStr = '';
                if (assessment.id === selectedAssessmentId) {
                    scoreStr = localScore;
                } else {
                    const scores = getStudentScores(currentStudent.id, selectedSubjectId, assessment.id);
                    scoreStr = scores[0] || '';
                }

                if (!scoreStr) return;
                
                const scoreText = (scoreStr || '').toString();
                if (!scoreText.includes('/')) return;
                const [num, den] = scoreText.split('/').map(Number);
                const weight = assessment.weight;
                if (assessment.name.toLowerCase().includes('exam')) {
                    displayTotal += (num / 100 * weight);
                } else {
                    displayTotal += (num / (den || weight) * weight);
                }
            });
            
            return {
                ...baseline,
                total: displayTotal.toFixed(1).replace(/\.0$/, '')
            };
        }

        return allStudentsRankings[currentStudent.id] || null;
    }, [allStudentsRankings, selectedStudentIndex, localScore, scoreModified, selectedClass, selectedSubjectId, selectedAssessmentId, assessments, getStudentScores]);


    const getSelectStyles = (isCompact: boolean) => `w-full ${isCompact ? 'p-2' : 'p-1 text-xs'} border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-all bg-white text-gray-900 font-medium lg:p-2 lg:text-base`;

    return (
        <div className="space-y-3 lg:space-y-6 pt-14 pb-20 lg:pb-0">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-800 px-4 lg:px-0">Score Entry</h1>
            </div>

            <div className={`sticky ${useMobileView ? 'top-20' : 'top-14'} lg:top-0 z-20 transition-all duration-300 ${!useMobileView ? 'mb-1' : 'py-2 sm:py-4 bg-gray-100'}`}>
                <div className={`flex flex-col ${useMobileView ? 'gap-2 p-3' : 'gap-0.5 p-2'} sm:gap-4 sm:p-4 bg-white rounded-xl shadow-md border border-gray-200 mx-auto max-w-7xl`}>

                    {/* Mobile View Toggle - Top */}
                    <div className="lg:hidden flex items-center justify-between pb-2 border-b border-gray-100 mb-1 lg:mb-0">
                        <label className="flex items-center space-x-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={useMobileView}
                                onChange={(e) => setUseMobileView(e.target.checked)}
                                className="form-checkbox h-4 w-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                            />
                            <span className={`font-bold text-gray-700 ${useMobileView ? 'text-sm' : 'text-[10px]'}`}>Compact View</span>
                        </label>
                        {!useMobileView && <MobileControls compact={true} className="origin-right" />}
                    </div>

                    <div className="grid grid-cols-2 lg:flex lg:flex-row gap-3 lg:gap-4">
                        <div className="flex-1">
                            <label htmlFor="class-select" className={`block font-medium text-gray-700 ${useMobileView ? 'text-sm mb-1' : 'text-[10px] mb-0'} lg:text-sm lg:mb-1`}>Select Class</label>
                            <select
                                id="class-select"
                                value={selectedClass}
                                onChange={(e) => {
                                    const newClassName = e.target.value;
                                    
                                    // SMART ATOMIC TRANSITION:
                                    // 1. Calculate valid subjects for the NEW class
                                    const nextSubjects = getSubjectsForUserAndClass(currentUser, newClassName, allSubjects);
                                    
                                    // 2. Check if current subject still exists in new class
                                    const stillValid = nextSubjects.find(s => s.id === selectedSubjectId);
                                    
                                    // 3. Update BOTH in one cycle to prevent mismatched render leaks
                                    setSelectedClass(newClassName);
                                    localStorage.setItem('scoreEntry_selectedClass', newClassName);
                                    
                                    if (!stillValid && nextSubjects.length > 0) {
                                        const firstSubjectId = nextSubjects[0].id;
                                        setSelectedSubjectId(firstSubjectId);
                                        localStorage.setItem('scoreEntry_selectedSubjectId', String(firstSubjectId));
                                    }
                                }}
                                className={getSelectStyles(useMobileView)}
                            >
                                {currentUser?.role === 'Admin' || (classes.length === 0) ? (
                                    <option value="">
                                        {currentUser?.role === 'Admin' ? '-- All Classes --' : '-- Select Class --'}
                                    </option>
                                ) : null}
                                {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="flex-1">
                            <label htmlFor="subject-select" className={`block font-medium text-gray-700 ${useMobileView ? 'text-sm mb-1' : 'text-[10px] mb-0'} lg:text-sm lg:mb-1 ${subjects.length === 0 ? 'text-red-500' : ''}`}>
                                {subjects.length === 0 ? 'No Subjects Found' : 'Select Subject'}
                            </label>
                            <div className="relative">
                                <select
                                    id="subject-select"
                                    value={selectedSubjectId || ''}
                                    onChange={(e) => {
                                        const newValue = Number(e.target.value);
                                        setSelectedSubjectId(newValue);
                                        localStorage.setItem('scoreEntry_selectedSubjectId', String(newValue));
                                    }}
                                    className={`${getSelectStyles(useMobileView)} ${subjects.length === 0 ? 'border-red-300 bg-red-50' : ''}`}
                                    disabled={subjects.length === 0}
                                >
                                    {subjects.length === 0 && <option value="">No subjects assigned to this class</option>}
                                    {subjects.map(s => <option key={s.id} value={s.id}>{s.subject}</option>)}
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 lg:h-5 lg:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                            {subjects.length === 0 && (
                                <p className="mt-1 text-[9px] text-red-500 font-medium italic">
                                    Please contact Admin to assign subjects to you for this class.
                                </p>
                            )}
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
                                                onChange={(e) => {
                                                    if (scoreModified) commitScore();
                                                    handleStudentIndexChange(Number(e.target.value));
                                                }}
                                                className={getSelectStyles(true)}
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
                                                            if (scoreModified) commitScore();
                                                            
                                                            // Find the NEXT unscored student after the current one
                                                            let nextIndex = -1;
                                                            
                                                            // 1. Search forward from current selection
                                                            for (let i = selectedStudentIndex + 1; i < filteredStudents.length; i++) {
                                                                const s = filteredStudents[i];
                                                                const scores = getStudentScores(s.id, selectedSubjectId, selectedAssessmentId);
                                                                if (!scores || scores.length === 0 || scores[0] === '') {
                                                                    nextIndex = i;
                                                                    break;
                                                                }
                                                            }
                                                            
                                                            // 2. If nothing found, wrap around to start
                                                            if (nextIndex === -1) {
                                                                for (let i = 0; i < selectedStudentIndex; i++) {
                                                                    const s = filteredStudents[i];
                                                                    const scores = getStudentScores(s.id, selectedSubjectId, selectedAssessmentId);
                                                                    if (!scores || scores.length === 0 || scores[0] === '') {
                                                                        nextIndex = i;
                                                                        break;
                                                                    }
                                                                }
                                                            }

                                                            if (nextIndex !== -1) {
                                                                handleStudentIndexChange(nextIndex);
                                                                setMobileScoreError('');
                                                            }
                                                        }}
                                                        className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700 hover:bg-red-200 hover:text-red-800 transition-colors"
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
                                                onChange={(e) => {
                                                    if (scoreModified) commitScore();
                                                    setSelectedAssessmentId(Number(e.target.value));
                                                }}
                                                className={getSelectStyles(true)}
                                            >
                                                {sortedAssessments.map(assessment => (
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
                                        <div className="flex items-stretch gap-2">
                                            <div className="flex-1">
                                                <ReadOnlyWrapper allowedRoles={['Admin', 'Teacher']}>
                                                    <div className="relative">
                                                        <input
                                                            ref={scoreInputRef}
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={localScore}
                                                            onChange={(e) => {
                                                                const filtered = e.target.value.replace(/[^0-9/.]/g, '');
                                                                setLocalScore(filtered);
                                                                setScoreModified(true);
                                                                
                                                                // Debounce the global draft update
                                                                if (mobileDebounceTimer.current) {
                                                                    clearTimeout(mobileDebounceTimer.current);
                                                                }

                                                                mobileDebounceTimer.current = setTimeout(() => {
                                                                    const student = filteredStudents[selectedStudentIndex];
                                                                    if (student) {
                                                                        updateDraftScore(student.id, selectedSubjectId, selectedAssessmentId, filtered);
                                                                    }
                                                                }, 500);
                                                            }}
                                                            onBlur={commitScore}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    commitScore();
                                                                    e.currentTarget.blur();
                                                                }
                                                            }}
                                                            placeholder={getPlaceholder()}
                                                            className={`w-full p-3 pl-20 text-center text-2xl font-mono border rounded-md shadow-sm focus:outline-none focus:ring-2 ${isScoreDirty(filteredStudents[selectedStudentIndex]?.id, selectedSubjectId, selectedAssessmentId)
                                                                ? `${DIRTY_INDICATOR_BG} ${DIRTY_INDICATOR_TEXT} ${DIRTY_INDICATOR_BORDER} focus:ring-blue-400 focus:border-blue-400`
                                                                : 'bg-gray-50 border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500'
                                                                } ${isReadOnly ? 'cursor-not-allowed opacity-60' : ''}`}
                                                            readOnly={isReadOnly}
                                                        />

                                                        {isScoreDirty(filteredStudents[selectedStudentIndex]?.id, selectedSubjectId, selectedAssessmentId) && (
                                                            <div className="absolute top-0 right-0 bg-yellow-400 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-bl uppercase z-10">
                                                                Unsaved
                                                            </div>
                                                        )}

                                                        {!isReadOnly && projectedStats && projectedStats.rawRank > 0 && (
                                                            <div className={`absolute left-2 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md border text-xs font-bold leading-none shadow-sm z-20 pointer-events-none
                                                                ${projectedStats.rawRank === 1 ? 'bg-yellow-100 text-yellow-800 border-yellow-300 ring-1 ring-yellow-300' :
                                                                    projectedStats.rawRank === 2 ? 'bg-slate-100 text-slate-700 border-slate-300 ring-1 ring-slate-300' :
                                                                        projectedStats.rawRank === 3 ? 'bg-orange-100 text-orange-800 border-orange-300 ring-1 ring-orange-300' :
                                                                            'bg-blue-50 text-blue-700 border-blue-200'}`}
                                                            >
                                                                {projectedStats.rank}
                                                            </div>
                                                        )}

                                                        {localScore && !isReadOnly && (
                                                            <button
                                                                onClick={() => {
                                                                    setLocalScore('');
                                                                    setScoreModified(true);
                                                                    const student = filteredStudents[selectedStudentIndex];
                                                                    if (student) {
                                                                        updateStudentScores(student.id, selectedSubjectId, selectedAssessmentId, ['']);
                                                                        removeDraftScore(student.id, selectedSubjectId, selectedAssessmentId);
                                                                    }
                                                                    scoreInputRef.current?.focus();
                                                                }}
                                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-red-500 transition-colors"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                    {mobileScoreError && <p className="text-red-500 text-sm mt-1">{mobileScoreError}</p>}
                                                </ReadOnlyWrapper>
                                            </div>

                                            {!isReadOnly && projectedStats && (
                                                <div className="w-20 bg-blue-50 rounded-md border border-blue-100 flex flex-col items-center justify-center shrink-0">
                                                    <span className="text-[10px] uppercase text-blue-400 font-bold tracking-wider">Total</span>
                                                    <span className="text-xl font-bold text-blue-700">{projectedStats.total}%</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex justify-between pt-2">
                                        <button
                                            onClick={() => {
                                                if (scoreModified) commitScore();
                                                handleStudentIndexChange(Math.max(0, selectedStudentIndex - 1));
                                            }}
                                            disabled={selectedStudentIndex === 0}
                                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            Previous Student
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (scoreModified) commitScore();
                                                handleStudentIndexChange(Math.min(filteredStudents.length - 1, selectedStudentIndex + 1));
                                            }}
                                            disabled={selectedStudentIndex === filteredStudents.length - 1}
                                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            Next Student
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

                    {/* Weight Warning - Inside Selection Card */}
                    {totalWeight !== 100 && (
                        <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg text-xs">
                            <p className="font-bold flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                Weights Warning ({totalWeight}%)
                            </p>
                            <p>Sum is not 100%. Review settings.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Desktop View: Grid Table & Mobile Card View */}
            <ReadOnlyWrapper allowedRoles={['Admin', 'Teacher']}>
                <div className={`lg:bg-white lg:rounded-xl lg:shadow-md lg:border lg:border-gray-200 ${useMobileView ? 'hidden lg:block' : 'block'}`}>
                    <div className="overflow-x-visible lg:overflow-x-auto pb-4 lg:pb-0">
                        <table className="min-w-full text-left block lg:table">
                            <thead className="bg-gray-50 hidden lg:table-header-group">
                                <tr className="border-b">
                                    <th className="p-4 font-semibold text-gray-600 w-12 text-center">#</th>
                                    <th className="p-4 font-semibold text-gray-600 w-1/4">Student Name</th>
                                    {sortedAssessments.map(assessment => (
                                        <th key={assessment.id} className="p-4 font-semibold text-gray-600 text-center">
                                            {assessment.name} <br /> <span className="font-normal text-sm">({assessment.name.toLowerCase().includes('exam') ? 100 : assessment.weight}%)</span>
                                        </th>
                                    ))}
                                    <th className="p-4 font-semibold text-gray-600 text-center">Total (100%)</th>
                                </tr>
                            </thead>
                            <tbody className="block lg:table-row-group space-y-4 lg:space-y-0">
                                {filteredStudents.length > 0 ? (
                                    filteredStudents.map((student, index) => (
                                        <InlineScoreInput
                                            key={`${student.id}-${selectedSubjectId}`}
                                            index={index + 1}
                                            student={student}
                                            subjectId={selectedSubjectId}
                                            assessments={sortedAssessments}
                                            onOpenModal={handleOpenModal}
                                            readOnly={isReadOnly}
                                            studentTotal={allStudentsRankings[student.id]?.total}
                                            studentRank={allStudentsRankings[student.id]?.rank}
                                        />
                                    ))
                                ) : (
                                    <tr className="block lg:table-row bg-white rounded-xl shadow-sm border border-gray-200 lg:border-none lg:shadow-none lg:bg-transparent">
                                        <td colSpan={sortedAssessments.length + 3} className="block lg:table-cell text-center p-8 text-gray-500">
                                            No students in the selected class.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </ReadOnlyWrapper>

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
        </div>
    );
};

export default ScoreEntry;