import React from 'react';
import type { Page } from '../types';

interface BottomNavigationProps {
    currentPage: Page;
    onNavigate: (page: Page) => void;
}

const BottomNavigation: React.FC<BottomNavigationProps> = ({ currentPage, onNavigate }) => {
    const navItems: { name: Page; icon: React.ReactElement; label: string }[] = [
        {
            name: 'School Setup',
            label: 'Setup',
            icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 2l8 6-1.5 1.2L12 4 5.5 9.2 4 8l8-6zM3 10.5v6A2.5 2.5 0 005.5 19h13A2.5 2.5 0 0021 16.5v-6L12 4 3 10.5z"/></svg>
        },
        {
            name: 'Students',
            label: 'Students',
            icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
        },
        {
            name: 'Score Entry',
            label: 'Scores',
            icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
        },
        {
            name: 'Report Viewer',
            label: 'Reports',
            icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
        },
        {
            name: 'Settings',
            label: 'Settings',
            icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h15.75c.621 0 1.125.504 1.125 1.125v6.75C21 20.496 20.496 21 19.875 21H4.125A1.125 1.125 0 013 19.875v-6.75zM3 8.625C3 8.004 3.504 7.5 4.125 7.5h15.75c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125H4.125A1.125 1.125 0 013 11.25V8.625zM3 4.125C3 3.504 3.504 3 4.125 3h15.75c.621 0 1.125.504 1.125 1.125v2.25C21 6.996 20.496 7.5 19.875 7.5H4.125A1.125 1.125 0 013 6.375V4.125z" /></svg>
        }
    ];

    return (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 px-4 pb-4 pointer-events-none">
            <nav className="mx-auto max-w-md bg-white/80 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] rounded-2xl flex items-center justify-around p-2 pointer-events-auto">
                {navItems.map((item) => {
                    const isActive = currentPage === item.name;
                    return (
                        <button
                            key={item.name}
                            onClick={() => onNavigate(item.name)}
                            className={`flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl transition-all duration-300 relative group
                                ${isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            {/* Active background indicator */}
                            {isActive && (
                                <div className="absolute inset-0 bg-blue-50 rounded-xl animate-fade-in-scale z-0" />
                            )}
                            
                            <div className={`relative z-10 transition-transform duration-300 ${isActive ? 'scale-110 -translate-y-0.5' : 'group-hover:scale-105'}`}>
                                {item.icon}
                            </div>
                            <span className={`relative z-10 text-[10px] font-bold mt-0.5 transition-all duration-300 ${isActive ? 'opacity-100 scale-100' : 'opacity-70 scale-95'}`}>
                                {item.label}
                            </span>
                            
                            {/* Dot indicator */}
                            {isActive && (
                                <div className="absolute -bottom-0.5 w-1 h-1 bg-blue-600 rounded-full" />
                            )}
                        </button>
                    );
                })}
            </nav>
        </div>
    );
};

export default BottomNavigation;
