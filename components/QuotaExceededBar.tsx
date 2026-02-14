import React, { useState, useEffect } from 'react';

interface QuotaExceededBarProps {
    onClose: () => void;
}

const QuotaExceededBar: React.FC<QuotaExceededBarProps> = ({ onClose }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [resetMessage, setResetMessage] = useState('tomorrow at 9:00 AM');

    useEffect(() => {
        // Trigger enter animation
        setIsVisible(true);

        // Dynamic Reset Time Calculation
        const now = new Date();
        const resetTime = new Date(now);
        resetTime.setHours(9, 0, 0, 0);

        // If it's currently BEFORE 9 AM, the reset is TODAY at 9 AM.
        // If it's AFTER 9 AM, the reset is TOMORROW at 9 AM.
        if (now < resetTime) {
            setResetMessage('today at 9:00 AM');
        } else {
            setResetMessage('tomorrow at 9:00 AM');
        }

        // NO AUTO-DISMISS for the bar
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        // Wait for exit animation to finish before calling onClose (which unmounts)
        setTimeout(() => {
            onClose();
        }, 300);
    };

    return (
        <div className={`fixed top-0 left-0 right-0 z-[10000] transform transition-transform duration-300 ${isVisible ? 'translate-y-0' : '-translate-y-full'}`}>
            <div className="bg-amber-100 border-b border-amber-200 shadow-md w-full px-4 py-3 flex items-center justify-center gap-4">
                <div className="flex items-center gap-3 max-w-5xl w-full">
                    <div className="flex-shrink-0 text-amber-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-amber-900">
                            Daily Data Limit Reached
                        </p>
                        <p className="text-xs md:text-sm text-amber-800 leading-tight">
                            Changes cannot be saved right now. You can still view your data. Please try again {resetMessage}.
                        </p>
                    </div>
                    <button
                        onClick={handleClose}
                        className="flex-shrink-0 bg-amber-200 hover:bg-amber-300 text-amber-800 rounded-full p-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 max-h-8 max-w-8 flex items-center justify-center"
                        title="Dismiss"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L10 8.586 5.707 4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QuotaExceededBar;
