import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../context/DataContext';
import type { Student, Assessment } from '../types';
import { MULTI_SCORE_ENTRY_ENABLED, DIRTY_INDICATOR_BG, DIRTY_INDICATOR_TEXT, DIRTY_INDICATOR_SECONDARY_TEXT, DIRTY_INDICATOR_HOVER_BG, DIRTY_INDICATOR_BORDER } from '../constants';

interface InlineScoreInputProps {
    student: Student;
    subjectId: number;
    assessments: Assessment[];
    onOpenModal: (student: Student, assessment: Assessment) => void;
    readOnly?: boolean;
    index: number;
    studentRank?: string;
    studentTotal?: string;
}

const calculateDisplayScore = (scores: string[], assessment: Assessment): number => {
    if (!scores || scores.length === 0) return 0;
    const isExam = assessment.name.toLowerCase().includes('exam');

    const sumOfNumerators = scores.reduce((sum, scoreStr) => {
        if (!scoreStr) return sum;
        const [score] = scoreStr.split('/').map(Number);
        return sum + (score || 0);
    }, 0);

    if (isExam) {
        // For exams, scores are stored out of 100. Display is the average.
        return sumOfNumerators / scores.length;
    } else {
        // For classwork, we show the combined weighted score
        const totalMaxPossibleScore = scores.reduce((sum, scoreStr) => {
            if (!scoreStr) return sum;
            const [, max] = scoreStr.split('/').map(Number);
            return sum + (max || assessment.weight);
        }, 0);

        if (totalMaxPossibleScore === 0) return 0;
        return (sumOfNumerators / totalMaxPossibleScore) * assessment.weight;
    }
};

const formatScore = (score: number): string => {
    const fixedScore = score.toFixed(1);
    return fixedScore.endsWith('.0') ? fixedScore.slice(0, -2) : fixedScore;
};


