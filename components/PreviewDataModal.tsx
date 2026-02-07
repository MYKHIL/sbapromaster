import React from 'react';
import { useData } from '../context/DataContext';

interface PreviewDataModalProps {
    isOpen: boolean;
    onClose: () => void;
    debugData: any;
    pendingCount: number;
    onSave: () => void;
    isSyncing: boolean;
    isOnline: boolean;
    hasLocalChanges: boolean;
}

const PreviewDataModal: React.FC<PreviewDataModalProps> = ({
    isOpen,
    onClose,
    debugData,
    pendingCount,
    onSave,
    isSyncing,
    isOnline,
    hasLocalChanges
}) => {
    const {
        students,
        subjects,
        assessments,
        classes
    } = useData();

    if (!isOpen) return null;

    // Helper functions for humanizing data
    const getStudentName = (id: number) => students.find(s => s.id === id)?.name || `Student #${id}`;
    const getSubjectName = (id: number) => subjects.find(s => s.id === id)?.subject || `Subject #${id}`;
    const getAssessmentName = (id: number) => {
        const a = assessments.find(x => x.id === id);
        return a ? (a.title || a.name) : `Assessment #${id}`;
    };

    const renderPreviewContent = () => {
        if (!debugData || Object.keys(debugData).length === 0) {
            return <div className="text-gray-500 text-center py-8">No pending changes found.</div>;
        }

        return (
            <div className="space-y-6">
                {Object.entries(debugData).map(([key, value]: [string, any]) => {
                    // Filter out internal/auto-update fields from preview
                    if (key === 'activeSessions' || key === 'userLogs') return null;

                    // Handle Deletions Block
                    if (key === '_deletions') {
                        return (
                            <div key="_deletions" className="bg-red-50 p-4 rounded-lg border border-red-200 shadow-sm mb-4">
                                <h4 className="font-bold text-red-600 text-lg mb-3 border-b border-red-200 pb-2 flex justify-between items-center">
                                    <span>Deletions</span>
                                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">Pending Removal</span>
                                </h4>
                                {Object.entries(value as Record<string, any[]>).map(([delField, items]) => (
                                    <div key={delField} className="mb-4 last:mb-0">
                                        <h5 className="font-semibold text-red-800 capitalize mb-2 text-sm bg-red-100 px-2 py-1 rounded inline-block">
                                            {delField} ({items.length})
                                        </h5>
                                        <ul className="space-y-1 pl-1">
                                            {items.map((item: any) => (
                                                <li key={item.id} className="text-sm text-red-700 flex items-center gap-2">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    <span className="line-through opacity-75">{item.name || item.subject || item.title || (item.class ? `Student: ${item.name}` : `ID: ${item.id}`)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        );
                    }

                    if (!value) return null;
                    if (Array.isArray(value) && value.length === 0) return null;
                    if (typeof value === 'object' && Object.keys(value).length === 0) return null;

                    return (
                        <div key={key} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                            <h4 className="font-bold text-blue-600 text-lg mb-3 capitalize border-b pb-2 flex justify-between items-center">
                                <span>{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                    {Array.isArray(value) ? value.length : 1} items
                                </span>
                            </h4>

                            <div className="space-y-2">
                                {/* SCORES PREVIEW */}
                                {key === 'scores' && Array.isArray(value) && (
                                    <ul className="space-y-2">
                                        {value.map((score: any) => {
                                            if (!score) return null;
                                            const studentName = getStudentName(score.studentId);
                                            const subjectName = getSubjectName(score.subjectId);
                                            // Format assessment updates
                                            const updates = Object.entries(score.assessmentScores || {}).map(([aid, scores]: [string, any]) => {
                                                const aName = getAssessmentName(parseInt(aid));
                                                // @ts-ignore
                                                const scoreStr = Array.isArray(scores) ? scores.filter(s => s.trim() !== '').join(', ') : '';
                                                return scoreStr ? `${aName}: [${scoreStr}]` : null;
                                            }).filter(Boolean).join(', ');

                                            return (
                                                <li key={score.id} className="text-sm bg-gray-50 p-2 rounded border border-gray-100">
                                                    <div className="font-medium text-gray-800">{studentName}</div>
                                                    <div className="text-gray-500 text-xs flex justify-between">
                                                        <span>{subjectName}</span>
                                                    </div>
                                                    {updates && <div className="text-blue-600 font-mono text-xs mt-1">{updates}</div>}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}

                                {/* STUDENTS PREVIEW */}
                                {key === 'students' && Array.isArray(value) && (
                                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {value.map((s: any) => (
                                            <li key={s.id} className="text-sm bg-gray-50 p-2 rounded border border-gray-100">
                                                <span className="font-medium block">{s.name}</span>
                                                <span className="text-xs text-gray-500">{s.class ? `Class: ${s.class}` : 'No Class'}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                {/* CLASSES PREVIEW */}
                                {key === 'classes' && Array.isArray(value) && (
                                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {value.map((c: any) => (
                                            <li key={c.id} className="text-sm bg-gray-50 p-2 rounded border border-gray-100">
                                                <span className="font-medium">{c.name}</span>
                                                <div className="text-xs text-gray-500">{c.teacherName || 'No Teacher Assigned'}</div>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                {/* SUBJECTS PREVIEW */}
                                {key === 'subjects' && Array.isArray(value) && (
                                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {value.map((s: any) => (
                                            <li key={s.id} className="text-sm bg-gray-50 p-2 rounded border border-gray-100">
                                                <span className="font-medium">{s.subject}</span>
                                                <span className="text-xs text-gray-500 ml-2">({s.type})</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                {/* ASSESSMENTS PREVIEW */}
                                {key === 'assessments' && Array.isArray(value) && (
                                    <ul className="space-y-1">
                                        {value.map((a: any) => (
                                            <li key={a.id} className="text-sm bg-gray-50 p-2 rounded border border-gray-100 flex justify-between">
                                                <span className="font-medium">{a.name}</span>
                                                <span className="text-xs text-gray-600 font-mono">Weight: {a.weight}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                {/* USERS PREVIEW */}
                                {key === 'users' && Array.isArray(value) && (
                                    <ul className="space-y-1">
                                        {value.map((u: any) => (
                                            <li key={u.id} className="text-sm bg-gray-50 p-2 rounded border border-gray-100">
                                                <div className="font-medium">{u.name}</div>
                                                <div className="text-xs text-gray-500">{u.role} - {u.email}</div>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                {/* SETTINGS PREVIEW */}
                                {key === 'settings' && (
                                    <ul className="space-y-1">
                                        {Object.entries(value).map(([k, v]) => (
                                            <li key={k} className="text-sm bg-gray-50 p-2 rounded border border-gray-100 flex justify-between items-center bg-white">
                                                <span className="font-medium capitalize text-gray-700">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                                                <span className="text-xs text-gray-500 truncate max-w-[150px]" title={String(v)}>{String(v)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                {/* GRADES PREVIEW */}
                                {key === 'grades' && Array.isArray(value) && (
                                    <ul className="space-y-1">
                                        {value.map((g: any) => (
                                            <li key={g.id} className="text-sm bg-gray-50 p-2 rounded border border-gray-100 flex justify-between bg-white">
                                                <span className="font-medium text-gray-800">{g.name}</span>
                                                <span className="text-xs text-gray-500 font-mono">{g.minScore}% - {g.maxScore}%</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                {/* REPORT DATA PREVIEW */}
                                {(key === 'reportData' || key === 'classData') && (
                                    <div className="text-sm bg-yellow-50 p-3 rounded border border-yellow-200 text-yellow-800 flex items-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <span>Updated {key === 'reportData' ? 'Student Reports' : 'Class Remarks'} for {Object.keys(value).length} items.</span>
                                    </div>
                                )}

                                {/* Catch-all for unknown fields (Hidden or Simplified) */}
                                {key !== 'scores' && key !== 'students' && key !== 'classes' && key !== 'subjects' && key !== 'assessments' && key !== 'users' && key !== 'settings' && key !== 'grades' && key !== 'reportData' && key !== 'classData' && key !== '_deletions' && (
                                    <div className="text-xs text-gray-400 italic p-2 border border-dashed rounded">
                                        Modified data in {key} (Preview not available)
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-fadeIn">
                <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <span className="bg-blue-100 text-blue-600 p-2 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </span>
                        Pending Changes Preview
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-200 rounded-full"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50">
                    {renderPreviewContent()}
                </div>
                <div className="p-5 border-t border-gray-200 bg-white rounded-b-xl flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    <div className="text-sm text-gray-500">
                        <strong>Total Pending Items:</strong> {pendingCount}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium border border-transparent hover:border-gray-200"
                        >
                            Close Preview
                        </button>
                        <button
                            onClick={() => {
                                onSave();
                                onClose();
                            }}
                            disabled={!hasLocalChanges || isSyncing || !isOnline}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                            </svg>
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PreviewDataModal;
