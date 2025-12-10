import React, { createContext, useContext, useState, ReactNode } from 'react';

interface DatabaseErrorContextType {
    error: any | null;
    showError: (error: any) => void;
    clearError: () => void;
}

const DatabaseErrorContext = createContext<DatabaseErrorContextType | undefined>(undefined);

export const DatabaseErrorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [error, setError] = useState<any | null>(null);

    const showError = (error: any) => {
        console.error('[DatabaseErrorContext] Database error occurred:', error);
        setError(error);
    };

    const clearError = () => {
        setError(null);
    };

    return (
        <DatabaseErrorContext.Provider value={{ error, showError, clearError }}>
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
