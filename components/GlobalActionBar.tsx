import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { useUser } from '../context/UserContext';
import PreviewDataModal from './PreviewDataModal';
import { Page } from '../types';

interface GlobalActionBarProps {
    onOpenDebugModal?: () => void;
    currentPage?: Page;
}

const GlobalActionBar: React.FC<GlobalActionBarProps> = ({ onOpenDebugModal, currentPage }) => {
    const {
        saveToCloud,
        refreshFromCloud,
        hasLocalChanges,
        pendingCount,
        isSyncing,
        isOnline,
        getPendingUploadData,
        // Data for humanizing preview
        students,
        subjects,
        assessments,
        classes
    } = useData();
    const { currentUser } = useUser();

    const [isDebugModalOpen, setIsDebugModalOpen] = useState(false);
    const [debugData, setDebugData] = useState<any>(null);

    // Only show for authenticated users
    if (!currentUser) return null;

    const isAdmin = currentUser.role === 'Admin';

    const handleShowDebugData = () => {
        const data = getPendingUploadData();
        setDebugData(data);
        setIsDebugModalOpen(true);
    };

    const handleCloseDebugModal = () => {
        setIsDebugModalOpen(false);
        setDebugData(null);
    };

    // Helper functions for humanizing data
    const getStudentName = (id: number) => students.find(s => s.id === id)?.name || `Student #${id}`;
    const getSubjectName = (id: number) => subjects.find(s => s.id === id)?.subject || `Subject #${id}`;
    const getAssessmentName = (id: number) => {
        const a = assessments.find(x => x.id === id);
        return a ? (a.title || a.name) : `Assessment #${id}`;
    };
    const getClassName = (id: number) => classes.find(c => c.id === id)?.name || `Class #${id}`;

    return (
        <>
            <div className={`fixed top-24 right-4 z-[50] ${currentPage === 'Score Entry' ? 'hidden lg:block' : ''}`}>
                <div className="flex items-center gap-2 px-3 py-2 rounded-2xl shadow-lg border border-gray-200 backdrop-blur-sm bg-white/95">
                    {/* Preview Button - Only show if there are actual changes to preview */}
                    {pendingCount > 0 && (
                        <button
                            onClick={handleShowDebugData}
                            className="p-2.5 text-gray-500 hover:text-blue-600 bg-gray-100 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200 relative"
                            title="Preview data to be saved"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                        </button>
                    )}

                    {/* Refresh Button (Admin Only) */}
                    {isAdmin && (
                        <button
                            onClick={() => refreshFromCloud()}
                            disabled={isSyncing || !isOnline}
                            className={`p-2.5 text-gray-500 hover:text-green-600 bg-gray-100 hover:bg-green-50 rounded-lg transition-colors border border-gray-200 ${(isSyncing || !isOnline) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title="Refresh data from cloud (Admin Only)"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                    )}

                    {/* Save Button */}
                    <button
                        onClick={() => saveToCloud(true)}
                        disabled={pendingCount === 0 || isSyncing || !isOnline}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg transition-all shadow-md ${(pendingCount === 0 || isSyncing || !isOnline)
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg'
                            }`}
                        title={
                            !isOnline
                                ? "You are offline"
                                : pendingCount === 0
                                    ? "No unsaved changes"
                                    : "Save all pending changes to the cloud"
                        }
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
                    <div className="text-[10px] font-bold text-amber-600 text-right mt-1 px-1 leading-tight max-w-[250px] shadow-sm backdrop-blur-sm bg-white/80 rounded p-1 ml-auto animate-pulse">
                        Please SAVE when you complete all modifications
                    </div>
                )}
            </div>

            {/* Debug Data Modal */}
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
        </>
    );
};

export default GlobalActionBar;
