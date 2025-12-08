import React, { useState } from 'react';
import type { Assessment } from '../types';

interface ScoreManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    studentName: string;
    assessment: Assessment;
    scores: string[];
    onAddScore: (newScore: string) => void;
    onDeleteScore: (index: number) => void;
    onUpdateScore: (index: number, updatedScore: string) => void;
    isExam: boolean;
}

const ScoreManagementModal: React.FC<ScoreManagementModalProps> = ({ isOpen, onClose, studentName, assessment, scores, onAddScore, onDeleteScore, onUpdateScore, isExam }) => {
    const [newScore, setNewScore] = useState('');
    const [addError, setAddError] = useState('');
    const [editErrors, setEditErrors] = useState<Record<number, string | undefined>>({});

    // Filter input to only allow numbers, forward slash, and decimal point
    const validateInput = (value: string): string => {
        return value.replace(/[^0-9/.]/g, '');
    };

    const inputStyles = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500";

    const validateAndFormatScore = (rawScoreInput: string): { finalScore?: string; error?: string } => {
        let convertedScore: number;
        const trimmedInput = rawScoreInput.trim();
        const maxScore = isExam ? 100 : assessment.weight;
        const basis = isExam ? 100 : assessment.weight;

        if (!trimmedInput) {
            return { error: "Score cannot be empty." };
        }

        if (trimmedInput.includes('/')) {
            const parts = trimmedInput.split('/');
            if (parts.length !== 2) {
                return { error: "Invalid format. Use 'x' or 'x/y'." };
            }
            const [x, y] = parts.map(s => s.trim()).map(Number);
            if (isNaN(x) || isNaN(y)) {
                return { error: "Score and basis must be numbers." };
            }
            if (y === 0) {
                return { error: "The basis (y) cannot be zero." };
            }
            convertedScore = (x / y) * maxScore;
        } else {
            const z = Number(trimmedInput);
            if (isNaN(z)) {
                return { error: "Score must be a number." };
            }
            convertedScore = z;
        }

        if (convertedScore > maxScore) {
            return { error: `Score cannot be greater than the max of ${maxScore}.` };
        }

        if (convertedScore < 0) {
            return { error: "Score cannot be negative." };
        }

        const finalScore = `${Number(convertedScore.toFixed(1))}/${basis}`;
        return { finalScore };
    };

    const handleAddScore = () => {
        const { finalScore, error } = validateAndFormatScore(newScore);
        if (error) {
            setAddError(error);
        } else if (finalScore) {
            setAddError('');
            onAddScore(finalScore);
            setNewScore('');
        }
    };

    const handleUpdateScore = (index: number, value: string) => {
        if (scores[index] === value.trim()) {
            setEditErrors(prev => ({ ...prev, [index]: undefined }));
            return;
        }

        const { finalScore, error } = validateAndFormatScore(value);
        if (error) {
            setEditErrors(prev => ({ ...prev, [index]: error }));
        } else if (finalScore) {
            setEditErrors(prev => ({ ...prev, [index]: undefined }));
            onUpdateScore(index, finalScore);
        }
    };

    const handleClose = () => {
        setAddError('');
        setEditErrors({});
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 animate-fade-in-scale">
            <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md m-4">
                <h2 className="text-xl font-bold text-gray-800">Manage Scores</h2>
                <p className="text-sm text-gray-600 mt-1">
                    For <span className="font-semibold">{studentName}</span> in <span className="font-semibold">{assessment.name}</span> (Max: {isExam ? 100 : assessment.weight})
                </p>

                <div className="mt-4 space-y-1 max-h-48 overflow-y-auto pr-2">
                    {scores.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">No scores added yet.</p>
                    ) : (
                        scores.map((score, index) => (
                            <div key={`${studentName}-${assessment.id}-${index}`}>
                                <div className="flex justify-between items-center bg-gray-100 p-2 rounded-md">
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        pattern="[0-9./]*"
                                        defaultValue={score}
                                        onBlur={(e) => {
                                            const filtered = validateInput(e.target.value);
                                            e.target.value = filtered;
                                            handleUpdateScore(index, filtered);
                                        }}
                                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                        className="font-mono text-gray-800 bg-transparent outline-none w-full px-1"
                                        aria-label={`Edit score ${index + 1}`}
                                    />
                                    <button onClick={() => onDeleteScore(index)} className="text-red-500 hover:text-red-700 ml-2 flex-shrink-0" title="Delete Score">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                                {editErrors[index] && <p className="text-red-500 text-xs mt-1 pl-2">{editErrors[index]}</p>}
                            </div>
                        ))
                    )}
                </div>

                <div className="mt-4 border-t pt-4">
                    <label className="block text-sm font-medium text-gray-700">New Score (e.g., '8' or '15/20')</label>
                    <div className="flex items-center space-x-2 mt-1">
                        <input
                            type="text"
                            inputMode="decimal"
                            pattern="[0-9./]*"
                            value={newScore}
                            onChange={(e) => setNewScore(validateInput(e.target.value))}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleAddScore(); }}
                            className={inputStyles + ' flex-grow'}
                            placeholder={`Score out of ${isExam ? 100 : assessment.weight}`}
                        />
                        <button onClick={handleAddScore} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex-shrink-0">
                            Add
                        </button>
                    </div>
                    {addError && <p className="text-red-500 text-xs mt-1">{addError}</p>}
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        type="button"
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                        onClick={handleClose}
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ScoreManagementModal;