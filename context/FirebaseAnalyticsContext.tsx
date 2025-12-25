import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { registerTracking } from '../services/analyticsTracking';

interface FirebaseOperation {
    id: string;
    timestamp: number;
    type: 'read' | 'write';
    operation: string; // e.g., 'getDoc', 'setDoc', 'getDocs'
    collection?: string;
    docCount?: number;
    description: string;
}

interface FirebaseAnalyticsContextType {
    operations: FirebaseOperation[];
    trackRead: (operation: string, collection?: string, docCount?: number, description?: string) => void;
    trackWrite: (operation: string, collection?: string, description?: string) => void;
    clearHistory: () => void;
    getTotalReads: () => number;
    getTotalWrites: () => number;
    getStorageUsage: () => { used: number; total: number };
}

const FirebaseAnalyticsContext = createContext<FirebaseAnalyticsContextType | undefined>(undefined);

export const useFirebaseAnalytics = () => {
    const context = useContext(FirebaseAnalyticsContext);
    if (!context) {
        throw new Error('useFirebaseAnalytics must be used within FirebaseAnalyticsProvider');
    }
    return context;
};

export const FirebaseAnalyticsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [operations, setOperations] = useState<FirebaseOperation[]>([]);

    const trackRead = (operation: string, collection?: string, docCount: number = 1, description?: string) => {
        const op: FirebaseOperation = {
            id: `${Date.now()}-${Math.random()}`,
            timestamp: Date.now(),
            type: 'read',
            operation,
            collection,
            docCount,
            description: description || `Read from ${collection || 'database'}`
        };
        setOperations(prev => [...prev, op]);
        console.log(`[Firebase Analytics] 📖 READ: ${op.description} (${docCount} doc${docCount !== 1 ? 's' : ''})`);
    };

    const trackWrite = (operation: string, collection?: string, description?: string) => {
        const op: FirebaseOperation = {
            id: `${Date.now()}-${Math.random()}`,
            timestamp: Date.now(),
            type: 'write',
            operation,
            collection,
            docCount: 1,
            description: description || `Write to ${collection || 'database'}`
        };
        setOperations(prev => [...prev, op]);
        console.log(`[Firebase Analytics] ✍️ WRITE: ${op.description}`);
    };

    // Register tracking functions globally so firebaseService can use them
    useEffect(() => {
        registerTracking(trackRead, trackWrite);
        console.log('[Firebase Analytics] Tracking registered globally');

        return () => {
            // Unregister on unmount
            registerTracking(() => { }, () => { });
        };
    }, []);

    const clearHistory = () => {
        setOperations([]);
    };

    const getTotalReads = () => {
        return operations
            .filter(op => op.type === 'read')
            .reduce((sum, op) => sum + (op.docCount || 1), 0);
    };

    const getTotalWrites = () => {
        return operations.filter(op => op.type === 'write').length;
    };

    const getStorageUsage = () => {
        let used = 0;
        try {
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    used += localStorage.getItem(key)?.length || 0;
                }
            }
        } catch (e) {
            console.warn('Could not calculate localStorage usage');
        }

        // Estimate quota (typically 5-10MB, we'll use 5MB)
        const total = 5 * 1024 * 1024; // 5MB in bytes
        return { used, total };
    };

    const value: FirebaseAnalyticsContextType = {
        operations,
        trackRead,
        trackWrite,
        clearHistory,
        getTotalReads,
        getTotalWrites,
        getStorageUsage
    };

    return (
        <FirebaseAnalyticsContext.Provider value={value}>
            {children}
        </FirebaseAnalyticsContext.Provider>
    );
};
