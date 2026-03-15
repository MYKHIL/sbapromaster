import React from 'react';
import { useData, getItemId } from '../context/DataContext';

interface PreviewDataModalProps {
    isOpen: boolean;
    onClose: () => void;
    pendingCount: number;
    onSave: () => void;
    isSyncing: boolean;
    onRefresh?: () => void;
    isOnline: boolean;
    hasLocalChanges: boolean;
}

const PreviewDataModal: React.FC<PreviewDataModalProps> = ({
    isOpen,
    onClose,
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
        classes,
        grades,
        revertPendingChanges,
        revertAllPendingChanges,
        getPendingUploadData,
        getOriginalItem
    } = useData();

    // Compute live data on every render
    const liveData = getPendingUploadData();

    if (!isOpen) return null;

    // Helper functions for humanizing data
    const getStudentName = (id: number) => {
        const s = students.find(s => s.id === id) || getOriginalItem('students', id);
        if (!s) return `Student #${id}`;
        return `${s.name} | ${s.class || 'No Class'} | #${id}`;
    };
    const getSubjectName = (id: number | string) => {
        const s = subjects.find(s => String(s.id) === String(id)) || getOriginalItem('subjects', id);
        return s ? s.subject : `Subject #${id}`;
    };
    const getClassName = (id: number | string) => {
        const c = classes.find(c => String(c.id) === String(id)) || getOriginalItem('classes', id);
        return c ? c.name : `Class #${id}`;
    };
    const getGradeName = (id: number | string) => {
        const g = grades.find(g => String(g.id) === String(id)) || getOriginalItem('grades', id);
        return g ? `${g.name} (${g.minScore}% - ${g.maxScore}%)` : `Grade #${id}`;
    };
    const getAssessmentName = (id: number | string) => {
        const a = assessments.find(x => String(x.id) === String(id)) || getOriginalItem('assessments', id);
        return a ? (a.title || a.name) : `Assessment #${id}`;
    };

    const handleRevert = (field: string, id?: number | string) => {
        if (confirm('Discard this change?')) {
            // @ts-ignore
            revertPendingChanges(field, id);
        }
    };

    const handleRevertAll = () => {
        if (confirm('Are you sure you want to discard ALL pending changes? This cannot be undone.')) {
            revertAllPendingChanges();
            onClose();
        }
    };

    const renderPreviewContent = () => {
        if (!liveData || Object.keys(liveData).length === 0) {
            return <div className="text-gray-500 text-center py-8">No pending changes found.</div>;
        }

        return (
            <div className="space-y-6">
                {Object.entries(liveData).map(([key, value]: [string, any]) => {
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
                                            {items.map((rawId: any) => {
                                                // Deletions are stored as string IDs, not objects
                                                const id = String(rawId);
                                                // Look up the friendly name from each collection by ID
                                                let label = `ID: ${id}`;
                                                if (delField === 'students') {
                                                    const s = students.find(s => String(s.id) === id) || getOriginalItem('students', id);
                                                    label = s ? `${s.name} | ${s.class || 'No Class'} | #${id}` : `Student #${id}`;
                                                } else if (delField === 'classes') {
                                                    label = getClassName(id);
                                                } else if (delField === 'subjects') {
                                                    label = getSubjectName(id);
                                                } else if (delField === 'assessments') {
                                                    label = getAssessmentName(id);
                                                } else if (delField === 'grades') {
                                                    label = getGradeName(id);
                                                }

                                                return (
                                                    <li key={id} className="text-sm text-red-700 flex items-center gap-2 justify-between group">
                                                        <div className="flex items-center gap-2">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                            <span className="line-through opacity-75">{label}</span>
                                                        </div>
                                                        <button
                                                            onClick={() => handleRevert(delField, id)}
                                                            className="text-gray-400 hover:text-green-600 opacity-0 group-hover:opacity-100 transition-all p-1"
                                                            title="Restore (Cancel Deletion)"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                                            </svg>
                                                        </button>
                                                    </li>
                                                );
                                            })}
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
                                <span>{key === 'classes' ? 'Teachers / Classes' : key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                        {Array.isArray(value) ? value.length : 1} items
                                    </span>
                                    {!Array.isArray(value) && (
                                        <button
                                            onClick={() => handleRevert(key)}
                                            className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                                            title="Revert Changes"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
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
                                                const scoreStr = Array.isArray(scores) ? scores.filter(s => s && typeof s === 'string' && s.trim() !== '').join(', ') : '';
                                                return scoreStr ? `${aName}: [${scoreStr}]` : null;
                                            }).filter(Boolean).join(', ');

                                            return (
                                                <li key={score.id} className="text-sm bg-gray-50 p-2 rounded border border-gray-100 flex justify-between group items-start">
                                                    <div>
                                                        <div className="font-medium text-gray-800">{studentName}</div>
                                                        <div className="text-gray-500 text-xs flex justify-between">
                                                            <span>{subjectName}</span>
                                                        </div>
                                                        {updates && <div className="text-blue-600 font-mono text-xs mt-1">{updates}</div>}
                                                    </div>
                                                    <button
                                                        onClick={() => handleRevert('scores', score.id)}
                                                        className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                                                        title="Revert this score"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}

                                {/* GENERIC LIST PREVIEW */}
                                {Array.isArray(value) && key !== 'scores' && (
                                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {value.map((item: any) => {
                                            const id = getItemId(item);
                                            const label = item.name || item.subject || item.title ||
                                                (item.studentId ? getStudentName(item.studentId) :
                                                    item?._isLocallyCreated && key === 'students' ? `${item.name} | ${item.class || 'No Class'} | #${id}` :
                                                    item.classId ? getClassName(item.classId) : `ID: ${id}`);

                                            return (
                                                <li key={id} className="text-sm bg-gray-50 p-2 rounded border border-gray-100 flex justify-between items-start group">
                                                    <div>
                                                        <span className="font-medium block">{label}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleRevert(key, id)}
                                                        className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                                                        title="Revert this change"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}

                                {/* SETTINGS PREVIEW */}
                                {key === 'settings' && (
                                    <ul className="space-y-1">
                                        {Object.entries(value).map(([k, v]) => {
                                            const isImage = k === 'logo' || k === 'headmasterSignature' || (typeof v === 'string' && v.startsWith('data:image'));
                                            const displayValue = isImage ? `[${k.includes('logo') ? 'Logo' : 'Signature'} Image]` : String(v);
                                            
                                            return (
                                                <li key={k} className="text-sm bg-gray-50 p-2 rounded border border-gray-100 flex justify-between items-center group hover:bg-white transition-colors">
                                                    <span className="font-medium capitalize text-gray-700">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        <span 
                                                            className={`${isImage ? 'text-blue-600 font-semibold' : 'text-gray-500'} text-xs truncate max-w-[150px]`} 
                                                            title={isImage ? 'Base64 Image Data' : String(v)}
                                                        >
                                                            {displayValue}
                                                        </span>
                                                        <button
                                                            onClick={() => handleRevert('settings', k)}
                                                            className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                                                            title="Revert this setting"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
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
                    <div className="flex items-center gap-2">
                        {pendingCount > 0 && (
                            <button
                                onClick={handleRevertAll}
                                className="text-sm text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1.5 rounded transition-colors mr-2"
                            >
                                Clear All
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-200 rounded-full"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
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
