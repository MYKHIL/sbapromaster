import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export interface Breadcrumb {
    action: string;
    timestamp: string;
}

interface UserActionContextType {
    breadcrumbs: Breadcrumb[];
    recordAction: (action: string) => void;
    clearBreadcrumbs: () => void;
}

const UserActionContext = createContext<UserActionContextType | undefined>(undefined);

const MAX_BREADCRUMBS = 20;

export const UserActionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);

    const recordAction = useCallback((action: string) => {
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setBreadcrumbs(prev => {
            const next = [...prev, { action, timestamp }];
            if (next.length > MAX_BREADCRUMBS) {
                return next.slice(next.length - MAX_BREADCRUMBS);
            }
            return next;
        });
        // Also log to console for developer convenience
        0 && console.log(`[Action] ${timestamp}: ${action}`);
    }, []);

    const clearBreadcrumbs = useCallback(() => {
        setBreadcrumbs([]);
    }, []);

    return (
        <UserActionContext.Provider value={{ breadcrumbs, recordAction, clearBreadcrumbs }}>
            {children}
        </UserActionContext.Provider>
    );
};

export const useUserAction = () => {
    const context = useContext(UserActionContext);
    if (!context) {
        throw new Error('useUserAction must be used within a UserActionProvider');
    }
    return context;
};
