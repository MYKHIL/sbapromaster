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
    const { students, subjects, classes, assessments, getStudentScores } = useData();
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

    if (currentUser?.role !== 'Admin') {
        return (
            <div className="flex items-center justify-center h-full text-gray-500">
                Access Denied. Admin privilege required.
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-10">
            <h1 className="text-3xl font-bold text-gray-800">Score Entry Summary</h1>
            <p className="text-gray-600">Overview of score entries across all classes and subjects.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {summaryData.map((clsSummary) => (
                    <div key={clsSummary.classId} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col">
                        <div className="bg-gray-50 p-4 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-gray-800">{clsSummary.className}</h2>
                            <span className="text-sm text-gray-500">{clsSummary.subjects.length > 0 ? `${clsSummary.subjects[0].totalStudents} Students` : 'No Students'}</span>
                        </div>

                        <div className="p-4 space-y-4 flex-1 overflow-y-auto max-h-[500px]">
                            {clsSummary.subjects.length === 0 ? (
                                <p className="text-gray-400 italic text-sm">No subjects or data available.</p>
                            ) : (
                                clsSummary.subjects.map(sub => {
                                    const percentComplete = sub.totalAssessmentsExpected > 0
                                        ? Math.round((sub.completedAssessments / sub.totalAssessmentsExpected) * 100)
                                        : 0;

                                    const isComplete = percentComplete === 100;
                                    const hasMissing = sub.missingEntries.length > 0;
                                    const uniqueKey = `${clsSummary.classId}-${sub.subjectId}`;
                                    const isExpanded = expandedClasses[sub.subjectId]; // Using subject ID might conflict if subjects shared, better used unique key logic if strictly needed, but simple for now.
                                    // Actually let's use a composite key for state
                                    // Re-implementing specific toggle logic below

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
                                                            {sub.missingEntries.map((entry, idx) => (
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
                ))}
            </div>
        </div>
    );
};

export default ScoreSummary;