const InlineScoreInput: React.FC<InlineScoreInputProps> = ({ student, subjectId, assessments, onOpenModal, readOnly, index, studentRank = '-', studentTotal = '0' }) => {
    const { scores, getStudentScores, updateStudentScores, setHasLocalChanges, updateDraftScore, removeDraftScore, getComputedScore, draftVersion, isScoreDirty, isDraftScore, refreshVersion } = useData();

    const [inlineValues, setInlineValues] = useState<{ [key: number]: string }>({});
    const [errors, setErrors] = useState<{ [key: number]: string | undefined }>({});
    const [modifiedFields, setModifiedFields] = useState<Set<number>>(new Set()); // Track which fields user has modified
    const [focusedAssessmentId, setFocusedAssessmentId] = useState<number | null>(null);
    const debounceTimer = useRef<{ [key: number]: NodeJS.Timeout }>({});
    const originalValues = useRef<{ [key: number]: string }>({}); // Track original values for comparison

    // Reset original values when student or subject changes or when a manual refresh occurs
    useEffect(() => {
        originalValues.current = {};
        setModifiedFields(new Set());
    }, [student.id, subjectId, refreshVersion]);

    useEffect(() => {
        const initialValues: { [key: number]: string } = {};
        assessments.forEach(assessment => {
            // Get the computed score (draft > saved)
            // PASS subjectId to ensure we get the correct draft for this subject
            const val = getComputedScore(student.id, subjectId, assessment.id);

            // CRITICAL: Prevent overwriting the value while the user is typing/focused
            if (focusedAssessmentId === assessment.id) {
                return;
            }

            // Should we update? Only if meaningful change to avoid cursor jumps?
            if (inlineValues[assessment.id] !== val) {
                initialValues[assessment.id] = val;
            }
            // Store ORIGINAL saved value (not draft) for comparison
            if (!(assessment.id in originalValues.current)) {
                const savedScores = getStudentScores(student.id, subjectId, assessment.id);
                const savedVal = savedScores[0] || '';
                originalValues.current[assessment.id] = savedVal;
            }
        });

        if (Object.keys(initialValues).length > 0) {
            setInlineValues(prev => ({ ...prev, ...initialValues }));
        }
    }, [student.id, subjectId, assessments, draftVersion, scores]); // Listen to draftVersion and scores for external changes

    // NEW: Clear errors when switching rows/subjects
    useEffect(() => {
        setErrors({});
    }, [student.id, subjectId]);

    const handleValueChange = (assessmentId: number, value: string) => {
        const filteredValue = value.replace(/[^0-9/.]/g, '');
        const assessment = assessments.find(a => a.id === assessmentId);

        0 && console.log('[InlineScoreInput] User input:', {
            studentId: student.id,
            studentName: student.name,
            subjectId,
            assessmentId,
            assessmentName: assessment?.name,
            rawInput: value,
            filteredInput: filteredValue,
            previousValue: inlineValues[assessmentId] || ''
        });

        setInlineValues(prev => ({ ...prev, [assessmentId]: filteredValue }));

        // Debounce the global draft update to keep typing fluid
        if (debounceTimer.current[assessmentId]) {
            clearTimeout(debounceTimer.current[assessmentId]);
        }

        debounceTimer.current[assessmentId] = setTimeout(() => {
            // Check against original value
            const originalVal = originalValues.current[assessmentId] || '';
            const isActuallyChanged = filteredValue !== originalVal;

            if (isActuallyChanged) {
                setModifiedFields(prev => new Set(prev).add(assessmentId));
                updateDraftScore(student.id, subjectId, assessmentId, filteredValue);
            } else {
                setModifiedFields(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(assessmentId);
                    return newSet;
                });
                removeDraftScore(student.id, subjectId, assessmentId);
            }
        }, 500);

        if (errors[assessmentId]) {
            setErrors(prev => ({ ...prev, [assessmentId]: undefined }));
        }
    };

    const handleSave = (assessmentId: number) => {
        // Clear any pending debounce since we are committing now
        if (debounceTimer.current[assessmentId]) {
            clearTimeout(debounceTimer.current[assessmentId]);
            delete debounceTimer.current[assessmentId];
        }

        const assessment = assessments.find(a => a.id === assessmentId)!;
        const rawScoreInput = inlineValues[assessmentId]?.trim();
        const isExam = assessment.name.toLowerCase().includes('exam');
        const maxScore = isExam ? 100 : assessment.weight;
        const basis = isExam ? 100 : assessment.weight;

        0 && console.log('[InlineScoreInput] handleSave called:', {
            studentId: student.id,
            studentName: student.name,
            subjectId,
            assessmentId,
            assessmentName: assessment.name,
            rawInput: rawScoreInput
        });

        if (!rawScoreInput) {
            0 && console.log('[InlineScoreInput] Empty score - clearing:', {
                studentId: student.id,
                studentName: student.name,
                assessmentId,
                subjectId
            });

            // Explicitly clear the inline value to show empty field
            setInlineValues(prev => ({ ...prev, [assessmentId]: '' }));

            // Clear the score and keep it marked as modified so save button stays enabled
            // FIX: Use [''] instead of [] to ensure DataContext treats this as an explicit "Empty" value
            // that is different from "No Data" or legacy empty arrays.
            updateStudentScores(student.id, subjectId, assessment.id, ['']);

            // Update originalValues to the cleared state so future comparisons work correctly
            // This ensures that if user moves away and returns, the cleared state is recognized as the baseline
            originalValues.current[assessmentId] = '';

            // Only mark as modified (if not already) to keep the global save button enabled
            setModifiedFields(prev => new Set(prev).add(assessmentId));

            // Remove from draft since we've already updated the local state
            removeDraftScore(student.id, subjectId, assessmentId);
            return;
        }

        let convertedScore: number;
        if (rawScoreInput.includes('/')) {
            const parts = rawScoreInput.split('/');
            if (parts.length !== 2) {
                0 && console.log('[InlineScoreInput] Validation error: Invalid fraction format');
                setErrors(prev => ({ ...prev, [assessmentId]: "Use 'x' or 'x/y'" }));
                removeDraftScore(student.id, subjectId, assessmentId);
                return;
            }
            const [x, y] = parts.map(Number);
            if (isNaN(x) || isNaN(y)) {
                0 && console.log('[InlineScoreInput] Validation error: Non-numeric values in fraction');
                setErrors(prev => ({ ...prev, [assessmentId]: "Numbers only" }));
                removeDraftScore(student.id, subjectId, assessmentId);
                return;
            }
            if (y === 0) {
                0 && console.log('[InlineScoreInput] Validation error: Division by zero');
                setErrors(prev => ({ ...prev, [assessmentId]: "Base cannot be 0" }));
                removeDraftScore(student.id, subjectId, assessmentId);
                return;
            }
            convertedScore = (x / y) * maxScore;
            0 && console.log('[InlineScoreInput] Fraction conversion:', { x, y, maxScore, convertedScore });
        } else {
            const z = Number(rawScoreInput);
            if (isNaN(z)) {
                0 && console.log('[InlineScoreInput] Validation error: Not a number');
                setErrors(prev => ({ ...prev, [assessmentId]: "Score must be a number" }));
                removeDraftScore(student.id, subjectId, assessmentId);
                return;
            }
            convertedScore = z;
            0 && console.log('[InlineScoreInput] Direct score:', { rawInput: z, convertedScore });
        }

        if (convertedScore / basis > 1 || convertedScore < 0) {
            setErrors(prev => ({ ...prev, [assessmentId]: `Score cannot exceed assessment weight (max 100%)` }));
            // Revert to original value
            const originalVal = originalValues.current[assessmentId] || '';
            setInlineValues(prev => ({ ...prev, [assessmentId]: originalVal }));
            // Remove from modified fields
            setModifiedFields(prev => {
                const next = new Set(prev);
                next.delete(assessmentId);
                return next;
            });
            removeDraftScore(student.id, subjectId, assessmentId);
            return;
        }

        const finalScore = `${Number(convertedScore.toFixed(1))}/${basis}`;

        // Update original value to the new saved value
        originalValues.current[assessmentId] = finalScore;

        0 && console.log('[InlineScoreInput] ✅ Score validated and formatted:', {
            studentId: student.id,
            studentName: student.name,
            subjectId,
            assessmentId,
            assessmentName: assessment.name,
            rawInput: rawScoreInput,
            convertedScore,
            finalScore
        });

        0 && console.log('[InlineScoreInput] 💾 Calling updateStudentScores (saving to local cache)...');
        updateStudentScores(student.id, subjectId, assessment.id, [finalScore]);

        // Clear modification flag after successful save
        setModifiedFields(prev => {
            const newSet = new Set(prev);
            newSet.delete(assessmentId);
            return newSet;
        });

        // Remove from global draft since it's now saved to local state
        removeDraftScore(student.id, subjectId, assessmentId);

        0 && console.log('[InlineScoreInput] ✅ Score committed successfully');
    };

    const totalWeightedScoreForDisplay = assessments.reduce((total, assessment) => {
        const scores = getStudentScores(student.id, subjectId, assessment.id);
        const isExam = assessment.name.toLowerCase().includes('exam');
        const displayScore = calculateDisplayScore(scores, assessment);

        if (isExam) {
            // Convert average (which is out of 100) back to its weighted value for the total
            return total + (displayScore / 100 * assessment.weight);
        } else {
            // Class work display score is already the weighted value
            return total + displayScore;
        }
    }, 0);

    return (
        <tr className="grid grid-cols-2 lg:table-row bg-white lg:bg-transparent border lg:border-b border-gray-200 lg:border-x-0 lg:border-t-0 rounded-xl lg:rounded-none mb-4 lg:mb-0 shadow-sm lg:shadow-none hover:bg-gray-50 overflow-hidden">
            <td className="hidden lg:table-cell p-4 text-center text-gray-500 font-medium">{index}</td>
            <td className="col-span-2 block lg:table-cell p-2 lg:p-4 font-bold lg:font-medium text-gray-900 border-b lg:border-none bg-gray-50 lg:bg-transparent flex justify-between items-center lg:items-start text-base lg:text-base">
                <div className="flex items-center gap-2 lg:block">
                    <span className="lg:hidden w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shadow-sm">{index}</span>
                    <span className="text-base font-bold lg:text-base lg:font-medium">{student.name}</span>
                </div>
                {!readOnly && studentRank !== '-' && (
                    <div className="lg:hidden flex flex-col items-end leading-none gap-0.5">
                        <span className="text-[9px] text-gray-400 font-medium">Total Score: <span className="text-blue-600 font-bold">{studentTotal}%</span></span>
                        <span className="text-[9px] text-gray-400 font-medium">Position: <span className="text-blue-600 font-bold">{studentRank}</span></span>
                    </div>
                )}
            </td>

            {assessments.map(assessment => {
                const scores = getStudentScores(student.id, subjectId, assessment.id);
                const isDirty = isScoreDirty(student.id, subjectId, assessment.id);

                // SHARED CARD STYLE for mobile
                const mobileCardStyles = "flex flex-col bg-blue-50/30 border border-blue-100 rounded-lg p-1.5 m-1.5 lg:m-0 lg:p-4 lg:bg-transparent lg:border-none lg:rounded-none";

                if (scores.length > 1) {
                    const displayScore = calculateDisplayScore(scores, assessment);
                    return (
                        <td key={assessment.id} className={`block lg:table-cell transition-colors relative ${mobileCardStyles} ${isDirty ? `${DIRTY_INDICATOR_BG} ${DIRTY_INDICATOR_TEXT}` : ''}`}>
                            {isDirty && (
                                <span className="absolute left-0 top-0 text-[8px] font-bold uppercase px-1 bg-yellow-400 text-black leading-none rounded-br z-10">
                                    Unsaved
                                </span>
                            )}
                            
                            {/* Card Header (Mobile Only) */}
                            <div className="lg:hidden flex justify-between items-start mb-1.5">
                                <span className="text-[9px] font-bold text-blue-600 uppercase tracking-tight leading-tight flex-1 pr-1">
                                    {assessment.name}
                                </span>
                                <span className="text-[9px] font-bold text-blue-400/80 italic">
                                    Weight: {assessment.weight}
                                </span>
                            </div>

                            <div className="flex flex-col items-center justify-center lg:items-center">
                                {MULTI_SCORE_ENTRY_ENABLED ? (
                                    <button
                                        onClick={() => onOpenModal(student, assessment)}
                                        className={`w-full text-center px-1 py-1 rounded-md hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-blue-400 ${isDirty ? `ring-1 ${DIRTY_INDICATOR_BORDER}` : 'border border-gray-200 lg:border-none'}`}
                                    >
                                        <span className={`text-xl lg:text-base font-mono ${isDirty ? 'font-bold' : 'text-blue-700'}`}>{formatScore(displayScore)}</span>
                                        <div className={`text-[9px] ${isDirty ? DIRTY_INDICATOR_SECONDARY_TEXT : 'text-gray-500'}`}>{scores.length} score(s)</div>
                                    </button>
                                ) : (
                                    <div className="w-full text-center px-1 py-1 rounded-md">
                                        <span className={`text-xl lg:text-base font-mono ${isDirty ? 'font-bold' : 'text-gray-700'}`}>{formatScore(displayScore)}</span>
                                        <div className={`text-[9px] ${isDirty ? DIRTY_INDICATOR_SECONDARY_TEXT : 'text-gray-500'}`}>{scores.length} score(s)</div>
                                    </div>
                                )}
                            </div>
                        </td>
                    );
                }

                return (
                    <td key={assessment.id} className={`block lg:table-cell transition-colors relative ${mobileCardStyles} ${isDirty ? `${DIRTY_INDICATOR_BG} ${DIRTY_INDICATOR_TEXT}` : ''}`}>
                        {isDirty && (
                            <span className="absolute left-0 top-0 text-[8px] font-bold uppercase px-1 bg-yellow-400 text-black leading-none rounded-br z-10">
                                Unsaved
                            </span>
                        )}

                        {/* Card Header (Mobile Only) */}
                        <div className="lg:hidden flex justify-between items-start mb-1.5">
                            <span className="text-[9px] font-bold text-blue-600 uppercase tracking-tight leading-tight flex-1 pr-1">
                                {assessment.name}
                            </span>
                            <span className="text-[9px] font-bold text-blue-400/80 italic">
                                Weight: {assessment.weight}
                            </span>
                        </div>

                        <div className="flex flex-col items-center justify-center shrink-0">
                            <div className="flex items-center w-full">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={inlineValues[assessment.id] || ''}
                                    onChange={(e) => handleValueChange(assessment.id, e.target.value)}
                                    onFocus={() => setFocusedAssessmentId(assessment.id)}
                                    onBlur={() => {
                                        setFocusedAssessmentId(null);
                                        handleSave(assessment.id);
                                    }}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave(assessment.id); (e.target as HTMLInputElement).blur(); } }}
                                    placeholder={assessment.name.toLowerCase().includes('exam') ? 'e.g., 85' : 'Score'}
                                    className={`w-full p-1.5 text-center text-base lg:text-base font-mono border rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 
                                        ${isDirty ? `bg-white border-yellow-500 text-red-600 font-bold focus:ring-yellow-500` : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500'}
                                    `}
                                    aria-label={`Score for ${student.name} in ${assessment.name}`}
                                    disabled={readOnly}
                                />
                                {MULTI_SCORE_ENTRY_ENABLED && !readOnly && (
                                    <button
                                        onClick={() => onOpenModal(student, assessment)}
                                        className={`ml-1 p-1 border rounded-full transition-colors ${isDirty ? `text-white border-white/50 hover:bg-white/20` : 'text-gray-500 border-gray-300 hover:bg-blue-100 hover:text-blue-600 hover:border-blue-400'}`}
                                        title="Add multiple scores"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                            {errors[assessment.id] && <p className="text-red-500 text-[10px] mt-0.5 w-full text-center">{errors[assessment.id]}</p>}
                        </div>
                    </td>
                );
            })}
            <td className="col-span-2 block lg:table-cell flex justify-between items-center p-2 text-right lg:text-center font-bold text-gray-800 bg-gray-50 lg:bg-transparent mt-1 lg:mt-0 shadow-inner lg:shadow-none">
                <span className="lg:hidden text-[10px] text-gray-500 uppercase font-bold tracking-wider">Overall Total (100%)</span>
                <span className="text-lg lg:text-base text-blue-700 lg:text-gray-800">{formatScore(totalWeightedScoreForDisplay)}{!totalWeightedScoreForDisplay && totalWeightedScoreForDisplay !== 0 ? '' : '%'}</span>
            </td>
        </tr>
    );
};

export default InlineScoreInput;