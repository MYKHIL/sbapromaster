import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import type { Student, Assessment } from '../types';
import { MULTI_SCORE_ENTRY_ENABLED } from '../constants';

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
        const [score] = scoreStr.split('/').map(Number);
        return sum + (score || 0);
    }, 0);

    if (isExam) {
        // For exams, scores are stored out of 100. Display is the average.
        return sumOfNumerators / scores.length;
    } else {
        // For classwork, we show the combined weighted score
        const totalMaxPossibleScore = scores.reduce((sum, scoreStr) => {
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
    const { getStudentScores, updateStudentScores, setHasLocalChanges } = useData();

    const [inlineValues, setInlineValues] = useState<{ [key: number]: string }>({});
    const [errors, setErrors] = useState<{ [key: number]: string | undefined }>({});
    const [modifiedFields, setModifiedFields] = useState<Set<number>>(new Set()); // Track which fields user has modified

    useEffect(() => {
        const initialValues: { [key: number]: string } = {};
        assessments.forEach(assessment => {
            const scores = getStudentScores(student.id, subjectId, assessment.id);
            if (scores.length <= 1) {
                // Only update if user hasn't modified this field
                if (!modifiedFields.has(assessment.id)) {
                    initialValues[assessment.id] = scores[0] || '';
                } else {
                    // Keep user's unsaved input
                    initialValues[assessment.id] = inlineValues[assessment.id] || '';
                }
            }
        });
        setInlineValues(initialValues);
        setErrors({});
    }, [student, subjectId, assessments]); // Removed inlineValues, modifiedFields, and getStudentScores to prevent infinite loop/reset

    const handleValueChange = (assessmentId: number, value: string) => {
        const filteredValue = value.replace(/[^0-9/.]/g, '');
        const assessment = assessments.find(a => a.id === assessmentId);

        console.log('[InlineScoreInput] User input:', {
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
        setModifiedFields(prev => new Set(prev).add(assessmentId)); // Mark as modified
        setHasLocalChanges(true); // Enable Upload button globally
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

        console.log('[InlineScoreInput] handleSave called:', {
            studentId: student.id,
            studentName: student.name,
            subjectId,
            assessmentId,
            assessmentName: assessment.name,
            rawInput: rawScoreInput
        });

        if (!rawScoreInput) {
            console.log('[InlineScoreInput] Empty score - clearing:', {
                studentId: student.id,
                studentName: student.name
            });
            updateStudentScores(student.id, subjectId, assessment.id, []);
            // Clear modification flag after save
            setModifiedFields(prev => {
                const newSet = new Set(prev);
                newSet.delete(assessmentId);
                return newSet;
            });
            return;
        }

        let convertedScore: number;
        if (rawScoreInput.includes('/')) {
            const parts = rawScoreInput.split('/');
            if (parts.length !== 2) {
                console.log('[InlineScoreInput] Validation error: Invalid fraction format');
                setErrors(prev => ({ ...prev, [assessmentId]: "Use 'x' or 'x/y'" }));
                return;
            }
            const [x, y] = parts.map(Number);
            if (isNaN(x) || isNaN(y)) {
                console.log('[InlineScoreInput] Validation error: Non-numeric values in fraction');
                setErrors(prev => ({ ...prev, [assessmentId]: "Numbers only" }));
                return;
            }
            if (y === 0) {
                console.log('[InlineScoreInput] Validation error: Division by zero');
                setErrors(prev => ({ ...prev, [assessmentId]: "Base cannot be 0" }));
                return;
            }
            convertedScore = (x / y) * maxScore;
            console.log('[InlineScoreInput] Fraction conversion:', { x, y, maxScore, convertedScore });
        } else {
            const z = Number(rawScoreInput);
            if (isNaN(z)) {
                console.log('[InlineScoreInput] Validation error: Not a number');
                setErrors(prev => ({ ...prev, [assessmentId]: "Score must be a number" }));
                return;
            }
            convertedScore = z;
            console.log('[InlineScoreInput] Direct score:', { rawInput: z, convertedScore });
        }

        if (convertedScore > maxScore) {
            console.log('[InlineScoreInput] Validation error: Exceeds max score', { convertedScore, maxScore });
            setErrors(prev => ({ ...prev, [assessmentId]: `Max is ${maxScore}` }));
            return;
        }
        if (convertedScore < 0) {
            console.log('[InlineScoreInput] Validation error: Negative score');
            setErrors(prev => ({ ...prev, [assessmentId]: "Cannot be negative" }));
            return;
        }

        const finalScore = `${Number(convertedScore.toFixed(1))}/${basis}`;
        console.log('[InlineScoreInput] ✅ Score validated and formatted:', {
            studentId: student.id,
            studentName: student.name,
            subjectId,
            assessmentId,
            assessmentName: assessment.name,
            rawInput: rawScoreInput,
            convertedScore,
            finalScore
        });

        console.log('[InlineScoreInput] 💾 Calling updateStudentScores (saving to local cache)...');
        updateStudentScores(student.id, subjectId, assessment.id, [finalScore]);

        // Clear modification flag after successful save
        setModifiedFields(prev => {
            const newSet = new Set(prev);
            newSet.delete(assessmentId);
            return newSet;
        });
        console.log('[InlineScoreInput] ✅ Score committed successfully');
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
        <tr className="border-b hover:bg-gray-50">
            <td className="p-4 text-center text-gray-500 font-medium">{index}</td>
            <td className="p-4 font-medium text-gray-900">{student.name}</td>
            {assessments.map(assessment => {
                const scores = getStudentScores(student.id, subjectId, assessment.id);

                if (scores.length > 1) {
                    const displayScore = calculateDisplayScore(scores, assessment);
                    return (
                        <td key={assessment.id} className="p-4 text-center">
                            {MULTI_SCORE_ENTRY_ENABLED ? (
                                <button
                                    onClick={() => onOpenModal(student, assessment)}
                                    className="w-full text-center px-2 py-1 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                >
                                    <span className="font-mono text-blue-700">{formatScore(displayScore)}</span>
                                    <div className="text-xs text-gray-500">{scores.length} score(s)</div>
                                </button>
                            ) : (
                                <div className="w-full text-center px-2 py-1 rounded-md">
                                    <span className="font-mono text-gray-700">{formatScore(displayScore)}</span>
                                    <div className="text-xs text-gray-500">{scores.length} score(s)</div>
                                </div>
                            )}
                        </td>
                    );
                }

                return (
                    <td key={assessment.id} className="p-2 text-center align-top">
                        <div className="flex flex-col items-center">
                            <div className="flex items-center space-x-1">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={inlineValues[assessment.id] || ''}
                                    onChange={(e) => handleValueChange(assessment.id, e.target.value)}
                                    onBlur={() => handleSave(assessment.id)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave(assessment.id); (e.target as HTMLInputElement).blur(); } }}
                                    placeholder={assessment.name.toLowerCase().includes('exam') ? 'e.g., 85' : '-'}
                                    className="w-24 p-1 text-center font-mono bg-white border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                    aria-label={`Score for ${student.name} in ${assessment.name}`}
                                    disabled={readOnly}
                                />
                                {MULTI_SCORE_ENTRY_ENABLED && !readOnly && (
                                    <button
                                        onClick={() => onOpenModal(student, assessment)}
                                        className="p-1 text-gray-500 border border-gray-300 rounded-full hover:bg-blue-100 hover:text-blue-600 hover:border-blue-400 transition-colors"
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
            <td className="p-4 text-center font-bold text-gray-800">
                {formatScore(totalWeightedScoreForDisplay)}
            </td>
        </tr>
    );
};

export default InlineScoreInput;