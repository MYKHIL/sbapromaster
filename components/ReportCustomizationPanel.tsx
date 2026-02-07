import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../context/DataContext';
import { generateTeacherRemark } from '../services/geminiService';
import type { Student, ReportSpecificData } from '../types';
import { AI_FEATURES_ENABLED } from '../constants';

interface ReportCustomizationPanelProps {
    student: Student;
    performanceSummary: string;
    onCollapseChange?: (isCollapsed: boolean) => void;
    classId: number;
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


const inputStyles = "block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500";
const textAreaStyles = `${inputStyles} min-h-[60px]`;


const REMARK_OPTIONS = {
    conduct: {
        "Unsatisfactory": [
            "Unsatisfactory",
            "Consistently fails to adhere to classroom rules",
            "Disrupts the learning environment frequently",
            "Shows a lack of respect for teachers and peers",
            "Is rarely prepared and often forgets necessary materials",
            "Struggles with following directions and instructions",
            "Is occasionally disrespectful to others in the classroom",
            "Often needs reminders to stay on task",
            "Lacks self-control and disrupts peers"
        ],
        "Needs Improvement": [
            "Over confident",
            "Truant",
            "Often forgets to bring necessary school supplies",
            "Struggles with maintaining a clean work area",
            "Needs frequent reminders to stay on task during lessons",
            "Has difficulty working cooperatively in group settings",
            "Shows a lack of enthusiasm for class activities",
            "Can be inattentive during instruction and discussions",
            "Occasionally challenges classroom rules and expectations"
        ],
        "Satisfactory": [
            "Sociable",
            "Satisfactory",
            "Respectful",
            "Humble",
            "Calm",
            "Sometimes needs encouragement to participate in discussions",
            "Is generally respectful but can improve in listening to peers",
            "Is usually well-behaved but can be more proactive in learning",
            "Is regularly prepared for class and participates in discussions",
            "Consistently follows classroom procedures and expectations",
            "Actively engages in class and often helps others",
            "Demonstrates a strong sense of responsibility in group work"
        ],
        "Good": [
            "Patient",
            "Empathetic",
            "Approachable",
            "Friendly",
            "Shows improvement in following school policies",
            "Usually comes to class prepared and ready to learn",
            "Respects others' time by being punctual",
            "Cooperates with peers and works well in groups",
            "Regularly demonstrates responsibility in classwork",
            "Often helps to maintain a positive classroom atmosphere",
            "Is consistently polite and courteous to everyone"
        ],
        "Excellent": [
            "Resilient",
            "Open-minded",
            "Very determined",
            "Confident",
            "Shows leadership qualities and helps others",
            "Exemplary behavior and a role model for classmates",
            "Always adheres to the highest standards of conduct",
            "Demonstrates exceptional maturity and responsibility",
            "Sets a positive example with perfect conduct",
            "Exemplary behavior and consistently demonstrates integrity",
            "Outstanding conduct at all times and inspires others"
        ]
    },
    attitude: {
        "Unsatisfactory": [
            "Is hostile",
            "Is not serious in class",
            "Is lazy",
            "Is slow",
            "Is too playful",
            "Shows little interest in learning",
            "Is often negative and resistant to school activities",
            "Exhibits a defeatist attitude"
        ],
        "Needs Improvement": [
            "Shows reluctance to engage with classroom material",
            "Often appears disinterested in learning and activities",
            "Displays minimal effort in class participation",
            "Is reluctant to engage and contribute in class",
            "Displays indifference towards educational opportunities",
            "Can exhibit a more positive outlook towards school tasks",
            "Sometimes shows a willingness to learn and improve"
        ],
        "Satisfactory": [
            "Sometimes shows a positive attitude but is inconsistent",
            "Is generally positive but can be more enthusiastic about learning opportunities",
            "Has a neutral attitude towards learning, neither disruptive nor particularly motivated",
            "Generally has a good attitude but lacks consistency",
            "Shows a positive approach to learning new concepts",
            "Regularly demonstrates a good attitude towards learning",
            "Frequently exhibits enthusiasm for classroom topics"
        ],
        "Good": [
            "Shows a positive attitude and is open to feedback",
            "Is often enthusiastic and demonstrates a willingness to learn",
            "Consistently shows respect and kindness to others",
            "Maintains a positive and respectful attitude consistently",
            "Regularly participates actively in class discussions",
            "Frequently demonstrates a growth mindset",
            "Exhibits a strong desire to learn and succeed"
        ],
        "Excellent": [
            "Is hardworking",
            "Is dependable",
            "Is kind",
            "Adheres to deadlines",
            "Is punctual",
            "Consistently positive and proactive in seeking knowledge",
            "Is highly motivated and inspires others with a can-do attitude"
        ],
        "Outstanding": [
            "Exhibits a remarkable passion for learning and consistently uplifts the classroom dynamic",
            "Is eager to take on challenges and learn from them",
            "Inspires peers with an enthusiastic learning approach",
            "Exemplifies a positive and proactive attitude",
            "Demonstrates outstanding leadership and positivity",
            "Possesses an infectious enthusiasm for learning",
            "Embodies an exemplary attitude in all aspects of school life"
        ]
    },
    teacherRemark: {
        "Unsatisfactory": [
            "Shows no interest in school subjects or extracurricular activities",
            "Rarely participates in class discussions or activities",
            "Needs to show more interest and engagement in class",
            "Needs much assistance at home",
            "Should pay more attention in class",
            "Needs to develop a better sense of responsibility",
            "Has the potential but must be more diligent",
            "Struggles to express thoughts constructively"
        ],
        "Needs Improvement": [
            "Could do better",
            "More room for improvement",
            "Should buckle up",
            "Can do better",
            "Has the potential to do better",
            "Should study at home",
            "Progressing, yet more consistent effort is required for improvement"
        ],
        "Satisfactory": [
            "Has improved",
            "Shows some interest in learning but is not actively exploring new ideas",
            "Participates in class but does not pursue interests further",
            "Occasionally shows interest in certain topics but lacks overall engagement",
            "Shows some promise and could benefit from increased participation",
            "Shows some improvement but can benefit from more participation",
            "Capable of achieving more with increased engagement"
        ],
        "Good": [
            "Keep it up",
            "Good effort, keep up the positive progress",
            "Continues to make steady gains in all academic areas",
            "Engages with class material and sometimes pursues related interests outside of class",
            "Actively seeks out additional resources to deepen understanding of subjects",
            "Good effort; continue to build on the positive progress made",
            "Making steady gains and showing a good understanding of concepts"
        ],
        "Excellent": [
            "Excellent results",
            "Should devote more time to studying",
            "Impressive improvement and a strong work ethic",
            "Excellent progress and a high level of participation",
            "Demonstrates a strong interest in a broad range of educational topics",
            "Passionately engages with academic and extracurricular pursuits",
            "Exhibits a deep and sustained commitment to personal and academic growth"
        ],
        "Outstanding": [
            "Remarkable academic growth and intellectual curiosity",
            "Consistently exceeds expectations with high-quality work",
            "An inspiration to peers with exceptional academic achievements",
            "Leadership in classroom discussions is highly commendable",
            "Exemplary academic performance and a positive influence",
            "Superior dedication to academic excellence and leadership",
            "A paragon of academic virtue and scholarly conduct"
        ]
    },
    interest: {
        "Specific areas": [
            "Sporting activities", "Social activities", "Soccer", "Aerobics", "Gymnastics", "Drama",
            "Sewing", "Crocheting", "Singing", "Athletics", "Classroom activities", "Artwork",
            "Drumming", "Dancing", "Reading", "Indoor activities", "Outdoor activities", "Music",
            "Almost all subjects", "All subjects"
        ],
        "Unsatisfactory": [
            "Shows no interest in team sports or individual physical activities",
            "Avoids participation in indoor activities like chess, art, or drama",
            "Expresses no desire to engage in outdoor educational trips or nature activities",
            "Lacks interest in exploring different genres of music or artistic expression",
            "Does not participate in science fairs, math clubs, or other academic-related clubs",
            "Shows indifference towards reading, writing, or engaging in intellectual discussions",
            "Is uninterested in technology, coding, or digital literacy activities"
        ],
        "Needs Improvement": [
            "Seldom shows enthusiasm for physical education or sports teams",
            "Infrequently participates in creative indoor activities",
            "Rarely takes the initiative to join outdoor learning experiences",
            "Occasionally shows a flicker of interest in arts and crafts",
            "Participates in academic clubs but does not actively contribute",
            "Shows some curiosity in reading and discussion but lacks follow-through",
            "Engages with technology but needs encouragement to develop skills"
        ],
        "Satisfactory": [
            "Participates in sports but could show more team spirit",
            "Joins indoor activities and sometimes displays creativity",
            "Takes part in outdoor excursions but could be more involved",
            "Shows an average interest in music and art classes",
            "Is a member of academic clubs and occasionally contributes ideas",
            "Reads assigned materials and participates in class discussions",
            "Uses technology for assignments but has potential for greater application"
        ],
        "Good": [
            "Actively engages in sports and understands the value of teamwork",
            "Regularly participates in indoor activities and demonstrates innovation",
            "Enjoys outdoor educational activities and often shares experiences",
            "Has a good appreciation for the arts and often attends related events",
            "Contributes to academic clubs with enthusiasm and dedication",
            "Enjoys reading beyond the curriculum and engages in intellectual debates",
            "Shows proficiency in using technology and is keen to learn more"
        ],
        "Excellent": [
            "Excels in sports and often leads the team in practice and games",
            "Demonstrates exceptional talent in indoor activities like robotics or debate",
            "Is an avid participant in outdoor learning and often organizes events",
            "Displays a deep passion for the arts, frequently showcasing their work",
            "Is an active leader in academic clubs, driving projects and discussions",
            "Has a voracious appetite for reading and often leads book clubs",
            "Utilizes technology skillfully and mentors peers in digital projects"
        ],
        "Outstanding": [
            "Is a star athlete, setting records and inspiring teammates",
            "Shows remarkable creativity and leadership in indoor pursuits",
            "Initiates and leads outdoor adventure and learning programs",
            "Is recognized for artistic talents and wins awards for creative contributions",
            "Drives innovation and excellence in academic societies and competitions",
            "Is a prolific reader and writer, often publishing reviews and articles",
            "Excels in technological endeavors, winning accolades in coding and design"
        ]
    }
};

const InputWithOptions: React.FC<{
    label: string;
    name: keyof typeof REMARK_OPTIONS | 'attendance';
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    placeholder?: string;
    isTextArea?: boolean;
    showAI?: boolean;
    onAIGenerate?: () => void;
    isGenerating?: boolean;
}> = ({ label, name, value, onChange, onBlur, placeholder, isTextArea, showAI, onAIGenerate, isGenerating }) => {
    const [showOptions, setShowOptions] = useState(false);
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [dropUp, setDropUp] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
    const optionsRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Close options when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (optionsRef.current && !optionsRef.current.contains(event.target as Node)) {
                // Also check if we clicked the toggle button, to avoid immediate re-opening if handled there
                if (buttonRef.current && buttonRef.current.contains(event.target as Node)) {
                    return;
                }
                setShowOptions(false);
                setExpandedCategory(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleOptions = () => {
        if (!showOptions) {
            // Check position before opening
            if (buttonRef.current) {
                const rect = buttonRef.current.getBoundingClientRect();
                const windowHeight = window.innerHeight;
                const windowWidth = window.innerWidth;
                // Assume dropdown max height is roughly 320px (max-h-80)
                const spaceBelow = windowHeight - rect.bottom;

                // Calculate position for fixed positioning
                const right = windowWidth - rect.right;

                if (spaceBelow < 320) {
                    setDropUp(true);
                    setDropdownPosition({
                        top: rect.top - 4, // 4px margin (mb-1)
                        right: right
                    });
                } else {
                    setDropUp(false);
                    setDropdownPosition({
                        top: rect.bottom + 4, // 4px margin (mt-1)
                        right: right
                    });
                }
            }
        }
        setShowOptions(!showOptions);
    };

    const handleOptionSelect = (e: React.MouseEvent, opt: string) => {
        e.preventDefault();

        let newValue = opt;
        // Logic for append/replace can go here if needed in future

        const event = {
            target: { name, value: newValue }
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(event);
        setShowOptions(false);
    };

    const toggleCategory = (e: React.MouseEvent, category: string) => {
        e.preventDefault();
        e.stopPropagation();
        setExpandedCategory(prev => prev === category ? null : category);
    };

    const hasOptions = name !== 'attendance' && REMARK_OPTIONS[name as keyof typeof REMARK_OPTIONS];

    return (
        <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between items-center">
                {label}
                {showAI && onAIGenerate && <AIGenerateButton isGenerating={!!isGenerating} onClick={onAIGenerate} />}
            </label>
            <div className="relative flex items-center">
                {isTextArea ? (
                    <textarea
                        name={name}
                        value={value}
                        onChange={onChange}
                        onBlur={onBlur}
                        className={`${textAreaStyles} pr-10`}
                        placeholder={placeholder}
                    />
                ) : (
                    <input
                        type="text"
                        name={name}
                        value={value}
                        onChange={onChange}
                        onBlur={onBlur}
                        className={`${inputStyles} pr-10`}
                        placeholder={placeholder}
                    />
                )}

                {hasOptions && (
                    <button
                        ref={buttonRef}
                        type="button"
                        onClick={toggleOptions}
                        className="absolute right-2 top-2 p-1.5 text-gray-400 hover:text-blue-600 rounded-md hover:bg-gray-100 transition-colors"
                        title="Choose from options"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                )}

                {showOptions && hasOptions && (
                    <div
                        ref={optionsRef}
                        className="fixed w-64 bg-white border border-gray-200 rounded-lg shadow-xl z-[9999] flex flex-col max-h-80 overflow-y-auto"
                        style={{
                            top: dropUp ? 'auto' : `${dropdownPosition.top}px`,
                            bottom: dropUp ? `${window.innerHeight - dropdownPosition.top}px` : 'auto',
                            right: `${dropdownPosition.right}px`
                        }}
                    >
                        {/* Context Menu Style: Categories as Items */}
                        <div className="py-1">
                            {Object.entries(REMARK_OPTIONS[name as keyof typeof REMARK_OPTIONS]).map(([category, items]) => {
                                const isExpanded = expandedCategory === category;
                                return (
                                    <div key={category} className="border-b border-gray-50 last:border-0">
                                        <div
                                            onClick={(e) => toggleCategory(e, category)}
                                            className={`
                                                px-4 py-3 cursor-pointer text-sm font-semibold flex justify-between items-center transition-colors
                                                ${isExpanded ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'}
                                            `}
                                        >
                                            {category}
                                            <svg
                                                className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                                fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>

                                        {/* Sub Menu Items (Accordion Body) */}
                                        {isExpanded && (
                                            <div className="bg-gray-50/50 inner-shadow-sm">
                                                {items.map((opt, idx) => (
                                                    <div
                                                        key={`${category}-${idx}`}
                                                        onMouseDown={(e) => handleOptionSelect(e, opt)}
                                                        className="px-6 py-2 hover:bg-blue-100 cursor-pointer text-sm text-gray-600 border-l-4 border-transparent hover:border-blue-500 pl-8"
                                                    >
                                                        {opt}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const ReportCustomizationPanel: React.FC<ReportCustomizationPanelProps> = ({ student, performanceSummary, onCollapseChange, classId }) => {
    const { getReportData, updateReportData, getClassData, updateClassData, settings } = useData();
    const [data, setData] = useState<Partial<Omit<ReportSpecificData, 'totalSchoolDays'>>>({ attendance: '', conduct: '', interest: '', attitude: '', teacherRemark: '' });
    const [originalData, setOriginalData] = useState<Partial<Omit<ReportSpecificData, 'totalSchoolDays'>>>({});
    const [totalDays, setTotalDays] = useState('');
    const [originalTotalDays, setOriginalTotalDays] = useState('');
    const [isGeneratingTeacherRemark, setIsGeneratingTeacherRemark] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    // Only load data when the student ID changes to prevent resetting while typing
    useEffect(() => {
        const existingData = getReportData(student.id);
        const initialData = existingData || { attendance: '', conduct: '', interest: '', attitude: '', teacherRemark: '' };
        setData(initialData);
        setOriginalData(initialData); // Keep track of original to detect changes

        // Load Total School Days
        const classData = getClassData(classId);
        const days = classData?.totalSchoolDays || '';
        setTotalDays(days);
        setOriginalTotalDays(days);

        setHasUnsavedChanges(false);
        setIsCollapsed(false);
    }, [student.id, classId]); // Intentional: exclude getReportData/getClassData to avoid reset loop

    // Check for changes whenever data updates
    useEffect(() => {
        const isDataDirty = JSON.stringify(data) !== JSON.stringify(originalData);
        const isDaysDirty = totalDays !== originalTotalDays;
        setHasUnsavedChanges(isDataDirty || isDaysDirty);
    }, [data, originalData, totalDays, originalTotalDays]);


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        if (!hasUnsavedChanges) return;

        // Save report data to Context/DB
        updateReportData(student.id, data);

        // Save total school days to class data
        updateClassData(classId, { totalSchoolDays: totalDays });

        // Update original data references to current
        setOriginalData(data);
        setOriginalTotalDays(totalDays);
        setHasUnsavedChanges(false);
    };

    const handleTotalDaysChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setTotalDays(newValue);
        // Immediately update class data locally (but don't persist to DB until Save)
        updateClassData(classId, { totalSchoolDays: newValue });
    };

    const handleGenerateRemark = async () => {
        setIsGeneratingTeacherRemark(true);
        const prompt = `Generate a brief, encouraging, and constructive class teacher's remark for a student named ${student.name}. The student's performance is as follows: ${performanceSummary}. The remark should be about 15-25 words.`;

        const remark = await generateTeacherRemark(student.name, performanceSummary, prompt);

        const fieldName = 'teacherRemark';
        const newData = { ...data, [fieldName]: remark };
        setData(newData);
        // We do NOT save immediately anymore, user must click Save
        // But we should mark as changed? The effect will handle it.
        setIsGeneratingTeacherRemark(false);
    };

    // Close panel when clicking outside on mobile
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Only on mobile and when expanded
            if (window.innerWidth < 1024 && !isCollapsed) {
                // IMPORTANT: Check if the target is still in the document.
                // React unmounts elements (like dropdowns) before this fires.
                // If it's not in the body, it was likely part of our UI that just closed.
                if (!document.body.contains(event.target as Node)) {
                    return;
                }

                if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                    setIsCollapsed(true);
                }
            }
        };

        if (!isCollapsed) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isCollapsed]);

    // Notify parent when collapse state changes
    useEffect(() => {
        if (onCollapseChange) {
            onCollapseChange(isCollapsed);
        }
    }, [isCollapsed, onCollapseChange]);

    return (
        <div
            ref={panelRef}
            className={`
                bg-white/95 backdrop-blur-sm border-gray-200 z-20 transition-transform duration-500 ease-in-out
                lg:fixed lg:top-28 lg:right-6 lg:w-96 lg:p-6 lg:rounded-xl lg:shadow-2xl lg:border lg:transform-none lg:left-auto lg:bottom-auto
                fixed bottom-0 inset-x-0 w-full p-4 rounded-t-2xl shadow-2xl border-t
                ${ // Mobile only: collapse logic
                isCollapsed ? 'translate-y-[calc(100%-4rem)] lg:translate-x-0 lg:translate-y-0' : 'translate-y-0'
                }
            `}
        // Removed onMouseEnter/Leave to keep it permanently visible on desktop
        >
            {/* Desktop Collapse Handle REMOVED */}

            {/* Mobile Collapse Handle */}
            <div className="lg:hidden w-full flex justify-center pb-2 cursor-pointer touch-none" onClick={() => setIsCollapsed(!isCollapsed)}>
                <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
            </div>

            {/* Overlay Backdrop for Mobile to handle "tap outside" */}
            {!isCollapsed && (
                <div
                    className="fixed inset-0 bg-black/5 z-[-1] lg:hidden"
                    onClick={() => setIsCollapsed(true)}
                    style={{ top: '-1000px', left: '-1000px', right: '-1000px', height: '2000px' }}
                />
            )}

            {/* Content Container */}
            <div className={`transition-opacity duration-300 ${isCollapsed ? 'lg:opacity-100 opacity-100' : 'opacity-100'}`}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-800">Performance Comments for {student.name}</h3>
                    <button
                        onClick={handleSave}
                        disabled={!hasUnsavedChanges}
                        className={`
                            px-4 py-1.5 rounded-full text-sm font-semibold transition-all
                            ${hasUnsavedChanges
                                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'}
                        `}
                    >
                        {hasUnsavedChanges ? 'Save Changes' : 'Saved'}
                    </button>
                </div>

                {/* Fixed max-height for mobile to avoid obstructing report completely */}
                <div className="space-y-4 max-h-[50vh] lg:max-h-[calc(100vh-12rem)] overflow-y-auto pr-2">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Total School Days</label>
                        <input
                            type="number"
                            value={totalDays}
                            onChange={handleTotalDaysChange}
                            className={inputStyles}
                            placeholder="e.g. 180"
                        />
                    </div>
                    {settings.isPromotionTerm && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Promoted To</label>
                            <input
                                type="text"
                                name="promotedTo"
                                value={data.promotedTo || ''}
                                onChange={handleChange}
                                className={inputStyles}
                                placeholder="e.g. JHS 2"
                            />
                        </div>
                    )}
                    <InputWithOptions
                        label="Days Attended"
                        name="attendance"
                        value={data.attendance || ''}
                        onChange={handleChange}
                        onBlur={() => { }} // No auto-save on blur
                        placeholder="e.g. 60"
                    />
                    <InputWithOptions
                        label="Conduct"
                        name="conduct"
                        value={data.conduct || ''}
                        onChange={handleChange}
                        onBlur={() => { }}
                        placeholder="e.g. Respectful and hardworking"
                    />
                    <InputWithOptions
                        label="Interest"
                        name="interest"
                        value={data.interest || ''}
                        onChange={handleChange}
                        onBlur={() => { }}
                        placeholder="e.g. Reading, Sports"
                    />
                    <InputWithOptions
                        label="Attitude"
                        name="attitude"
                        value={data.attitude || ''}
                        onChange={handleChange}
                        onBlur={() => { }}
                        placeholder="e.g. Positive attitude"
                    />
                    <InputWithOptions
                        label="Class Teacher's Remarks"
                        name="teacherRemark"
                        value={data.teacherRemark || ''}
                        onChange={handleChange}
                        onBlur={() => { }}
                        placeholder="Enter remark..."
                        isTextArea
                        showAI={AI_FEATURES_ENABLED}
                        onAIGenerate={handleGenerateRemark}
                        isGenerating={isGeneratingTeacherRemark}
                    />
                </div>
            </div>
        </div>
    );
};

export default ReportCustomizationPanel;