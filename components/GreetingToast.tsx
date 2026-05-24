import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User } from '../types';
import { useData } from '../context/DataContext';

interface GreetingToastProps {
    currentUser: User | null;
    currentPage: string;
}

const GREETINGS = {
    morning: ["Good morning", "Rise and shine", "Top of the morning"],
    afternoon: ["Good afternoon", "Hope your day is going well", "Good day"],
    evening: ["Good evening", "Hope you had a productive day", "Wrapping up?"],
    random: [
        "Ready to be productive?",
        "Let's get things done!",
        "Welcome back!",
        "Great to see you!",
        "Your students are lucky to have you!",
        "Making a difference today!",
        "SBA Pro Master is ready for you."
    ]
};

const PAGE_MESSAGES: Record<string, string[]> = {
    'Dashboard': ["Overview of your school's performance.", "Check out the latest stats.", "Your command center."],
    'Students': ["Manage your student records here.", "Update student profiles.", "View and edit student details."],
    'Subjects': ["Configure school subjects.", "Assign facilitators to subjects.", "Manage curriculum."],
    'Classes & Teachers': ["Manage comments and teacher details.", "Class teacher assignments.", "Edit teacher signatures."],
    'Score Entry': ["Enter assessment scores.", "Record student marks efficiently.", "Keep grading up to date."],
    'Report Viewer': ["Generate and view report cards.", "Print student reports.", "Analyze student performance."],
    'Assessment Types': ["Define assessment categories.", "Set up grading weights.", "Configure exam types."],
    'Grading System': ["Set grade ranges and remarks.", "Configure grading logic.", "Define pass/fail criteria."],
    'School Setup': ["Configure general school settings.", "Update school info.", "Manage academic years."],
    'Data Management': ["Backup and restore data.", "Import/Export records.", "Manage cloud sync."]
};

const GreetingToast: React.FC<GreetingToastProps> = ({ currentUser, currentPage }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [lastPage, setLastPage] = useState('');

    const { settings } = useData();
    const [hasShownAnnouncement, setHasShownAnnouncement] = useState(false);

    // Refs to manage timers and prevent race conditions
    const autoHideTimerRef = useRef<NodeJS.Timeout | null>(null);
    const navTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isManuallyDismissedRef = useRef(false);

    const handleClose = useCallback((e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setIsVisible(false);
        isManuallyDismissedRef.current = true;

        // Clear all pending timers
        if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
        if (navTimerRef.current) clearTimeout(navTimerRef.current);
    }, []);

    const showToast = useCallback(() => {
        // Don't show if manually dismissed recently (prevents nav timers from re-opening)
        if (isManuallyDismissedRef.current) return;

        setIsVisible(true);

        // Clear existing hide timer
        if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);

        // Auto-hide after 7 seconds
        autoHideTimerRef.current = setTimeout(() => {
            setIsVisible(false);
            autoHideTimerRef.current = null;
        }, 7000);
    }, []);

    // Handle Login Greeting & Term Announcement
    useEffect(() => {
        if (currentPage === 'Report Viewer') {
            setIsVisible(false);
            return;
        }
        // Trigger only when user is logged in, settings are available, and we haven't shown the session announcement yet
        if (currentUser && settings?.academicYear && !hasShownAnnouncement) {
            const hour = new Date().getHours();
            let timeGreeting = '';

            if (hour < 12) timeGreeting = GREETINGS.morning[Math.floor(Math.random() * GREETINGS.morning.length)];
            else if (hour < 18) timeGreeting = GREETINGS.afternoon[Math.floor(Math.random() * GREETINGS.afternoon.length)];
            else timeGreeting = GREETINGS.evening[Math.floor(Math.random() * GREETINGS.evening.length)];

            setTitle(`${timeGreeting}, ${currentUser.name.split(' ')[0]}!`);

            // Boldly announce the current School, Academic Year and Term
            const schoolName = settings.schoolName || 'Your School';
            const year = settings.academicYear || '---';
            const term = settings.academicTerm || '---';
            
            setMessage(`Welcome to ${schoolName}|You are currently logged into the ${term} of the ${year} academic year`);
            
            setHasShownAnnouncement(true);
            showToast();
        }
    }, [currentUser, settings, hasShownAnnouncement, currentPage]);

    // Handle Page Navigation Greeting
    useEffect(() => {
        if (currentPage === 'Report Viewer') {
            setIsVisible(false);
            setLastPage(currentPage);
            return;
        }

        // Reset manual dismissal flag when page changes to allow toast on new pages
        if (currentPage !== lastPage) {
            isManuallyDismissedRef.current = false;
        }

        // Skip the first page load to allow the Login greeting to show without being overwritten
        if (lastPage === '') {
            setLastPage(currentPage);
            return;
        }

        if (currentUser && currentPage !== lastPage) {
            const msgs = PAGE_MESSAGES[currentPage] || ["Welcome to " + currentPage];
            const randomMsg = msgs[Math.floor(Math.random() * msgs.length)];

            setTitle(currentPage);
            setMessage(randomMsg);

            // Clear any pending navigation timer
            if (navTimerRef.current) clearTimeout(navTimerRef.current);

            // Slight delay to allow page render
            navTimerRef.current = setTimeout(() => {
                showToast();
                navTimerRef.current = null;
            }, 500);

            setLastPage(currentPage);
            return () => {
                if (navTimerRef.current) clearTimeout(navTimerRef.current);
            };
        }
        setLastPage(currentPage);
    }, [currentPage, currentUser, lastPage, showToast]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
            if (navTimerRef.current) clearTimeout(navTimerRef.current);
        };
    }, []);

    if (!currentUser || !isVisible) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop with Blur */}
            <div 
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 pointer-events-auto"
                onClick={handleClose}
            />

            {/* Modal Container */}
            <div 
                className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 w-[90%] max-w-[380px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300 z-10 pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header Section (Gradient) */}
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-center relative">
                    <button
                        onClick={handleClose}
                        className="absolute top-3 right-3 text-white/70 hover:text-white hover:bg-white/20 p-1.5 rounded-full transition-colors"
                        title="Close"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    
                    <div className="mx-auto bg-white/20 w-14 h-14 flex items-center justify-center rounded-full mb-3 shadow-inner border border-white/30 backdrop-blur-md">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white tracking-wide">{title}</h3>
                </div>

                {/* Body Section */}
                <div className="p-6 bg-white">
                    {message.includes('|') ? (
                        <div className="space-y-4">
                            <div className="text-center pb-4 border-b border-gray-100">
                                <p className="text-gray-800 font-extrabold text-lg leading-tight">
                                    {message.split('|')[0]}
                                </p>
                            </div>
                            <div className="bg-indigo-50 border border-indigo-100/60 rounded-xl p-3 flex gap-3 items-center shadow-sm">
                                <div className="text-indigo-500 bg-white p-2 rounded-lg shadow-sm border border-indigo-50 shrink-0">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <p className="text-indigo-800 font-semibold text-sm leading-snug">
                                    {message.split('|')[1]}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-2">
                            <p className="text-gray-600 font-medium text-base">{message}</p>
                        </div>
                    )}
                </div>

                {/* Footer Section */}
                <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-center">
                    <button
                        onClick={handleClose}
                        className="px-6 py-2 bg-white text-gray-700 font-bold text-sm shadow-sm border border-gray-200 rounded-full hover:bg-gray-50 hover:text-gray-900 transition-all active:scale-95"
                    >
                        Continue
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GreetingToast;
