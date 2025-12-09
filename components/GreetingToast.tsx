import React, { useState, useEffect } from 'react';
import { User } from '../types';

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
    'Teachers': ["Manage comments and teacher details.", "Class teacher assignments.", "Edit teacher signatures."],
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

    // Handle Login Greeting
    useEffect(() => {
        if (currentUser && !isVisible && lastPage === '') {
            const hour = new Date().getHours();
            let timeGreeting = '';

            if (hour < 12) timeGreeting = GREETINGS.morning[Math.floor(Math.random() * GREETINGS.morning.length)];
            else if (hour < 18) timeGreeting = GREETINGS.afternoon[Math.floor(Math.random() * GREETINGS.afternoon.length)];
            else timeGreeting = GREETINGS.evening[Math.floor(Math.random() * GREETINGS.evening.length)];

            setTitle(`${timeGreeting}, ${currentUser.name.split(' ')[0]}!`);

            // Per user request, show the page description below the greeting
            const pageMsgs = PAGE_MESSAGES[currentPage] || ["Welcome to " + currentPage];
            setMessage(pageMsgs[Math.floor(Math.random() * pageMsgs.length)]);

            showToast();
        }
    }, [currentUser]);

    // Handle Page Navigation Greeting
    useEffect(() => {
        // Skip the first page load to allow the Login greeting to show without being overwritten
        if (lastPage === '') {
            setLastPage(currentPage);
            return;
        }

        if (currentUser && currentPage !== lastPage) {
            // Don't show if just logging in (let the login greeting take precedence if instantaneous)
            // But usually login happens then dashboard mounts.

            // If we are already showing a toast (e.g. login), maybe wait or overwrite?
            // Let's overwrite for responsiveness.

            const msgs = PAGE_MESSAGES[currentPage] || ["Welcome to " + currentPage];
            const randomMsg = msgs[Math.floor(Math.random() * msgs.length)];

            setTitle(currentPage);
            setMessage(randomMsg);

            // Slight delay to allow page render
            const timer = setTimeout(() => {
                showToast();
            }, 500);

            setLastPage(currentPage);
            return () => clearTimeout(timer);
        }
        setLastPage(currentPage); // Sync if no user (shouldn't happen due to parent check)
    }, [currentPage, currentUser, lastPage]);

    const showToast = () => {
        setIsVisible(true);
        const timer = setTimeout(() => {
            setIsVisible(false);
        }, 4000); // Show for 4 seconds
        return () => clearTimeout(timer);
    };

    if (!currentUser || !isVisible) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
            <div className="pointer-events-auto bg-white/90 backdrop-blur-xl border border-white/40 shadow-2xl rounded-2xl p-6 max-w-sm flex items-start space-x-4 animate-bounce-in">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full p-2 shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                </div>
                <div className="flex-1">
                    <h4 className="font-bold text-gray-800 text-lg leading-tight">{title}</h4>
                    <p className="text-gray-600 text-sm mt-1">{message}</p>
                </div>
                <button
                    onClick={() => setIsVisible(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default GreetingToast;
