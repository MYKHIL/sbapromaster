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


const InlineScoreInput: React.FC<InlineScoreInputProps> = ({ student, subjectId, assessments, onOpenModal, readOnly, index }) => {
    const { scores, getStudentScores, updateStudentScores, setHasLocalChanges, updateDraftScore, removeDraftScore, getComputedScore, draftVersion, isScoreDirty, isDraftScore, refreshVersion } = useData();

    const [inlineValues, setInlineValues] = useState<{ [key: number]: string }>({});
    const [errors, setErrors] = useState<{ [key: number]: string | undefined }>({});
    const [modifiedFields, setModifiedFields] = useState<Set<number>>(new Set()); // Track which fields user has modified
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

            // Should we update? Only if meaningful change to avoid cursor jumps?
            // Since we control local state, we can just sync.
            // But checking if it matches current state prevents redundant updates
            if (inlineValues[assessment.id] !== val) {
                initialValues[assessment.id] = val;
            }
            // Store ORIGINAL saved value (not draft) for comparison
            // CRITICAL FIX: Only initialize once - do not update on every effect run
            if (!(assessment.id in originalValues.current)) {
                const savedScores = getStudentScores(student.id, subjectId, assessment.id);
                const savedVal = savedScores[0] || '';
                originalValues.current[assessment.id] = savedVal;
            }
        });

        // Merge with existing values to keep untouched fields stable? 
        // No, we want to overwrite if draftVersion changes (meaning someone else updated it)
        setInlineValues(prev => ({ ...prev, ...initialValues }));
        setErrors({});
    }, [student, subjectId, assessments, draftVersion, scores]); // Listen to draftVersion and scores for external changes

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

        // Check against original value
        const originalVal = originalValues.current[assessmentId] || '';
        // Consider empty string and '0' as potentially equivalent if needed, but for now strict string equality
        // Or better: normalized comparison
        const isActuallyChanged = filteredValue !== originalVal;

        if (isActuallyChanged) {
            setModifiedFields(prev => new Set(prev).add(assessmentId)); // Mark as modified
            // Update global draft
            updateDraftScore(student.id, subjectId, assessmentId, filteredValue);
        } else {
            // Reverted to original
            setModifiedFields(prev => {
                const newSet = new Set(prev);
                newSet.delete(assessmentId);
                return newSet;
            });
            // Remove from global draft (it matches saved)
            removeDraftScore(student.id, subjectId, assessmentId);
        }

        if (errors[assessmentId]) {
            setErrors(prev => ({ ...prev, [assessmentId]: undefined }));
        }
    };

    const handleSave = (assessmentId: number) => {
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
                return;
            }
            const [x, y] = parts.map(Number);
            if (isNaN(x) || isNaN(y)) {
                0 && console.log('[InlineScoreInput] Validation error: Non-numeric values in fraction');
                setErrors(prev => ({ ...prev, [assessmentId]: "Numbers only" }));
                return;
            }
            if (y === 0) {
                0 && console.log('[InlineScoreInput] Validation error: Division by zero');
                setErrors(prev => ({ ...prev, [assessmentId]: "Base cannot be 0" }));
                return;
            }
            convertedScore = (x / y) * maxScore;
            0 && console.log('[InlineScoreInput] Fraction conversion:', { x, y, maxScore, convertedScore });
        } else {
            const z = Number(rawScoreInput);
            if (isNaN(z)) {
                0 && console.log('[InlineScoreInput] Validation error: Not a number');
                setErrors(prev => ({ ...prev, [assessmentId]: "Score must be a number" }));
                return;
            }
            convertedScore = z;
            0 && console.log('[InlineScoreInput] Direct score:', { rawInput: z, convertedScore });
        }

        if (convertedScore > maxScore) {
            0 && console.log('[InlineScoreInput] Validation error: Exceeds max score', { convertedScore, maxScore });
            setErrors(prev => ({ ...prev, [assessmentId]: `Max is ${maxScore}` }));
            return;
        }
        if (convertedScore < 0) {
            0 && console.log('[InlineScoreInput] Validation error: Negative score');
            setErrors(prev => ({ ...prev, [assessmentId]: "Cannot be negative" }));
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
        <tr className="block lg:table-row bg-white lg:bg-transparent border lg:border-b border-gray-200 lg:border-x-0 lg:border-t-0 rounded-xl lg:rounded-none mb-4 lg:mb-0 shadow-sm lg:shadow-none hover:bg-gray-50 overflow-hidden">
            <td className="hidden lg:table-cell p-4 text-center text-gray-500 font-medium">{index}</td>
            <td className="block lg:table-cell p-4 font-bold lg:font-medium text-gray-900 border-b lg:border-none bg-gray-50 lg:bg-transparent flex justify-between items-center lg:items-start text-lg lg:text-base">
                <div className="flex items-center gap-3 lg:block">
                    <span className="lg:hidden w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm shadow-sm">{index}</span>
                    <span>{student.name}</span>
                </div>
            </td>
            {assessments.map(assessment => {
                const scores = getStudentScores(student.id, subjectId, assessment.id);

                const isDirty = isScoreDirty(student.id, subjectId, assessment.id);
                const isDraft = isDraftScore(student.id, subjectId, assessment.id);

                if (scores.length > 1) {
                    const displayScore = calculateDisplayScore(scores, assessment);
                    return (
                    <td key={assessment.id} className={`block lg:table-cell flex lg:table-cell justify-between items-center p-4 lg:p-4 border-b lg:border-none last:border-0 transition-colors relative ${isDirty ? `${DIRTY_INDICATOR_BG} ${DIRTY_INDICATOR_TEXT}` : ''}`}>
                            {isDirty && (
                                <span className="absolute left-0 top-0 lg:left-0 lg:top-0 text-[8px] font-bold uppercase px-0.5 bg-yellow-400 text-black leading-none rounded-br z-10">
                                    Unsaved
                                </span>
                            )}
                            <div className="lg:hidden text-left flex-1 font-medium text-gray-700 text-sm">
                                {assessment.name} <span className="font-normal text-xs text-gray-400 block">({assessment.name.toLowerCase().includes('exam') ? 100 : assessment.weight}%)</span>
                            </div>
                            <div className="flex flex-col items-end lg:items-center">
                            {MULTI_SCORE_ENTRY_ENABLED ? (
                                <button
                                    onClick={() => onOpenModal(student, assessment)}
                                    className={`w-full lg:w-auto text-center px-3 py-1.5 lg:px-2 lg:py-1 rounded-md hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-blue-400 ${isDirty ? `ring-1 ${DIRTY_INDICATOR_BORDER}` : 'border border-gray-200 lg:border-none'}`}
                                >
                                    <span className={`font-mono ${isDirty ? 'font-bold' : 'text-blue-700'}`}>{formatScore(displayScore)}</span>
                                    <div className={`text-xs ${isDirty ? DIRTY_INDICATOR_SECONDARY_TEXT : 'text-gray-500'}`}>{scores.length} score(s)</div>
                                </button>
                            ) : (
                                <div className="w-full text-center px-2 py-1 rounded-md">
                                    <span className={`font-mono ${isDirty ? 'font-bold' : 'text-gray-700'}`}>{formatScore(displayScore)}</span>
                                    <div className={`text-xs ${isDirty ? DIRTY_INDICATOR_SECONDARY_TEXT : 'text-gray-500'}`}>{scores.length} score(s)</div>
                                </div>
                            )}
                            </div>
                        </td>
                    );
                }

                return (
                    <td key={assessment.id} className={`block lg:table-cell flex lg:table-cell justify-between items-center p-3 lg:p-2 align-top lg:align-middle transition-colors relative border-b lg:border-none border-gray-100 ${isDirty ? `${DIRTY_INDICATOR_BG} ${DIRTY_INDICATOR_TEXT}` : ''}`}>
                        {isDirty && (
                            <span className="absolute left-0 top-0 lg:left-0 lg:top-0 text-[8px] font-bold uppercase px-0.5 bg-yellow-400 text-black leading-none rounded-br z-10">
                                Unsaved
                            </span>
                        )}
                        <div className="lg:hidden text-left flex-1 font-medium text-gray-700 text-sm pr-2">
                            {assessment.name} <span className="font-normal text-xs text-gray-400 block">({assessment.name.toLowerCase().includes('exam') ? 100 : assessment.weight}%)</span>
                        </div>
                        <div className="flex flex-col items-end lg:items-center shrink-0">
                            <div className="flex items-center space-x-1">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={inlineValues[assessment.id] || ''}
                                    onChange={(e) => handleValueChange(assessment.id, e.target.value)}
                                    onBlur={() => handleSave(assessment.id)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave(assessment.id); (e.target as HTMLInputElement).blur(); } }}
                                    placeholder={assessment.name.toLowerCase().includes('exam') ? 'e.g., 85' : '-'}
                                    className={`w-24 p-1 text-center font-mono border rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 
                                        ${isDirty ? `bg-white border-yellow-500 text-red-600 font-bold focus:ring-yellow-500` : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500'}
                                    `}
                                    aria-label={`Score for ${student.name} in ${assessment.name}`}
                                    disabled={readOnly}
                                />
                                {MULTI_SCORE_ENTRY_ENABLED && !readOnly && (
                                    <button
                                        onClick={() => onOpenModal(student, assessment)}
                                        className={`p-1 border rounded-full transition-colors ${isDirty ? `text-white border-white/50 hover:bg-white/20` : 'text-gray-500 border-gray-300 hover:bg-blue-100 hover:text-blue-600 hover:border-blue-400'}`}
                                        title="Add multiple scores"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                            {errors[assessment.id] && <p className="text-red-500 text-xs mt-1 w-full">{errors[assessment.id]}</p>}
                        </div>
                    </td>
                );
            })}
            <td className="block lg:table-cell flex justify-between items-center p-4 text-right lg:text-center font-bold text-gray-800 bg-gray-50 lg:bg-transparent mt-1 lg:mt-0">
                <span className="lg:hidden text-sm text-gray-500 uppercase font-bold tracking-wider">Total (100%)</span>
                <span className="text-xl lg:text-base text-blue-700 lg:text-gray-800">{formatScore(totalWeightedScoreForDisplay)}{!totalWeightedScoreForDisplay && totalWeightedScoreForDisplay !== 0 ? '' : '%'}</span>
            </td>
        </tr>
    );
};

export default InlineScoreInput;