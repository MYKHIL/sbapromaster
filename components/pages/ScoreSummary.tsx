import React, { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { useUser } from '../../context/UserContext';
import ReadOnlyWrapper from '../ReadOnlyWrapper';

interface MissingEntry {
    studentName: string;
    missingAssessments: string[];
}

interface SubjectSummary {
    subjectId: number;
    subjectName: string;
    totalStudents: number;
    totalAssessmentsExpected: number;
    completedAssessments: number;
    missingEntries: MissingEntry[];
}

interface ClassSummary {
    classId: number;
    className: string;
    subjects: SubjectSummary[];
}

const ScoreSummary: React.FC = () => {
    const { students, subjects, classes, assessments, getStudentScores, refreshFromCloud, isSyncing, isOnline } = useData();
    const { currentUser } = useUser();

    // State to toggle specific class view details
    const [expandedClasses, setExpandedClasses] = useState<Record<number, boolean>>({});

    const toggleClass = (classId: number) => {
        setExpandedClasses(prev => ({
            ...prev,
            [classId]: !prev[classId]
        }));
    };

    const summaryData = useMemo(() => {
        if (!classes || !students || !assessments || !subjects) return [];

        return classes.map(cls => {
            const classStudents = students.filter(s => s.class === cls.name);

            // If no students in class, return basic info
            if (classStudents.length === 0) {
                return {
                    classId: cls.id,
                    className: cls.name,
                    subjects: []
                };
            }

            const subjectSummaries: SubjectSummary[] = subjects.map(sub => {
                let completedCount = 0;
                const missingEntries: MissingEntry[] = [];

                // Calculate expected assessments (students * assessments)
                // Filter out assessments that might not apply if your system has subject-specific assessments
                // For now assuming all assessments apply to all subjects as per previous logic
                const totalAssessmentsExpected = classStudents.length * assessments.length;

                classStudents.forEach(student => {
                    const studentMissingAssessments: string[] = [];

                    assessments.forEach(assessment => {
                        const score = getStudentScores(student.id, sub.id, assessment.id);
                        if (score && score.length > 0 && score[0] !== '') {
                            completedCount++;
                        } else {
                            studentMissingAssessments.push(assessment.name);
                        }
                    });

                    if (studentMissingAssessments.length > 0) {
                        missingEntries.push({
                            studentName: student.name,
                            missingAssessments: studentMissingAssessments
                        });
                    }
                });

                return {
                    subjectId: sub.id,
                    subjectName: sub.subject,
                    totalStudents: classStudents.length,
                    totalAssessmentsExpected,
                    completedAssessments: completedCount,
                    missingEntries
                };
            });

            return {
                classId: cls.id,
                className: cls.name,
                subjects: subjectSummaries
            };
        });
    }, [classes, students, subjects, assessments, getStudentScores]);

    // Mobile View: Selected Class State
    const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
    const [isCompactMode, setIsCompactMode] = useState(true); // Default to compact mode on mobile

    // Initialize selected class when data loads
    React.useEffect(() => {
        if (summaryData.length > 0 && selectedClassId === null) {
            setSelectedClassId(summaryData[0].classId);
        }
    }, [summaryData, selectedClassId]);

    const selectedClassData = useMemo(() => {
        return summaryData.find(c => c.classId === selectedClassId) || null;
    }, [summaryData, selectedClassId]);

    if (currentUser?.role !== 'Admin') {
        return (
            <div className="flex items-center justify-center h-full text-gray-500">
                Access Denied. Admin privilege required.
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-10 pt-14">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Score Entry Summary</h1>
                    <p className="text-gray-600">Overview of score entries across all classes and subjects.</p>
                </div>
                <button
                    onClick={() => refreshFromCloud()}
                    disabled={isSyncing || !isOnline}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-sm transition-colors ${isSyncing || !isOnline
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-blue-600 border border-blue-200 hover:bg-blue-50'
                        }`}
                    title="Force download latest data from cloud"
                >
                    {isSyncing ? (
                        <>
                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Syncing...</span>
                        </>
                    ) : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Refresh Data</span>
                        </>
                    )}
                </button>
            </div>

            {/* Desktop View: Grid of Cards */}
            <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                {summaryData.map((clsSummary) => (
                    <ClassScoreCard
                        key={clsSummary.classId}
                        clsSummary={clsSummary}
                        expandedClasses={expandedClasses} // Passing state/uncontrolled for now or keep logic internal?
                    // Actually the original logic used `expandedClasses` state from parent. 
                    // To keep it simple, I'll move the expansion logic inside the card or keep it here.
                    // The original code used `expandedClasses[sub.subjectId]` which was a bit buggy (shared IDs).
                    // Let's make the card self-contained for expansion if possible, or just remove expansion for now as user didn't ask for it.
                    // Wait, the expansion was for "missing entries".
                    // I'll just render the content.
                    />
                ))}
            </div>



            {/* Mobile View: Toggle + Content */}
            <div className="md:hidden flex flex-col space-y-4">
                {/* View Switcher */}
                <div className="flex justify-end px-2">
                    <label className="flex items-center space-x-2 text-sm text-gray-600">
                        <input
                            type="checkbox"
                            checked={!isCompactMode}
                            onChange={() => setIsCompactMode(!isCompactMode)}
                            className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                        <span>Show All Classes (Full Overview)</span>
                    </label>
                </div>

                {summaryData.length > 0 ? (
                    <>
                        {isCompactMode ? (
                            /* Compact View: Select + Single Card */
                            <>
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                                    <label htmlFor="mobile-class-select" className="block text-sm font-medium text-gray-700 mb-2">
                                        Select Class to View
                                    </label>
                                    <select
                                        id="mobile-class-select"
                                        value={selectedClassId || ''}
                                        onChange={(e) => setSelectedClassId(Number(e.target.value))}
                                        className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border"
                                    >
                                        {summaryData.map((cls) => (
                                            <option key={cls.classId} value={cls.classId}>
                                                {cls.className}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {selectedClassData && (
                                    <ClassScoreCard
                                        clsSummary={selectedClassData}
                                        expandedClasses={expandedClasses}
                                    />
                                )}
                            </>
                        ) : (
                            /* Full View: List of All Cards */
                            <div className="flex flex-col space-y-6">
                                {summaryData.map((clsSummary) => (
                                    <ClassScoreCard
                                        key={clsSummary.classId}
                                        clsSummary={clsSummary}
                                        expandedClasses={expandedClasses}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-500">
                        No class data available.
                    </div>
                )}
            </div>
        </div >
    );
};

// Extracted Sub-component
const ClassScoreCard: React.FC<{
    clsSummary: any;
    expandedClasses: Record<number, boolean>;
}> = ({ clsSummary, expandedClasses }) => {
    return (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col h-full">
            <div className="bg-gray-50 p-4 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-800">{clsSummary.className}</h2>
                <span className="text-sm text-gray-500">{clsSummary.subjects.length > 0 ? `${clsSummary.subjects[0].totalStudents} Students` : 'No Students'}</span>
            </div>

            <div className="p-4 space-y-4 flex-1 overflow-y-auto max-h-[500px]">
                {clsSummary.subjects.length === 0 ? (
                    <p className="text-gray-400 italic text-sm">No subjects or data available.</p>
                ) : (
                    clsSummary.subjects.map((sub: any) => {
                        const percentComplete = sub.totalAssessmentsExpected > 0
                            ? Math.round((sub.completedAssessments / sub.totalAssessmentsExpected) * 100)
                            : 0;

                        const isComplete = percentComplete === 100;
                        const hasMissing = sub.missingEntries.length > 0;

                        return (
                            <div key={sub.subjectId} className="border border-gray-100 rounded-lg p-3 hover:shadow-sm transition-shadow">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-semibold text-gray-700">{sub.subjectName}</h3>
                                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${isComplete ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-800'}`}>
                                        {percentComplete}% Done
                                    </span>
                                </div>

                                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                                    <div
                                        className={`h-2 rounded-full transition-all duration-500 ${isComplete ? 'bg-green-500' : 'bg-blue-500'}`}
                                        style={{ width: `${percentComplete}%` }}
                                    ></div>
                                </div>

                                <div className="flex justify-between items-center text-xs text-gray-500">
                                    <span>{sub.completedAssessments} / {sub.totalAssessmentsExpected} Entries</span>
                                </div>

                                {hasMissing && (
                                    <div className="mt-3 pt-2 border-t border-gray-100">
                                        <details className="group">
                                            <summary className="flex items-center text-xs font-medium text-red-500 cursor-pointer hover:text-red-600 select-none">
                                                <svg className="w-4 h-4 mr-1 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                                {sub.missingEntries.length} Students with missing scores
                                            </summary>
                                            <div className="mt-2 pl-2 space-y-1 max-h-40 overflow-y-auto">
                                                {sub.missingEntries.map((entry: any, idx: number) => (
                                                    <div key={idx} className="text-xs text-gray-600 flex flex-col bg-red-50 p-2 rounded">
                                                        <span className="font-medium text-red-700">{entry.studentName}</span>
                                                        <span className="text-red-500 opacity-80 pl-2 border-l-2 border-red-200">
                                                            Missing: {entry.missingAssessments.join(', ')}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </details>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};


export default ScoreSummary;
