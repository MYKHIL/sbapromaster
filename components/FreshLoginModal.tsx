import React, { useState, useEffect } from 'react'; 
import { User } from '../types';
import { useData } from '../context/DataContext';

interface FreshLoginModalProps {
    currentUser: User | null;
}

const FreshLoginModal: React.FC<FreshLoginModalProps> = ({ currentUser }) => {
    const { refreshFromCloud, isFetching } = useData();
    const [isVisible, setIsVisible] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const lastUserRef = React.useRef<User | null>(null);

    // Show modal on fresh login
    useEffect(() => {
        // Fresh login: user went from null to non-null
        if (currentUser && !lastUserRef.current) {
            console.log('[FreshLoginModal] Fresh login detected for user:', currentUser.name);
            setIsVisible(true);
        }
        lastUserRef.current = currentUser;
    }, [currentUser]);

    const handleRefreshData = async () => {
        setIsRefreshing(true);
        try {
            console.log('[FreshLoginModal] User clicked Refresh Data button');
            await refreshFromCloud();
            console.log('[FreshLoginModal] Data refreshed successfully');
            // Close modal after successful refresh
            setTimeout(() => {
                setIsVisible(false);
            }, 500);
        } catch (err) {
            console.error('[FreshLoginModal] Refresh failed:', err);
            // Keep modal open, show error
        } finally {
            setIsRefreshing(false);
        }
    };

    if (!isVisible || !currentUser) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 animate-fade-in-scale">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md m-4 text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                    <svg className="h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Welcome, {currentUser.name}!</h3>
                <p className="text-gray-600 mb-6">
                    To ensure you have the latest data from the cloud, please click the button below to load all data.
                </p>
                <button
                    onClick={handleRefreshData}
                    disabled={isRefreshing || isFetching}
                    className={`w-full py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
                        isRefreshing || isFetching
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                    }`}
                >
                    {isRefreshing || isFetching ? (
                        <>
                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Loading Data...
                        </>
                    ) : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Load All Data
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default FreshLoginModal;
