import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../context/DataContext';
import { generateTeacherRemark } from '../services/geminiService';
import type { Student, ReportSpecificData } from '../types';
import { AI_FEATURES_ENABLED } from '../constants';

interface ReportCustomizationPanelProps {
    student: Student;
    performanceSummary: string;
}

const AIGenerateButton: React.FC<{ isGenerating: boolean; onClick: () => void; }> = ({ isGenerating, onClick }) => (
    <button
        onClick={onClick}
        disabled={isGenerating}
        className="text-xs flex items-center bg-purple-100 text-purple-800 px-2 py-1 rounded-full font-semibold hover:bg-purple-200 disabled:bg-gray-200 disabled:text-gray-500 transition-colors"
    >
        {isGenerating ? (
            <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
            </>
        ) : (
            '✨ Generate with AI'
        )}
    </button>
);


const ReportCustomizationPanel: React.FC<ReportCustomizationPanelProps> = ({ student, performanceSummary }) => {
    const { getReportData, updateReportData } = useData();
    const [data, setData] = useState<Partial<Omit<ReportSpecificData, 'totalSchoolDays'>>>({
        attendance: '', conduct: '', interest: '', attitude: '', teacherRemark: ''
    });
    const [isGeneratingTeacherRemark, setIsGeneratingTeacherRemark] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(true);
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const existingData = getReportData(student.id);
        if (existingData) {
            setData(existingData);
        } else {
            setData({ attendance: '', conduct: '', interest: '', attitude: '', teacherRemark: '' });
        }
        setIsCollapsed(false); // Expand panel when student changes
    }, [student.id, getReportData]);

    const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        updateReportData(student.id, { [name]: value });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setData(prev => ({ ...prev, [name]: value }));
    };

    const handleGenerateRemark = async () => {
        setIsGeneratingTeacherRemark(true);
        const prompt = `Generate a brief, encouraging, and constructive class teacher's remark for a student named ${student.name}. The student's performance is as follows: ${performanceSummary}. The remark should be about 15-25 words.`;

        const remark = await generateTeacherRemark(student.name, performanceSummary, prompt);

        const fieldName = 'teacherRemark';
        setData(prev => ({ ...prev, [fieldName]: remark }));
        updateReportData(student.id, { [fieldName]: remark });
        setIsGeneratingTeacherRemark(false);
    };

    const inputStyles = "block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500";
    const textAreaStyles = `${inputStyles} min-h-[60px]`;

    return (
        <div
            ref={panelRef}
            className={`
                bg-white/80 backdrop-blur-sm border-gray-200 z-20 transition-transform duration-500 ease-in-out
                lg:fixed lg:top-28 lg:right-6 lg:w-96 lg:p-6 lg:rounded-xl lg:shadow-2xl lg:border lg:transform-none lg:left-auto lg:bottom-auto
                fixed bottom-0 inset-x-0 w-full p-4 rounded-t-2xl shadow-2xl border-t
                ${isCollapsed ? 'lg:translate-x-[calc(100%-2.5rem)] translate-y-[calc(100%-4rem)]' : 'lg:translate-x-0 translate-y-0'}
            `}
            onMouseEnter={() => window.innerWidth >= 1024 && setIsCollapsed(false)}
            onMouseLeave={() => window.innerWidth >= 1024 && setIsCollapsed(true)}
        >
            {/* Desktop Collapse Handle */}
            <button
                onClick={() => setIsCollapsed(false)}
                className={`hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full w-10 h-24 bg-white/80 backdrop-blur-sm border-l border-t border-b border-gray-200 rounded-l-lg items-center justify-center text-gray-600 hover:bg-white transition-opacity duration-300 ${isCollapsed ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                aria-label="Expand panel"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
            </button>

            {/* Mobile Collapse Handle */}
            <div className="lg:hidden w-full flex justify-center pb-2" onClick={() => setIsCollapsed(!isCollapsed)}>
                <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
            </div>

            <div className={`transition-opacity duration-300 ${isCollapsed && window.innerWidth >= 1024 ? 'opacity-0' : 'opacity-100'}`}>
                <h3 className="text-xl font-bold text-gray-800 mb-4">Details for {student.name}</h3>
                <div className="space-y-4 max-h-[calc(100vh-16rem)] lg:max-h-[calc(100vh-12rem)] overflow-y-auto pr-2 no-scrollbar">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Days Attended</label>
                        <input type="text" name="attendance" value={data.attendance || ''} onChange={handleChange} onBlur={handleBlur} className={inputStyles} placeholder="e.g. 60" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Conduct</label>
                        <input type="text" name="conduct" value={data.conduct || ''} onChange={handleChange} onBlur={handleBlur} className={inputStyles} placeholder="e.g. Respectful and hardworking" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Interest</label>
                        <input type="text" name="interest" value={data.interest || ''} onChange={handleChange} onBlur={handleBlur} className={inputStyles} placeholder="e.g. Reading, Sports" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Attitude</label>
                        <input type="text" name="attitude" value={data.attitude || ''} onChange={handleChange} onBlur={handleBlur} className={inputStyles} placeholder="e.g. Shows positive attitude to learning" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between items-center">
                            Class Teacher's Remarks
                            {AI_FEATURES_ENABLED && <AIGenerateButton isGenerating={isGeneratingTeacherRemark} onClick={handleGenerateRemark} />}
                        </label>
                        <textarea name="teacherRemark" value={data.teacherRemark || ''} onChange={handleChange} onBlur={handleBlur} className={textAreaStyles} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportCustomizationPanel;