import React from 'react';
import { useUser } from '../context/UserContext';
import type { Page } from '../types';

interface TeacherPageRedirectProps {
    currentPage: Page;
    setCurrentPage: (page: Page) => void;
}

/**
 * Component to redirect teachers to Score Entry on first login
 */
export const TeacherPageRedirect: React.FC<TeacherPageRedirectProps> = ({ currentPage, setCurrentPage }) => {
    const { currentUser } = useUser();
    const hasRedirected = React.useRef(false);

    React.useEffect(() => {
        // Only redirect once per session and only for teachers on first login
        if (!hasRedirected.current && currentUser?.role === 'Teacher') {
            const hasVisitedBefore = localStorage.getItem('lastVisitedPage');

            // If teacher hasn't visited before (first login), redirect to Score Entry
            if (!hasVisitedBefore) {
                setCurrentPage('Score Entry');
            }

            hasRedirected.current = true;
        }
    }, [currentUser, setCurrentPage]);

    return null;
};
