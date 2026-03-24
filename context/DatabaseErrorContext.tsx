import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useUserAction, type Breadcrumb } from './UserActionContext';

interface DatabaseErrorContextType {
    error: any | null;
    errorContext: 'read' | 'write' | null;
    breadcrumbs: Breadcrumb[];
    showError: (error: any, context?: 'read' | 'write') => void;
    clearError: () => void;
}

const DatabaseErrorContext = createContext<DatabaseErrorContextType | undefined>(undefined);

export const DatabaseErrorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [error, setError] = useState<any | null>(null);
    const [errorContext, setErrorContext] = useState<'read' | 'write' | null>(null);
    const [capturedBreadcrumbs, setCapturedBreadcrumbs] = useState<Breadcrumb[]>([]);
    const { breadcrumbs: currentBreadcrumbs, recordAction } = useUserAction();

    const showError = (error: any, context: 'read' | 'write' = 'read') => {
        const errorMsg = error?.message || error?.toString() || 'Unknown';
        recordAction(`DATABASE ERROR (${context}): ${errorMsg}`);
        console.error(`[DatabaseErrorContext] Database error occurred (${context}):`, error);
        setError(error);
        setErrorContext(context);
        // Capture a snapshot of breadcrumbs at the time of error
        setCapturedBreadcrumbs([...currentBreadcrumbs]);
    };

    const clearError = () => {
        setError(null);
        setErrorContext(null);
        setCapturedBreadcrumbs([]);
    };

    return (
        <DatabaseErrorContext.Provider value={{ error, errorContext, breadcrumbs: capturedBreadcrumbs, showError, clearError }}>
            {children}
        </DatabaseErrorContext.Provider>
    );
};

export const useDatabaseError = () => {
    const context = useContext(DatabaseErrorContext);
    if (!context) {
        throw new Error('useDatabaseError must be used within a DatabaseErrorProvider');
    }
    return context;
};
