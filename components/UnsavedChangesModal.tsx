import React from 'react';

interface UnsavedChangesModalProps {
    isOpen: boolean;
    onStay: () => void;
    onDiscard: () => void;
    onQueueAndMove: () => void;
}

const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({ isOpen, onStay, onDiscard, onQueueAndMove }) => {
    if (!isOpen) return null;

    return (
        <div className="sba-modal fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-slideUp border border-gray-100">
                {/* Header */}
                <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-2 rounded-xl">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold font-outfit">Unqueued Changes</h2>
                            <p className="text-blue-100 text-sm mt-0.5">You have remarks that haven't been queued.</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-8">
                    <p className="text-gray-600 leading-relaxed text-center">
                        Would you like to <span className="font-bold text-blue-700">Queue</span> your current changes before moving to the next student? 
                    </p>
                    <p className="text-gray-400 text-xs text-center mt-4 italic">
                        Unsavied data will be permanently lost if you choose to discard.
                    </p>
                </div>

                {/* Footer / Actions */}
                <div className="p-6 bg-gray-50 flex flex-col gap-3 border-t border-gray-100">
                    <button
                        onClick={onQueueAndMove}
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all duration-200 shadow-md transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Queue Changes and Move
                    </button>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={onDiscard}
                            className="bg-white border border-red-200 text-red-600 font-semibold py-3 px-4 rounded-xl hover:bg-red-50 transition-colors duration-200 text-sm"
                        >
                            Discard Changes
                        </button>
                        <button
                            onClick={onStay}
                            className="bg-gray-100 text-gray-700 font-semibold py-3 px-4 rounded-xl hover:bg-gray-200 transition-colors duration-200 text-sm"
                        >
                            Stay Here
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UnsavedChangesModal;
