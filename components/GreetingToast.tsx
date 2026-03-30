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
    }, [currentUser, settings, hasShownAnnouncement]);

    // Handle Page Navigation Greeting
    useEffect(() => {
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none p-4">
            <div 
                onClick={() => handleClose()}
                className="pointer-events-auto bg-white/95 backdrop-blur-xl border border-white/40 shadow-2xl rounded-2xl p-6 max-w-sm flex items-start space-x-4 animate-bounce-in cursor-pointer group active:scale-[0.98] transition-transform duration-150"
            >
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full p-2 shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                </div>
                <div className="flex-1">
                    <h4 className="font-bold text-gray-800 text-lg leading-tight">{title}</h4>
                    {message.includes('|') ? (
                        <div className="mt-2 space-y-1">
                            <p className="text-blue-800 font-extrabold text-base leading-snug">
                                {message.split('|')[0]}
                            </p>
                            <p className="text-indigo-600 font-semibold text-sm bg-indigo-50/50 px-2 py-1 rounded border border-indigo-100/50">
                                {message.split('|')[1]}
                            </p>
                        </div>
                    ) : (
                        <p className="text-gray-600 text-sm mt-1">{message}</p>
                    )}
                </div>
                <button
                    onClick={handleClose}
                    className="text-gray-400 hover:text-gray-600 hover:bg-gray-100/50 p-2 -mr-2 -mt-2 rounded-full transition-all duration-200"
                    title="Close greeting"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default GreetingToast;
