import React, { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { useUser } from '../../context/UserContext';
import { calculateReportData } from '../../hooks/useReportCardData';
import { sortClassesByName } from '../../utils/classSort';

const SubjectAnalysis: React.FC = () => {
    const data = useData();
    const { classes, students, subjects, grades, scores, assessments, refreshFromCloud, loadScores, loadStudents, isFetching, isSyncing, isOnline } = data;
    const { currentUser } = useUser();

    const [selectedClassId, setSelectedClassId] = useState<number | ''>('');

    // Initialize default class
    React.useEffect(() => {
        if (classes.length > 0 && !selectedClassId) {
            const sorted = sortClassesByName(classes);
            setSelectedClassId(sorted[0].id);
        }
    }, [classes, selectedClassId]);

    // Lazy load students
    React.useEffect(() => {
        loadStudents();
    }, [loadStudents]);

    // Lazy load scores when class changes
    React.useEffect(() => {
        if (selectedClassId && subjects.length > 0) {
            subjects.forEach(subject => {
                loadScores(selectedClassId as number, subject.id);
            });
        }
    }, [selectedClassId, subjects, loadScores]);

    const activeClass = useMemo(() => classes.find(c => c.id === selectedClassId), [classes, selectedClassId]);

    const analysisData = useMemo(() => {
        if (!activeClass || students.length === 0 || grades.length === 0) return null;

        const classStudents = students.filter(s => s.class === activeClass.name);
        if (classStudents.length === 0) return null;

        const subjectGradeCounts: Record<string, Record<string, Record<string, number>>> = {};
        const aggregateCountsByGender: Record<string, Record<number, number>> = {
            'Male': {},
            'Female': {}
        };
        const allAggregates = new Set<number>();

        // Unique grade names for columns
        const gradeNames = [...grades].sort((a, b) => b.minScore - a.minScore).map(g => g.name);

        classStudents.forEach(student => {
            const report = calculateReportData(student, data);
            const genderKey = student.gender === 'Male' ? 'Male' : 'Female';

            // Subject analysis (Gender Separated)
            report.subjectResults.forEach(res => {
                if (res.totalScore > 0 && res.grade !== '-') {
                    if (!subjectGradeCounts[res.subject]) {
                        subjectGradeCounts[res.subject] = {
                            'Male': {},
                            'Female': {},
                            'Total': {}
                        };
                        gradeNames.forEach(g => {
                            subjectGradeCounts[res.subject]['Male'][g] = 0;
                            subjectGradeCounts[res.subject]['Female'][g] = 0;
                            subjectGradeCounts[res.subject]['Total'][g] = 0;
                        });
                    }
                    subjectGradeCounts[res.subject][genderKey][res.grade]++;
                    subjectGradeCounts[res.subject]['Total'][res.grade]++;
                }
            });

            // Aggregate analysis by gender (Agg 6 onwards)
            if (report.aggregateScore >= 6) {
                aggregateCountsByGender[genderKey][report.aggregateScore] = (aggregateCountsByGender[genderKey][report.aggregateScore] || 0) + 1;
                allAggregates.add(report.aggregateScore);
            }
        });

        // Filter subjects to only those that have at least one score
        const activeSubjects = Object.keys(subjectGradeCounts).sort();

        // Sorted unique aggregate scores
        const sortedAggregates = Array.from(allAggregates).sort((a, b) => a - b);

        // Average Aggregate
        let aggSum = 0;
        let aggCount = 0;
        Object.values(aggregateCountsByGender).forEach(counts => {
            Object.entries(counts).forEach(([agg, count]) => {
                aggSum += Number(agg) * count;
                aggCount += count;
            });
        });
        const averageAggregate = aggCount > 0 ? (aggSum / aggCount).toFixed(1) : '-';

        return {
            subjectGradeCounts,
            aggregateCountsByGender,
            sortedAggregates,
            gradeNames,
            activeSubjects,
            totalStudents: classStudents.length,
            averageAggregate
        };
    }, [activeClass, students, data, grades]);

    if (currentUser?.role !== 'Admin') {
        return (
            <div className="flex items-center justify-center h-full text-gray-500">
                Access Denied. Admin privilege required.
            </div>
        );
    }

    const sortedClasses = sortClassesByName(classes);

    return (
        <div className="space-y-6 pb-10 pt-14 px-4 sm:px-0">
            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Subject Analysis</h1>
                    <p className="text-gray-600">Detailed breakdown of performance for {activeClass?.name || 'selected class'}.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 pb-2">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Class:</span>
                        <select
                            value={selectedClassId}
                            onChange={(e) => setSelectedClassId(Number(e.target.value))}
                            className="pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg border bg-white shadow-sm font-medium"
                        >
                            <option value="">-- Select Class --</option>
                            {sortedClasses.map((cls) => (
                                <option key={cls.id} value={cls.id}>
                                    {cls.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={() => refreshFromCloud()}
                        disabled={isSyncing || !isOnline}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-sm transition-all border ${isSyncing || !isOnline
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                            : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300 hover:shadow-md active:scale-95'
                            }`}
                        title="Refresh Data"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span className="text-sm font-bold uppercase tracking-tight">Sync Cloud</span>
                    </button>
                </div>
            </div>

            {(!analysisData) ? (
                <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-dashed border-gray-300">
                    <p className="text-gray-500">
                        {(!selectedClassId) ? 'Please select a class to view analysis.' : (isSyncing || isFetching) ? 'Fetching data...' : 'No score data found for this class.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-12">
                    {/* Subject-wise Grade Analysis Table */}
                    <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                        <div className="p-4 bg-gray-50 border-b border-gray-100">
                            <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wider">Subject-wise Grade Analysis</h2>
                        </div>
                        <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-20 shadow-sm">
                                    <tr className="bg-gray-100 border-b">
                                        <th className="p-3 font-semibold text-gray-600 border-r text-xs sticky top-0 bg-gray-100 z-30">SUBJECT</th>
                                        <th className="p-3 font-semibold text-gray-600 border-r text-xs sticky top-0 bg-gray-100 z-30">GENDER</th>
                                        {analysisData.gradeNames.map(grade => (
                                            <th key={grade} className="p-3 text-center font-semibold text-gray-600 text-xs sticky top-0 bg-gray-100">
                                                Grade {grade}
                                            </th>
                                        ))}
                                        <th className="p-3 text-center font-semibold text-gray-600 bg-blue-50 text-xs border-l sticky top-0">TOTAL</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {analysisData.activeSubjects.map(subject => {
                                        const genders = ['Male', 'Female', 'Total'] as const;
                                        return (
                                            <React.Fragment key={subject}>
                                                {genders.map((gender, gIdx) => (
                                                    <tr key={`${subject}-${gender}`} className={`border-b hover:bg-gray-50 transition-colors ${gender === 'Total' ? 'bg-gray-100/50 font-bold' : ''}`}>
                                                        {gIdx === 0 && (
                                                            <td rowSpan={3} className="p-3 font-bold text-gray-800 border-r text-sm align-middle bg-white">
                                                                {subject}
                                                            </td>
                                                        )}
                                                        <td className={`p-3 text-[10px] font-bold uppercase tracking-tight border-r ${gender === 'Male' ? 'text-blue-600' : gender === 'Female' ? 'text-rose-600' : 'text-gray-700'}`}>
                                                            {gender}
                                                        </td>
                                                        {analysisData.gradeNames.map(grade => {
                                                            const count = analysisData.subjectGradeCounts[subject][gender][grade];
                                                            return (
                                                                <td key={grade} className={`p-3 text-center text-sm ${count > 0 ? (gender === 'Total' ? 'text-gray-900 font-bold' : 'text-blue-600') : 'text-gray-200'}`}>
                                                                    {count || 0}
                                                                </td>
                                                            );
                                                        })}
                                                        <td className={`p-3 text-center font-bold text-sm border-l ${gender === 'Total' ? 'bg-blue-100 text-blue-900' : 'bg-blue-50/20 text-blue-800'}`}>
                                                            {Object.values(analysisData.subjectGradeCounts[subject][gender]).reduce((a, b) => a + b, 0)}
                                                        </td>
                                                    </tr>
                                                ))}
                                                <tr className="h-2 bg-gray-50/30"></tr> {/* Tiny spacer between subjects */}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Aggregate Performance Analysis (Gender Breakdown) */}
                    <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                        <div className="p-4 bg-gray-50 border-b border-gray-100">
                            <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wider">Aggregate Performance Analysis</h2>
                        </div>
                        <div className="overflow-x-auto overflow-y-auto max-h-[400px]">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-20 shadow-sm">
                                    <tr className="bg-gray-100 border-b">
                                        <th className="p-4 font-semibold text-gray-600 border-r w-32 sticky left-0 top-0 bg-gray-100 text-xs z-30">GENDER</th>
                                        {analysisData.sortedAggregates.map(agg => (
                                            <th key={agg} className="p-4 text-center font-semibold text-gray-600 whitespace-nowrap min-w-16 text-xs sticky top-0 bg-gray-100">
                                                Agg {agg}
                                            </th>
                                        ))}
                                        <th className="p-4 text-center font-semibold text-gray-600 bg-blue-50 whitespace-nowrap border-l text-xs sticky top-0">TOTAL</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Male Row */}
                                    <tr className="border-b hover:bg-gray-50 transition-colors">
                                        <td className="p-4 font-bold text-blue-600 border-r sticky left-0 bg-white text-sm">Male</td>
                                        {analysisData.sortedAggregates.map(agg => {
                                            const count = (analysisData.aggregateCountsByGender['Male'][agg] || 0) as number;
                                            return (
                                                <td key={agg} className={`p-4 text-center text-sm ${count > 0 ? 'text-gray-900 font-bold' : 'text-gray-300'}`}>
                                                    {count}
                                                </td>
                                            );
                                        })}
                                        <td className="p-4 text-center font-bold text-blue-800 bg-blue-50/30 border-l text-sm">
                                            {Object.values(analysisData.aggregateCountsByGender['Male']).reduce((a: number, b: number) => a + b, 0)}
                                        </td>
                                    </tr>
                                    {/* Female Row */}
                                    <tr className="border-b hover:bg-gray-50 transition-colors">
                                        <td className="p-4 font-bold text-rose-600 border-r sticky left-0 bg-white text-sm">Female</td>
                                        {analysisData.sortedAggregates.map(agg => {
                                            const count = (analysisData.aggregateCountsByGender['Female'][agg] || 0) as number;
                                            return (
                                                <td key={agg} className={`p-4 text-center text-sm ${count > 0 ? 'text-gray-900 font-bold' : 'text-gray-300'}`}>
                                                    {count}
                                                </td>
                                            );
                                        })}
                                        <td className="p-4 text-center font-bold text-rose-800 bg-rose-50/30 border-l text-sm">
                                            {Object.values(analysisData.aggregateCountsByGender['Female']).reduce((a: number, b: number) => a + b, 0)}
                                        </td>
                                    </tr>
                                    {/* Total Row */}
                                    <tr className="bg-gray-200/50 font-bold border-t-2 border-gray-300">
                                        <td className="p-4 text-gray-800 border-r sticky left-0 bg-gray-200/50 text-sm italic">TOTAL</td>
                                        {analysisData.sortedAggregates.map(agg => {
                                            const maleCount = (analysisData.aggregateCountsByGender['Male'][agg] || 0) as number;
                                            const femaleCount = (analysisData.aggregateCountsByGender['Female'][agg] || 0) as number;
                                            const total = maleCount + femaleCount;
                                            return (
                                                <td key={agg} className="p-4 text-center text-gray-900 text-sm">
                                                    {total}
                                                </td>
                                            );
                                        })}
                                        <td className="p-4 text-center text-blue-900 bg-blue-100 border-l text-sm">
                                            {analysisData.totalStudents}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        {analysisData.sortedAggregates.length === 0 && (
                            <div className="p-10 text-center text-gray-400 italic">
                                No valid aggregates (Agg 6-54) found for this class.
                            </div>
                        )}
                    </div>

                    {/* Class Summary Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 flex items-center gap-4">
                            <div className="bg-blue-100 p-3 rounded-lg text-blue-600">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 font-medium">Population</p>
                                <p className="text-2xl font-bold text-gray-800">{analysisData.totalStudents}</p>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 flex items-center gap-4">
                            <div className="bg-amber-100 p-3 rounded-lg text-amber-600">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 font-medium">Avg Aggregate</p>
                                <p className="text-2xl font-bold text-gray-800">{analysisData.averageAggregate}</p>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 flex items-center gap-4">
                            <div className="bg-emerald-100 p-3 rounded-lg text-emerald-600">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 font-medium">Active Subjects</p>
                                <p className="text-2xl font-bold text-gray-800">{analysisData.activeSubjects.length}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubjectAnalysis;
