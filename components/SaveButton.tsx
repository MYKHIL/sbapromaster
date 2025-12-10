import React from 'react';

interface SaveButtonProps {
    onClick: () => void;
    isDirty: boolean;
    isSyncing: boolean;
    isOnline: boolean;
    label?: string;
}

const SaveButton: React.FC<SaveButtonProps> = ({
    onClick,
    isDirty,
    isSyncing,
    isOnline,
    label = 'SAVE'
}) => {
    const disabled = !isDirty || isSyncing || !isOnline;

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg transition-all shadow-md ${disabled
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg'
                }`}
            title={
                !isOnline
                    ? "You are offline"
                    : !isDirty
                        ? "No unsaved changes"
                        : "Save changes to the cloud"
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
                    <span className="text-sm font-bold">{label}</span>
                </>
            )}
        </button>
    );
};

export default SaveButton;
