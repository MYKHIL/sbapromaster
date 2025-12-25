import React, { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { useUser } from '../../context/UserContext';
import UserSelectionModal from '../UserSelectionModal';
import { Notification } from '../../types';
import ReadOnlyWrapper from '../ReadOnlyWrapper';
import { sortClassesByName } from '../../utils/classSort';

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
    scorePercentage: number;

    // New Remarks Data
    remarksStats: {
        totalStudents: number;
        completedRemarks: number;
        missingEntries: MissingRemarkEntry[];
        percentage: number;
    };

    overallPercentage: number;
}

interface MissingRemarkEntry {
    studentName: string;
    missingFields: string[];
}

const ScoreSummary: React.FC = () => {
    const { students, subjects, classes, assessments, getStudentScores, refreshFromCloud, isSyncing, isOnline, users, reportData, getReportData, updateStudent, loadScores } = useData();
    const { currentUser } = useUser();

    // State to toggle specific class view details
    const [expandedClasses, setExpandedClasses] = useState<Record<number, boolean>>({});

    const toggleClass = (classId: number) => {
        setExpandedClasses(prev => ({
            ...prev,
            [classId]: !prev[classId]
        }));
    };

    // Lazy load all scores for summary
    React.useEffect(() => {
        if (subjects && subjects.length > 0) {
            console.log('[ScoreSummary] 📥 Triggering batch score load for all subjects...');
            subjects.forEach(sub => loadScores(0, sub.id));
        }
    }, [subjects, loadScores]);

    const summaryData = useMemo(() => {
        if (!classes || !students || !assessments || !subjects) return [];

        return sortClassesByName(classes).map(cls => {
            const classStudents = students.filter(s => s.class === cls.name);

            // If no students in class, return basic info with complete structure to prevent crashes
            if (classStudents.length === 0) {
                return {
                    classId: cls.id,
                    className: cls.name,
                    subjects: [],
                    scorePercentage: 0,
                    remarksStats: {
                        totalStudents: 0,
                        completedRemarks: 0,
                        missingEntries: [],
                        percentage: 0
                    },
                    overallPercentage: 0
                };
            }

            // STRATEGY: Use classSubjects mapping if available, otherwise fall back to score-based filtering

            // Step 1: Find subjects assigned via classSubjects mapping
            const mappedSubjects = new Set<number>();
            if (users && users.length > 0) {
                users
                    .filter(user => user.role !== 'Guest')
                    .forEach(user => {
                        const classSubjects = user.classSubjects?.[cls.name];
                        if (classSubjects && classSubjects.length > 0) {
                            classSubjects.forEach(subjectName => {
                                const subject = subjects.find(s => s.subject === subjectName);
                                if (subject) mappedSubjects.add(subject.id);
                            });
                        }
                    });
            }

            // Step 2: Find subjects that have existing score data for students in this class
            const subjectsWithScores = new Set<number>();
            classStudents.forEach(student => {
                subjects.forEach(sub => {
                    // Check if this subject has any scores for this student
                    assessments.forEach(assessment => {
                        const score = getStudentScores(student.id, sub.id, assessment.id);
                        if (score && score.length > 0 && score[0] !== '') {
                            subjectsWithScores.add(sub.id);
                        }
                    });
                });
            });

            // Step 3: Combine mapped subjects AND subjects with scores
            // This ensures we show both teacher-assigned subjects AND subjects with existing data (admin-entered)
            const relevantSubjects = new Set([...mappedSubjects, ...subjectsWithScores]);

            const filteredSubjects = relevantSubjects.size > 0
                ? subjects.filter(sub => relevantSubjects.has(sub.id))
                : subjects;

            const subjectSummaries: SubjectSummary[] = filteredSubjects.map(sub => {
                let completedCount = 0;
                const missingEntries: MissingEntry[] = [];

                // Calculate expected assessments (students * assessments)
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

            // Calculate overall percentage for the class (Scores)
            const totalExpectedScores = subjectSummaries.reduce((sum, sub) => sum + sub.totalAssessmentsExpected, 0);
            const totalCompletedScores = subjectSummaries.reduce((sum, sub) => sum + sub.completedAssessments, 0);
            const scorePercentage = totalExpectedScores > 0 ? Math.round((totalCompletedScores / totalExpectedScores) * 100) : 0;

            // --- Remarks/Reports Statistics ---
            const remarksMissingEntries: MissingRemarkEntry[] = [];
            let completedRemarksCount = 0;
            const requiredFields = ['attendance', 'conduct', 'interest', 'attitude', 'teacherRemark'];
            const fieldLabels: Record<string, string> = {
                attendance: 'Attendance',
                conduct: 'Conduct',
                interest: 'Interest',
                attitude: 'Attitude',
                teacherRemark: 'Teacher Remark'
            };

            classStudents.forEach(student => {
                // We use getReportData from context or directly from reportData array if needed.
                // context's getReportData maps over reportData array.
                // Since this is inside a loop, retrieving from the reportData array directly via lookup might be faster if we pre-map it,
                // but getReportData(id) is fine for now as it just finds in array.
                const rData = getReportData(student.id);
                const missingFields: string[] = [];

                if (rData) {
                    requiredFields.forEach(field => {
                        const val = rData[field as keyof typeof rData];
                        if (!val || (typeof val === 'string' && val.trim() === '')) {
                            missingFields.push(fieldLabels[field]);
                        }
                    });
                } else {
                    // No data at all means all fields missing
                    requiredFields.forEach(field => missingFields.push(fieldLabels[field]));
                }

                if (missingFields.length > 0) {
                    remarksMissingEntries.push({
                        studentName: student.name,
                        missingFields
                    });
                } else {
                    completedRemarksCount++;
                }
            });

            const totalStudents = classStudents.length;
            const remarksPercentage = totalStudents > 0 ? Math.round((completedRemarksCount / totalStudents) * 100) : 0;

            // Overall Percentage (Average of Score% and Remark%)
            // Alternatively: Weighted average based on number of items.
            // Let's use simple average for visibility.
            const overallPercentage = Math.round((scorePercentage + remarksPercentage) / 2);

            return {
                classId: cls.id,
                className: cls.name,
                subjects: subjectSummaries,
                scorePercentage,
                remarksStats: {
                    totalStudents,
                    completedRemarks: completedRemarksCount,
                    missingEntries: remarksMissingEntries,
                    percentage: remarksPercentage
                },
                overallPercentage
            };
        });
    }, [classes, students, subjects, assessments, getStudentScores, users, reportData, getReportData]);

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
                                        key={selectedClassData.classId}
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
    const { loadImportedData, users: allUsers } = useData();
    const { currentUser } = useUser();

    // Modal State
    const [isNotifyModalOpen, setIsNotifyModalOpen] = useState(false);
    const [notified, setNotified] = useState(false);

    // Calculate pending stats for message
    const autoMessage = useMemo(() => {
        let lines = [`Action Required: ${clsSummary.className} Status Report`];

        // Scores Section (First)
        const subjectsWithMissing = clsSummary.subjects.filter((s: any) => s.missingEntries.length > 0);
        if (subjectsWithMissing.length > 0) {
            lines.push(`\nMISSING SCORES:`);
            subjectsWithMissing.forEach((sub: any) => {
                // Determine if listing every student is too long? Users asked for "specific".
                sub.missingEntries.forEach((entry: any) => {
                    lines.push(`- ${sub.subjectName}: ${entry.studentName} (${entry.missingAssessments.join(', ')})`);
                });
            });
        }

        // Remarks Section (Second)
        if (clsSummary.remarksStats.missingEntries.length > 0) {
            lines.push(`\nMISSING REMARKS (${clsSummary.remarksStats.missingEntries.length} Students):`);
            clsSummary.remarksStats.missingEntries.forEach((entry: any) => {
                lines.push(`- ${entry.studentName}: ${entry.missingFields.join(', ')}`);
            });
        }

        return lines.join('\n');
    }, [clsSummary]);

    // Filter potential recipients (teachers of this class + admins)
    const targetUsers = useMemo(() => {
        if (!allUsers) return [];
        // Include ALL admins and teachers, regardless of class assignment
        return allUsers.filter(u => u.role === 'Admin' || u.role === 'Teacher');
    }, [allUsers]);

    const handleSendNotification = (selectedUserIds: number[], message: string, viaWhatsApp: boolean) => {
        if (!allUsers || !currentUser) return;

        // 1. WhatsApp Logic
        if (viaWhatsApp) {
            // Create a generic link for the admin to copy or send? 
            // Requirement: "option of sending... via whatsapp". 
            // We'll construct a text and open whatsapp.
            const text = encodeURIComponent(`*SBA Pro Alert*\n${message}\n\n_Sent by ${currentUser.name}_`);
            window.open(`https://wa.me/?text=${text}`, '_blank');
        }

        // 2. System Logic
        const newNotification: Notification = {
            id: Date.now().toString(),
            senderId: currentUser.id, // Current Admin ID
            senderName: currentUser.name,
            type: 'missing_data_alert',
            context: {
                classId: clsSummary.classId,
                dataType: 'scores' // Or 'remarks', or general? 'scores' logic covers general for now
            },
            message: message,
            link: 'Report Viewer',
            read: false,
            date: new Date().toISOString(),
        };

        const updatedUsers = allUsers.map(u => {
            if (selectedUserIds.includes(u.id)) {
                return {
                    ...u,
                    notifications: [...(u.notifications || []), newNotification]
                };
            }
            return u;
        });

        loadImportedData({ users: updatedUsers }, false);
        setNotified(true);
        setTimeout(() => setNotified(false), 3000);
    };


    return (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col h-full">
            <div className="bg-gray-50 p-4 border-b border-gray-100 flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold text-gray-800">{clsSummary.className}</h2>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${clsSummary.overallPercentage === 100 ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'
                            }`}>
                            {clsSummary.overallPercentage}% Overall
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsNotifyModalOpen(true)}
                        disabled={notified || (clsSummary.overallPercentage === 100)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all ${notified
                            ? 'bg-green-50 text-green-600 border-green-200'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'
                            }`}
                        title="Send alert to assigned teachers"
                    >
                        {notified ? 'Alert Sent!' : '🔔 Notify'}
                    </button>
                </div>
            </div>

            <UserSelectionModal
                isOpen={isNotifyModalOpen}
                onClose={() => setIsNotifyModalOpen(false)}
                onSend={handleSendNotification}
                defaultMessage={autoMessage}
                contextTitle={clsSummary.className}
                users={targetUsers}
            />

            <div className="p-4 space-y-6 flex-1 overflow-y-auto max-h-[600px]">
                {/* Subjects Section (First) */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center mb-1">
                        <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wider text-xs">Subject Scores</h3>
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${clsSummary.scorePercentage === 100 ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                            {clsSummary.scorePercentage}% Done
                        </span>
                    </div>
                    {clsSummary.subjects.length === 0 ? (
                        <p className="text-gray-400 italic text-sm">No subjects available.</p>
                    ) : (
                        clsSummary.subjects.map((sub: any) => {
                            const percentComplete = sub.totalAssessmentsExpected > 0
                                ? Math.round((sub.completedAssessments / sub.totalAssessmentsExpected) * 100)
                                : 0;

                            const isComplete = percentComplete === 100;
                            const hasMissing = sub.missingEntries.length > 0;

                            return (
                                <div key={sub.subjectId} className="border border-gray-100 rounded-lg p-3 hover:shadow-sm transition-shadow bg-white">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="font-semibold text-gray-700 text-sm">{sub.subjectName}</h3>
                                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${isComplete ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                            {percentComplete}%
                                        </span>
                                    </div>

                                    <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
                                        <div
                                            className={`h-1.5 rounded-full transition-all duration-500 ${isComplete ? 'bg-green-500' : 'bg-blue-500'}`}
                                            style={{ width: `${percentComplete}%` }}
                                        ></div>
                                    </div>

                                    {hasMissing && (
                                        <div className="mt-2">
                                            <details className="group">
                                                <summary className="flex items-center text-xs text-red-500 cursor-pointer hover:text-red-600 select-none">
                                                    <svg className="w-3 h-3 mr-1 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                    {sub.missingEntries.length} Missing
                                                </summary>
                                                <div className="mt-2 pl-2 space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                                                    {sub.missingEntries.map((entry: any, idx: number) => (
                                                        <div key={idx} className="text-xs text-gray-500 flex flex-col bg-red-50 p-1.5 rounded">
                                                            <span className="font-medium text-red-800">{entry.studentName}</span>
                                                            <span className="text-red-400 text-[10px]">
                                                                {entry.missingAssessments.join(', ')}
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

                {/* Remarks Section (Second) */}
                <div className="border border-purple-100 bg-purple-50/50 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold text-purple-900 text-sm">Class Remarks</h3>
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${clsSummary.remarksStats.percentage === 100 ? 'bg-green-100 text-green-700' : 'bg-white text-purple-700 border border-purple-200'}`}>
                            {clsSummary.remarksStats.percentage}% Done
                        </span>
                    </div>

                    <div className="w-full bg-purple-200 rounded-full h-2 mb-2">
                        <div
                            className="h-2 rounded-full transition-all duration-500 bg-purple-500"
                            style={{ width: `${clsSummary.remarksStats.percentage}%` }}
                        ></div>
                    </div>

                    <div className="flex justify-between items-center text-xs text-purple-700 mb-1">
                        <span>{clsSummary.remarksStats.completedRemarks} / {clsSummary.remarksStats.totalStudents} Students Completed</span>
                    </div>

                    {clsSummary.remarksStats.missingEntries.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-purple-200">
                            <details className="group">
                                <summary className="flex items-center text-xs font-medium text-purple-800 cursor-pointer hover:text-purple-900 select-none">
                                    <svg className="w-4 h-4 mr-1 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                    {clsSummary.remarksStats.missingEntries.length} Students incomplete
                                </summary>
                                <div className="mt-2 pl-2 space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                                    {clsSummary.remarksStats.missingEntries.map((entry: any, idx: number) => (
                                        <div key={idx} className="text-xs text-purple-800 flex flex-col bg-white p-2 rounded border border-purple-100">
                                            <span className="font-medium">{entry.studentName}</span>
                                            <span className="text-purple-500 opacity-80 pl-2 border-l-2 border-purple-300 mt-1 text-[10px] uppercase tracking-wide">
                                                Missing: {entry.missingFields.join(', ')}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


export default ScoreSummary;
