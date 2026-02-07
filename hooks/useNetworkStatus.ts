import { useState, useEffect } from 'react';

/**
 * Hook to detect network connectivity status
 * Uses navigator.onLine API and online/offline events
 */
export const useNetworkStatus = () => {
    const [isOnline, setIsOnline] = useState(() => {
        // Check if window exists (client-side only)
        if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
            return navigator.onLine;
        }
        return true; // Assume online during SSR
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleOnline = () => {
            console.log('Network: Online');
            setIsOnline(true);
        };

        const handleOffline = () => {
            console.log('Network: Offline');
            setIsOnline(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return isOnline;
};
