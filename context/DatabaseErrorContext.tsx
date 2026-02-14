import React, { createContext, useContext, useState, ReactNode } from 'react';

interface DatabaseErrorContextType {
    error: any | null;
    errorContext: 'read' | 'write' | null;
    showError: (error: any, context?: 'read' | 'write') => void;
    clearError: () => void;
}

const DatabaseErrorContext = createContext<DatabaseErrorContextType | undefined>(undefined);

export const DatabaseErrorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [error, setError] = useState<any | null>(null);
    const [errorContext, setErrorContext] = useState<'read' | 'write' | null>(null);

    const showError = (error: any, context: 'read' | 'write' = 'read') => {
        console.error(`[DatabaseErrorContext] Database error occurred (${context}):`, error);
        setError(error);
        setErrorContext(context);
    };

    const clearError = () => {
        setError(null);
        setErrorContext(null);
    };

    return (
        <DatabaseErrorContext.Provider value={{ error, errorContext, showError, clearError }}>
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
