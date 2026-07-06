import React, { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { useUser } from '../../context/UserContext';
import { sortClassesByName } from '../../utils/classSort';
import { exportSubjectAnalysisExcel } from '../../utils/exportUtils';
import useLocalStorage from '../../hooks/useLocalStorage';
import StudentPreviewModal from '../modals/StudentPreviewModal';
import { Student, Subject } from '../../types';
import { getNumericGradeMap, calculateAggregateScore } from '../../utils/gradingUtils';

const SubjectAnalysis: React.FC = () => {
    const data = useData();
    const { classes, students, subjects, grades, scores, assessments, refreshFromCloud, loadScores, loadStudents, isFetching, isSyncing, isOnline } = data;
    const { currentUser } = useUser();

    const [selectedClassIds, setSelectedClassIds] = useLocalStorage<number[] | 'all' | ''>(
        'subject-analysis-selected-classes',
        ''
    );
    const [passMark, setPassMark] = useLocalStorage<number>(
        'subject-analysis-pass-aggregate',
        36
    );
    const [freezeHeader, setFreezeHeader] = useLocalStorage<boolean>('subject-analysis-freeze-header', true);
    const [freezeSubjects, setFreezeSubjects] = useLocalStorage<boolean>('subject-analysis-freeze-subjects', true);
    const [freezeGender, setFreezeGender] = useLocalStorage<boolean>('subject-analysis-freeze-gender', true);

    const [isSubjectAnalysisCollapsed, setIsSubjectAnalysisCollapsed] = useLocalStorage<boolean>('subject-analysis-subject-collapsed', false);
    const [isAggregateAnalysisCollapsed, setIsAggregateAnalysisCollapsed] = useLocalStorage<boolean>('subject-analysis-aggregate-collapsed', false);

    const [previewData, setPreviewData] = useState<{
        isOpen: boolean;
        title: string;
        students: Student[];
    }>({ isOpen: false, title: '', students: [] });

    // Initialize default class
    React.useEffect(() => {
        if (classes.length > 0 && !selectedClassIds) {
            const sorted = sortClassesByName(classes);
            setSelectedClassIds([sorted[0].id]);
        }
    }, [classes, selectedClassIds]);

    // Lazy load students
    React.useEffect(() => {
        loadStudents();
    }, [loadStudents]);

    // Lazy load scores when classes change
    React.useEffect(() => {
        if (selectedClassIds && subjects.length > 0) {
            subjects.forEach(subject => {
                if (selectedClassIds === 'all') {
                    loadScores(undefined, subject.id);
                } else {
                    selectedClassIds.forEach(id => {
                        loadScores(id, subject.id);
                    });
                }
            });
        }
    }, [selectedClassIds, subjects, loadScores]);

    const activeClasses = useMemo(() => {
        if (selectedClassIds === 'all') return classes;
        if (!Array.isArray(selectedClassIds)) return [];
        return classes.filter(c => selectedClassIds.includes(c.id));
    }, [classes, selectedClassIds]);

    const analysisData = useMemo(() => {
        if (activeClasses.length === 0 || students.length === 0 || grades.length === 0) return null;

        const activeClassNames = new Set(activeClasses.map(c => c.name));
        const classStudents = selectedClassIds === 'all'
            ? students
            : students.filter(s => activeClassNames.has(s.class));

        if (classStudents.length === 0) return null;

        const subjectGradeCounts: Record<string, Record<string, Record<string, number>>> = {};
        const aggregateCountsByGender: Record<string, Record<number, number>> = {
            'Male': {},
            'Female': {}
        };
        const allAggregates = new Set<number>();

        const gradeNames = [...grades].sort((a, b) => b.minScore - a.minScore).map(g => g.name);

        // Track student lists for each category
        const subjectGradeStudents: Record<string, Record<string, Record<string, Student[]>>> = {};
        const aggregateStudentsByGender: Record<string, Record<number, Student[]>> = {
            'Male': {},
            'Female': {}
        };

        const numericGradeMap = getNumericGradeMap(grades);
        const sortedGradesAsc = [...grades].sort((a, b) => b.minScore - a.minScore);

        const leastGradeValue = numericGradeMap.size > 0
            ? [...numericGradeMap.values()].reduce((max, v) => Math.max(max, v), 0)
            : 9;

        const examAssessments = assessments.filter(a => a.name.toLowerCase().includes('exam'));
        const classAssessments = assessments.filter(a => !a.name.toLowerCase().includes('exam'));

        const studentSubjectTotalScores = new Map<string, number>();

        scores.forEach(score => {
            const hasValidData = score.assessmentScores && Object.values(score.assessmentScores).some((val: any) => Array.isArray(val) && val.some((s: string) => s && typeof s === 'string' && s.trim() !== ''));

            if (hasValidData) {
                const classScore = classAssessments.reduce((total, assessment) => {
                    const vals = score.assessmentScores?.[assessment.id];
                    if (!vals || vals.length === 0) return total;
                    const totalScore = vals.reduce((sum, scoreStr) => sum + (Number((scoreStr || '').split('/')[0]) || 0), 0);
                    const totalMaxPossibleScore = vals.reduce((sum, scoreStr) => sum + (Number((scoreStr || '').split('/')[1]) || assessment.weight), 0);
                    if (totalMaxPossibleScore === 0) return total;
                    return total + (totalScore / totalMaxPossibleScore) * assessment.weight;
                }, 0);

                const examScore = examAssessments.reduce((total, assessment) => {
                    const vals = score.assessmentScores?.[assessment.id];
                    if (!vals || vals.length === 0) return total;
                    const sumOfScores = vals.reduce((sum, scoreStr) => sum + (Number((scoreStr || '').split('/')[0]) || 0), 0);
                    const averageScoreOutOf100 = sumOfScores / vals.length;
                    return total + (averageScoreOutOf100 / 100) * assessment.weight;
                }, 0);

                studentSubjectTotalScores.set(score.id, classScore + examScore);
            }
        });

        const studentIdToClass = new Map<number, string>();
        classStudents.forEach(s => studentIdToClass.set(s.id, s.class));

        const activeSubjectIdsPerClass = new Map<string, Set<number>>();
        const activeSubjectIdsTotal = new Set<number>();
        
        scores.forEach(score => {
            const sClass = studentIdToClass.get(score.studentId);
            if (sClass) {
                const totalScore = studentSubjectTotalScores.get(score.id);
                if (totalScore !== undefined && totalScore > 0) {
                    if (!activeSubjectIdsPerClass.has(sClass)) {
                        activeSubjectIdsPerClass.set(sClass, new Set<number>());
                    }
                    activeSubjectIdsPerClass.get(sClass)!.add(score.subjectId);
                    activeSubjectIdsTotal.add(score.subjectId);
                }
            }
        });

        const activeSubjectObjectsPerClass = new Map<string, Subject[]>();
        activeSubjectIdsPerClass.forEach((ids, className) => {
            activeSubjectObjectsPerClass.set(className, subjects.filter(s => ids.has(s.id)));
        });

        const activeSubjectObjectsTotal = subjects.filter(s => activeSubjectIdsTotal.has(s.id));
        const activeSubjectNamesTotal = new Set(activeSubjectObjectsTotal.map(s => s.subject));

        activeSubjectNamesTotal.forEach((subjectName: string) => {
            subjectGradeCounts[subjectName] = { 'Male': {}, 'Female': {}, 'Total': {} };
            gradeNames.forEach(g => {
                subjectGradeCounts[subjectName]['Male'][g] = 0;
                subjectGradeCounts[subjectName]['Female'][g] = 0;
                subjectGradeCounts[subjectName]['Total'][g] = 0;
            });
            subjectGradeStudents[subjectName] = { 'Male': {}, 'Female': {}, 'Total': {} };
            gradeNames.forEach(g => {
                subjectGradeStudents[subjectName]['Male'][g] = [];
                subjectGradeStudents[subjectName]['Female'][g] = [];
                subjectGradeStudents[subjectName]['Total'][g] = [];
            });
        });

        classStudents.forEach(student => {
            const genderKey = student.gender === 'Male' ? 'Male' : 'Female';
            const subjectResults: { subject: string, grade: string }[] = [];

            subjects.forEach(subject => {
                const totalScore = studentSubjectTotalScores.get(`${student.id}-${subject.id}`);
                if (totalScore !== undefined && totalScore > 0) {
                    const roundedMark = Math.round(totalScore);
                    const gradeInfo = sortedGradesAsc.find(g => roundedMark >= g.minScore && roundedMark <= g.maxScore);
                    const grade = gradeInfo?.name || '-';
                    subjectResults.push({ subject: subject.subject, grade });
                    if (grade !== '-') {
                        subjectGradeCounts[subject.subject][genderKey][grade]++;
                        subjectGradeCounts[subject.subject]['Total'][grade]++;
                        subjectGradeStudents[subject.subject][genderKey][grade].push(student);
                        subjectGradeStudents[subject.subject]['Total'][grade].push(student);
                    }
                }
            });

            const classActiveSubjectObjects = activeSubjectObjectsPerClass.get(student.class) || [];
            const studentGradesMap = new Map<string, string>();
            subjectResults.forEach(r => { if (r.grade !== '-') studentGradesMap.set(r.subject, r.grade); });

            const aggregateScore = calculateAggregateScore(studentGradesMap, classActiveSubjectObjects, numericGradeMap, leastGradeValue);

            if (aggregateScore > 0) {
                aggregateCountsByGender[genderKey][aggregateScore] = (aggregateCountsByGender[genderKey][aggregateScore] || 0) + 1;
                if (!aggregateStudentsByGender[genderKey][aggregateScore]) aggregateStudentsByGender[genderKey][aggregateScore] = [];
                aggregateStudentsByGender[genderKey][aggregateScore].push(student);
                allAggregates.add(aggregateScore);
            }
        });

        const activeSubjects = Object.keys(subjectGradeCounts).sort();
        let sortedAggregates: number[] = [];
        if (allAggregates.size > 0) {
            const minAgg = Math.min(...allAggregates);
            const maxAgg = Math.max(...allAggregates);
            for (let i = minAgg; i <= maxAgg; i++) sortedAggregates.push(i);
        }

        const passStats = {
            Male: { count: 0, percentage: 0 },
            Female: { count: 0, percentage: 0 },
            Total: { count: 0, percentage: 0 }
        };

        const activeClassNamesFilter = new Set(activeClasses.map(c => c.name));
        const maleTotal = students.filter(s => (selectedClassIds === 'all' || activeClassNamesFilter.has(s.class)) && s.gender === 'Male').length;
        const femaleTotal = students.filter(s => (selectedClassIds === 'all' || activeClassNamesFilter.has(s.class)) && s.gender === 'Female').length;

        Object.entries(aggregateCountsByGender['Male']).forEach(([agg, count]) => { if (Number(agg) <= passMark) passStats.Male.count += count; });
        Object.entries(aggregateCountsByGender['Female']).forEach(([agg, count]) => { if (Number(agg) <= passMark) passStats.Female.count += count; });

        passStats.Total.count = passStats.Male.count + passStats.Female.count;
        passStats.Male.percentage = maleTotal > 0 ? (passStats.Male.count / maleTotal) * 100 : 0;
        passStats.Female.percentage = femaleTotal > 0 ? (passStats.Female.count / femaleTotal) * 100 : 0;
        passStats.Total.percentage = (maleTotal + femaleTotal) > 0 ? (passStats.Total.count / (maleTotal + femaleTotal)) * 100 : 0;

        let aggSum = 0, aggCount = 0;
        Object.values(aggregateCountsByGender).forEach(counts => {
            Object.entries(counts).forEach(([agg, count]) => {
                aggSum += Number(agg) * count;
                aggCount += count;
            });
        });
        const averageAggregate = aggCount > 0 ? (aggSum / aggCount).toFixed(1) : '-';

        return {
            subjectGradeCounts, aggregateCountsByGender, sortedAggregates, gradeNames, activeSubjects,
            totalStudents: classStudents.length, averageAggregate, passStats, subjectGradeStudents, aggregateStudentsByGender
        };
    }, [activeClasses, students, scores, assessments, subjects, grades, selectedClassIds, passMark]);

    const handleExportExcel = async () => {
        if (!analysisData) return;
        const classNamesStr = selectedClassIds === 'all' ? 'Entire School' : activeClasses.map(c => c.name).join(', ');
        const classNameTitle = selectedClassIds === 'all' ? 'Entire School' : (activeClasses.length === 1 ? activeClasses[0].name : `Selected Classes: ${classNamesStr}`);
        const filename = `Subject_Analysis_${selectedClassIds === 'all' ? 'Entire_School' : (activeClasses.length === 1 ? activeClasses[0].name : `${activeClasses.length}_Classes`)}_${new Date().toISOString().split('T')[0]}`;

        await exportSubjectAnalysisExcel(
            analysisData.subjectGradeCounts, analysisData.aggregateCountsByGender, analysisData.gradeNames,
            analysisData.activeSubjects, analysisData.sortedAggregates, analysisData.totalStudents,
            analysisData.averageAggregate, classNameTitle, filename, passMark, analysisData.passStats
        );
    };

    const handleExportPDF = () => {
        if (!analysisData) return;
        const { subjectGradeCounts, activeSubjects, gradeNames, sortedAggregates, aggregateCountsByGender, totalStudents, averageAggregate } = analysisData;
        const classNamesStr = selectedClassIds === 'all' ? 'Entire School' : activeClasses.map(c => c.name).join(', ');
        const classNameTitle = selectedClassIds === 'all' ? 'Entire School' : (activeClasses.length === 1 ? activeClasses[0].name : `Selected Classes: ${classNamesStr}`);
        const filename = `Subject_Analysis_${selectedClassIds === 'all' ? 'Entire_School' : (activeClasses.length === 1 ? activeClasses[0].name : `${activeClasses.length}_Classes`)}_${new Date().toISOString().split('T')[0]}`;

        const pdfDataSubject: any[][] = [];
        const headersSubject = ['SUBJECT', 'GENDER', ...gradeNames.map(g => `G${g}`), 'TOTAL'];
        activeSubjects.forEach(subject => {
            ['Male', 'Female', 'Total'].forEach(gender => {
                const row = [subject, gender];
                let total = 0;
                gradeNames.forEach(grade => {
                    const count = subjectGradeCounts[subject][gender][grade] || 0;
                    row.push(String(count)); total += count;
                });
                row.push(String(total));
                pdfDataSubject.push(row);
            });
        });

        const pdfDataAgg: any[][] = [];
        const headersAgg = ['GENDER', ...sortedAggregates.map(a => `Agg ${a}`), 'PASSED', 'PASS %', 'TOTAL'];
        ['Male', 'Female', 'Total'].forEach(gender => {
            const row = [gender];
            let genTotal = 0;
            sortedAggregates.forEach(agg => {
                const count = gender === 'Total' ? (aggregateCountsByGender['Male'][agg] || 0) + (aggregateCountsByGender['Female'][agg] || 0) : (aggregateCountsByGender[gender][agg] || 0);
                row.push(String(count)); genTotal += count;
            });
            const stats = gender === 'Total' ? analysisData.passStats.Total : (gender === 'Male' ? analysisData.passStats.Male : analysisData.passStats.Female);
            row.push(String(stats.count)); row.push(`${stats.percentage.toFixed(1)}%`);
            row.push(String(gender === 'Total' ? totalStudents : genTotal));
            pdfDataAgg.push(row);
        });

        import('jspdf').then(({ default: jsPDF }) => {
            import('jspdf-autotable').then(({ default: autoTable }) => {
                const doc = new jsPDF('l', 'mm', 'a4');
                doc.setFontSize(20); doc.text(`Subject Analysis Report`, 14, 20);
                doc.setFontSize(12); doc.text(classNameTitle, 14, 28);
                doc.setFontSize(10); doc.setTextColor(100); doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 34);
                doc.setTextColor(0);
                doc.text(`Total Students: ${totalStudents} | Average Aggregate: ${averageAggregate}`, 14, 40);
                doc.text(`Pass Aggregate: <= ${passMark} | Male Pass: ${analysisData.passStats.Male.count} (${analysisData.passStats.Male.percentage.toFixed(1)}%) | Female Pass: ${analysisData.passStats.Female.count} (${analysisData.passStats.Female.percentage.toFixed(1)}%)`, 14, 46);
                doc.setFontSize(14); doc.text("Section 1: Subject-wise Grade Analysis", 14, 56);

                autoTable(doc, {
                    head: [headersSubject], body: pdfDataSubject, startY: 62, theme: 'grid',
                    headStyles: { fillColor: [68, 114, 196] }, styles: { fontSize: 7, cellPadding: 1.5 },
                    didParseCell: (data) => { if (data.row.index % 3 === 2) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.fillColor = [240, 240, 240]; } }
                });

                const finalY = (doc as any).lastAutoTable.finalY + 15;
                doc.text("Section 2: Aggregate Performance Analysis", 14, finalY);
                autoTable(doc, { head: [headersAgg], body: pdfDataAgg, startY: finalY + 5, theme: 'grid', headStyles: { fillColor: [68, 114, 196] }, styles: { fontSize: 8, cellPadding: 2 } });
                doc.save(`${filename}.pdf`);
            });
        });
    };

    if (currentUser?.role !== 'Admin') return <div className="flex items-center justify-center h-full text-gray-500">Access Denied. Admin privilege required.</div>;

    const sortedClasses = sortClassesByName(classes);

    return (
        <div className="space-y-6 pb-10 pt-14 px-4 sm:px-0">
            <div className="flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">Subject Analysis</h1>
                        <p className="text-gray-600">Detailed breakdown of performance for {selectedClassIds === 'all' ? 'the entire school' : (activeClasses.length === 1 ? activeClasses[0].name : (activeClasses.length > 0 ? `${activeClasses.length} selected classes` : 'selected classes'))}.</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-6 pb-2">
                    <div className="flex flex-col gap-2">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Scope:</span>
                        <div className="flex flex-wrap gap-2 max-w-2xl">
                            <button onClick={() => setSelectedClassIds('all')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border ${selectedClassIds === 'all' ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>Entire School</button>
                            {sortedClasses.map(cls => (
                                <button key={cls.id} onClick={() => {
                                    if (selectedClassIds === 'all') setSelectedClassIds([cls.id]);
                                    else {
                                        const current = Array.isArray(selectedClassIds) ? selectedClassIds : [];
                                        if (current.includes(cls.id)) {
                                            const next = current.filter(id => id !== cls.id);
                                            setSelectedClassIds(next.length === 0 ? 'all' : next);
                                        } else setSelectedClassIds([...current, cls.id]);
                                    }
                                }} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${Array.isArray(selectedClassIds) && selectedClassIds.includes(cls.id) ? 'bg-blue-100 text-blue-700 border-blue-300 font-bold' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>{cls.name}</button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 border-l pl-6 border-gray-100">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1 whitespace-nowrap">Pass Aggregate:</span>
                        <input type="number" value={passMark} onChange={(e) => setPassMark(Math.max(1, Math.min(108, Number(e.target.value) || 0)))} className="w-20 px-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg border bg-white shadow-sm font-medium text-center" />
                        <div className="flex items-center gap-4 ml-4">
                            <div className="flex flex-col">
                                <span className="text-[10px] text-gray-400 uppercase font-black leading-none">Male Pass</span>
                                <span className="text-sm font-bold text-blue-600">{analysisData?.passStats.Male.count} ({analysisData?.passStats.Male.percentage.toFixed(1)}%)</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-gray-400 uppercase font-black leading-none">Female Pass</span>
                                <span className="text-sm font-bold text-rose-600">{analysisData?.passStats.Female.count} ({analysisData?.passStats.Female.percentage.toFixed(1)}%)</span>
                            </div>
                            <div className="flex flex-col border-l pl-4 border-gray-100">
                                <span className="text-[10px] text-gray-400 uppercase font-black leading-none">Total Pass</span>
                                <span className="text-sm font-bold text-gray-800">{analysisData?.passStats.Total.count} ({analysisData?.passStats.Total.percentage.toFixed(1)}%)</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                    <div className="flex flex-col items-center">
                        <button onClick={handleExportExcel} disabled={!analysisData} className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-white p-2 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50">
                            <svg className="h-5 w-5 text-emerald-600 transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </button>
                        <span className="mt-1 whitespace-nowrap text-[10px] font-semibold text-emerald-700">Excel</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <button onClick={handleExportPDF} disabled={!analysisData} className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-white p-2 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-rose-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50">
                            <svg className="h-5 w-5 text-rose-600 transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        </button>
                        <span className="mt-1 whitespace-nowrap text-[10px] font-semibold text-rose-700">PDF</span>
                    </div>
                    <div className="h-4 w-px bg-gray-200 mx-2"></div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Reports will include {activeClasses.length} selected classes</p>
                </div>
            </div>

            {(!analysisData) ? (
                <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-dashed border-gray-300">
                    <p className="text-gray-500">{(!selectedClassIds) ? 'Please select a class to view analysis.' : (isSyncing || isFetching) ? 'Fetching data...' : 'No score data found for the selected scope.'}</p>
                </div>
            ) : (
                <div className="space-y-12">
                    <div className={`bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden transition-all duration-300 ${isSubjectAnalysisCollapsed ? 'max-h-20' : 'max-h-full'}`}>
                        <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center flex-wrap gap-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => setIsSubjectAnalysisCollapsed(!isSubjectAnalysisCollapsed)}>
                            <div className="flex items-center gap-3">
                                <div className={`p-1 rounded-md transition-transform duration-300 ${isSubjectAnalysisCollapsed ? '-rotate-90' : ''}`}><svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg></div>
                                <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wider">Subject-wise Grade Analysis</h2>
                            </div>
                            {!isSubjectAnalysisCollapsed && (
                                <div className="hidden md:flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                                    <label className="flex items-center gap-2 text-sm font-medium text-gray-600 cursor-pointer select-none"><input type="checkbox" checked={freezeHeader} onChange={(e) => setFreezeHeader(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" /> Freeze Header</label>
                                    <label className="flex items-center gap-2 text-sm font-medium text-gray-600 cursor-pointer select-none"><input type="checkbox" checked={freezeSubjects} onChange={(e) => { const checked = e.target.checked; setFreezeSubjects(checked); if (!checked) setFreezeGender(false); }} className="w-4 h-4 text-blue-600 rounded" /> Freeze Subjects</label>
                                    {freezeSubjects && <label className="flex items-center gap-2 text-sm font-medium text-gray-600 cursor-pointer select-none"><input type="checkbox" checked={freezeGender} onChange={(e) => setFreezeGender(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" /> Freeze Gender</label>}
                                </div>
                            )}
                        </div>
                        {!isSubjectAnalysisCollapsed && (
                            <div className="hidden md:block overflow-x-auto overflow-y-auto max-h-[600px]">
                                <table className="w-full text-left border-collapse">
                                    <thead className={freezeHeader ? "sticky top-0 z-20 shadow-sm" : ""}>
                                        <tr className="bg-gray-100 border-b">
                                            <th className={`p-3 font-semibold text-gray-600 border-r text-xs bg-gray-100 w-40 min-w-40 ${freezeHeader ? 'sticky top-0' : ''} ${freezeSubjects ? 'sticky left-0' : ''} ${(freezeHeader || freezeSubjects) ? 'z-30' : ''} ${(freezeHeader && freezeSubjects) ? 'z-40' : ''}`}>SUBJECT</th>
                                            <th className={`p-3 font-semibold text-gray-600 border-r text-xs bg-gray-100 ${freezeHeader ? 'sticky top-0' : ''} ${freezeGender ? 'sticky left-40' : ''} ${(freezeHeader || freezeGender) ? 'z-30' : ''} ${(freezeHeader && freezeGender) ? 'z-40' : ''}`}>GENDER</th>
                                            {analysisData.gradeNames.map(grade => (<th key={grade} className={`p-3 text-center font-semibold text-gray-600 text-xs bg-gray-100 ${freezeHeader ? 'sticky top-0 z-20' : ''}`}>Grade {grade}</th>))}
                                            <th className={`p-3 text-center font-semibold text-gray-600 bg-blue-50 text-xs border-l ${freezeHeader ? 'sticky top-0 z-20' : ''}`}>TOTAL</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {analysisData.activeSubjects.map(subject => {
                                            const genders = ['Male', 'Female', 'Total'] as const;
                                            return (
                                                <React.Fragment key={subject}>
                                                    {genders.map((gender, gIdx) => (
                                                        <tr key={`${subject}-${gender}`} className={`border-b hover:bg-gray-50 transition-colors ${gender === 'Total' ? 'bg-gray-100/50 font-bold' : ''}`}>
                                                            {gIdx === 0 && (<td rowSpan={3} className={`p-3 font-bold text-gray-800 border-r text-sm align-middle w-40 min-w-40 bg-white ${freezeSubjects ? 'sticky left-0 z-10' : ''}`}>{subject}</td>)}
                                                            <td className={`p-3 text-[10px] font-bold uppercase tracking-tight border-r ${gender === 'Male' ? 'text-blue-600' : gender === 'Female' ? 'text-rose-600' : 'text-gray-700'} ${freezeGender ? (gIdx === 0 ? 'sticky left-40 z-10 bg-white' : gIdx === 2 ? 'sticky left-40 bg-gray-100/50 z-10' : 'sticky left-40 bg-white z-10') : (gIdx === 2 ? 'bg-gray-100/50' : 'bg-white')}`}>{gender}</td>
                                                            {analysisData.gradeNames.map(grade => {
                                                                const count = analysisData.subjectGradeCounts[subject][gender][grade];
                                                                const studentsList = analysisData.subjectGradeStudents[subject]?.[gender]?.[grade] || [];
                                                                return (<td key={grade} className={`p-3 text-center text-sm ${count > 0 ? (gender === 'Total' ? 'text-gray-900 font-bold hover:bg-blue-100 cursor-pointer' : 'text-blue-600 hover:bg-blue-50 cursor-pointer') : 'text-gray-200'} transition-colors`} onClick={() => { if (count > 0) setPreviewData({ isOpen: true, title: `${subject} - Grade ${grade} (${gender})`, students: studentsList }); }}>{count || 0}</td>);
                                                            })}
                                                            <td className={`p-3 text-center font-bold text-sm border-l ${gender === 'Total' ? 'bg-blue-100 text-blue-900 hover:bg-blue-200' : 'bg-blue-50/20 text-blue-800 hover:bg-blue-100'} cursor-pointer transition-colors`} onClick={() => { const allSubjectStudents = Object.values(analysisData.subjectGradeStudents[subject]?.[gender] || {}).flat(); if (allSubjectStudents.length > 0) setPreviewData({ isOpen: true, title: `${subject} - All ${gender} Graded`, students: allSubjectStudents }); }}>{Object.values(analysisData.subjectGradeCounts[subject][gender]).reduce((a: number, b: number) => a + b, 0)}</td>
                                                        </tr>
                                                    ))}
                                                    <tr className="h-2 bg-gray-50/30"></tr>
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {!isSubjectAnalysisCollapsed && (
                            <div className="md:hidden p-4 space-y-4 max-h-[600px] overflow-y-auto bg-gray-50">
                                {analysisData.activeSubjects.map(subject => (
                                    <div key={subject} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                        <div className="bg-blue-600 px-4 py-2"><h3 className="text-white font-bold text-sm uppercase tracking-wider">{subject}</h3></div>
                                        <div className="p-3 space-y-3">
                                            {(['Male', 'Female', 'Total'] as const).map(gender => (
                                                <div key={gender} className={`rounded-lg p-2 ${gender === 'Total' ? 'bg-blue-50/50' : 'bg-gray-50'}`}>
                                                    <div className="flex justify-between items-center mb-2 px-1">
                                                        <span className={`text-[10px] font-black uppercase tracking-widest ${gender === 'Male' ? 'text-blue-600' : gender === 'Female' ? 'text-rose-600' : 'text-gray-700'}`}>{gender}</span>
                                                        <span className="text-[10px] bg-white px-2 py-0.5 rounded-full border border-gray-200 font-bold text-gray-500 shadow-sm">Total: {Object.values(analysisData.subjectGradeCounts[subject][gender]).reduce((a: number, b: number) => a + b, 0)}</span>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        {analysisData.gradeNames.map(grade => {
                                                            const count = analysisData.subjectGradeCounts[subject][gender][grade];
                                                            const studentsList = analysisData.subjectGradeStudents[subject]?.[gender]?.[grade] || [];
                                                            return (<div key={grade} onClick={() => { if (count > 0) setPreviewData({ isOpen: true, title: `${subject} - Grade ${grade} (${gender})`, students: studentsList }); }} className={`flex flex-col items-center justify-center p-1.5 rounded-md border transition-all ${count > 0 ? 'bg-white border-blue-200 shadow-sm active:scale-95' : 'bg-gray-50/50 border-gray-100 opacity-40'}`}><span className="text-[9px] text-gray-400 font-bold">G{grade}</span><span className={`text-sm font-black ${count > 0 ? 'text-blue-600' : 'text-gray-300'}`}>{count || 0}</span></div>);
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className={`bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden transition-all duration-300 ${isAggregateAnalysisCollapsed ? 'max-h-20' : 'max-h-full'}`}>
                        <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => setIsAggregateAnalysisCollapsed(!isAggregateAnalysisCollapsed)}>
                            <div className="flex items-center gap-3">
                                <div className={`p-1 rounded-md transition-transform duration-300 ${isAggregateAnalysisCollapsed ? '-rotate-90' : ''}`}><svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg></div>
                                <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wider">Aggregate Performance Analysis</h2>
                            </div>
                        </div>
                        {!isAggregateAnalysisCollapsed && (
                            <>
                                <div className="hidden md:block overflow-x-auto overflow-y-auto max-h-[400px]">
                                    <table className="w-full text-left border-collapse">
                                        <thead className={freezeHeader ? "sticky top-0 z-20 shadow-sm" : ""}>
                                            <tr className="bg-gray-100 border-b">
                                                <th className={`p-4 font-semibold text-gray-600 border-r w-32 text-xs bg-gray-100 ${freezeHeader ? 'sticky top-0' : ''} ${freezeSubjects ? 'sticky left-0' : ''} ${(freezeHeader || freezeSubjects) ? 'z-30' : ''} ${(freezeHeader && freezeSubjects) ? 'z-40' : ''}`}>GENDER</th>
                                                {analysisData.sortedAggregates.map(agg => (<th key={agg} className={`p-4 text-center font-semibold text-gray-600 whitespace-nowrap min-w-16 text-xs bg-gray-100 ${freezeHeader ? 'sticky top-0 z-20' : ''}`}>Agg {agg}</th>))}
                                                <th className={`p-4 text-center font-semibold text-emerald-600 bg-emerald-50 whitespace-nowrap border-l text-xs ${freezeHeader ? 'sticky top-0 z-20' : ''}`}>PASSED</th>
                                                <th className={`p-4 text-center font-semibold text-emerald-600 bg-emerald-50 whitespace-nowrap border-l text-xs ${freezeHeader ? 'sticky top-0 z-20' : ''}`}>PASS %</th>
                                                <th className={`p-4 text-center font-semibold text-gray-600 bg-blue-50 whitespace-nowrap border-l text-xs ${freezeHeader ? 'sticky top-0 z-20' : ''}`}>TOTAL</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(['Male', 'Female', 'Total'] as const).map(gender => (
                                                <tr key={gender} className={`border-b hover:bg-gray-50 transition-colors ${gender === 'Total' ? 'bg-gray-200/50 font-bold border-t-2 border-gray-300' : ''}`}>
                                                    <td className={`p-4 font-bold ${gender === 'Male' ? 'text-blue-600' : gender === 'Female' ? 'text-rose-600' : 'text-gray-800'} border-r text-sm bg-white ${freezeSubjects ? 'sticky left-0 z-10' : ''}`}>{gender}</td>
                                                    {analysisData.sortedAggregates.map(agg => {
                                                        const count = gender === 'Total' ? (analysisData.aggregateCountsByGender['Male'][agg] || 0) + (analysisData.aggregateCountsByGender['Female'][agg] || 0) : (analysisData.aggregateCountsByGender[gender][agg] || 0) as number;
                                                        const studentsList = gender === 'Total' ? [...(analysisData.aggregateStudentsByGender['Male'][agg] || []), ...(analysisData.aggregateStudentsByGender['Female'][agg] || [])] : (analysisData.aggregateStudentsByGender[gender][agg] || []);
                                                        return (<td key={agg} className={`p-4 text-center text-sm ${count > 0 ? 'text-gray-900 font-bold hover:bg-blue-100 cursor-pointer' : 'text-gray-300'} transition-colors`} onClick={() => { if (count > 0) setPreviewData({ isOpen: true, title: `Aggregate ${agg} - ${gender} Students`, students: studentsList }); }}>{count}</td>);
                                                    })}
                                                    <td className={`p-4 text-center font-bold text-emerald-700 ${gender === 'Total' ? 'bg-emerald-100' : 'bg-emerald-50'} border-l text-sm`}>{gender === 'Total' ? analysisData.passStats.Total.count : analysisData.passStats[gender].count}</td>
                                                    <td className={`p-4 text-center font-bold text-emerald-700 ${gender === 'Total' ? 'bg-emerald-100' : 'bg-emerald-50'} border-l text-sm`}>{gender === 'Total' ? analysisData.passStats.Total.percentage.toFixed(1) : analysisData.passStats[gender].percentage.toFixed(1)}%</td>
                                                    <td className={`p-4 text-center font-bold text-blue-800 ${gender === 'Total' ? 'bg-blue-100' : 'bg-blue-50'} border-l text-sm`} onClick={() => { if (gender === 'Total') { const allAggStudents = Object.values(analysisData.aggregateStudentsByGender).flatMap(genderMap => Object.values(genderMap)).flat(); if (allAggStudents.length > 0) setPreviewData({ isOpen: true, title: `All Graded Students`, students: allAggStudents }); } }}>{gender === 'Total' ? analysisData.totalStudents : Object.values(analysisData.aggregateCountsByGender[gender]).reduce((a: number, b: number) => a + b, 0)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="md:hidden p-4 space-y-6 bg-gray-50">
                                    {(['Male', 'Female', 'Total'] as const).map(gender => (
                                        <div key={gender} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                            <div className={`px-4 py-3 flex justify-between items-center ${gender === 'Male' ? 'bg-blue-600' : gender === 'Female' ? 'bg-rose-600' : 'bg-gray-800'}`}><h3 className="text-white font-bold uppercase tracking-widest">{gender}</h3><div className="flex items-center gap-2"><span className="text-[10px] text-white/70 uppercase font-bold">Total:</span><span className="text-white font-black">{gender === 'Total' ? analysisData.totalStudents : Object.values(analysisData.aggregateCountsByGender[gender]).reduce((a: number, b: number) => a + b, 0)}</span></div></div>
                                            <div className="p-4 space-y-4">
                                                <div className="grid grid-cols-2 gap-3"><div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100"><p className="text-[10px] text-emerald-600 font-black uppercase mb-1">Passed</p><p className="text-xl font-black text-emerald-700">{gender === 'Total' ? analysisData.passStats.Total.count : analysisData.passStats[gender].count}</p></div><div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100"><p className="text-[10px] text-emerald-600 font-black uppercase mb-1">Pass %</p><p className="text-xl font-black text-emerald-700">{gender === 'Total' ? analysisData.passStats.Total.percentage.toFixed(1) : analysisData.passStats[gender].percentage.toFixed(1)}%</p></div></div>
                                                <div className="border-t border-gray-100 pt-3"><p className="text-[10px] text-gray-400 font-black uppercase mb-2">Aggregate Breakdown</p><div className="grid grid-cols-4 gap-2">{analysisData.sortedAggregates.map(agg => { const count = gender === 'Total' ? (analysisData.aggregateCountsByGender['Male'][agg] || 0) + (analysisData.aggregateCountsByGender['Female'][agg] || 0) : (analysisData.aggregateCountsByGender[gender][agg] || 0) as number; const studentsList = gender === 'Total' ? [...(analysisData.aggregateStudentsByGender['Male'][agg] || []), ...(analysisData.aggregateStudentsByGender['Female'][agg] || [])] : (analysisData.aggregateStudentsByGender[gender][agg] || []); return (<div key={agg} onClick={() => { if (count > 0) setPreviewData({ isOpen: true, title: `Agg ${agg} - ${gender}`, students: studentsList }); }} className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${count > 0 ? 'bg-white border-blue-100 shadow-sm active:scale-95' : 'bg-gray-50/50 border-gray-50 opacity-30'}`}><span className="text-[9px] text-gray-400 font-bold">{agg}</span><span className={`text-xs font-black ${count > 0 ? 'text-blue-600' : 'text-gray-300'}`}>{count || 0}</span></div>); })}</div></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 flex items-center gap-4">
                            <div className="bg-blue-100 p-3 rounded-lg text-blue-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg></div>
                            <div><p className="text-sm text-gray-500 font-medium">Population</p><p className="text-2xl font-bold text-gray-800">{analysisData.totalStudents}</p></div>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 flex items-center gap-4">
                            <div className="bg-amber-100 p-3 rounded-lg text-amber-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg></div>
                            <div><p className="text-sm text-gray-500 font-medium">Avg Aggregate</p><p className="text-2xl font-bold text-gray-800">{analysisData.averageAggregate}</p></div>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 flex items-center gap-4">
                            <div className="bg-emerald-100 p-3 rounded-lg text-emerald-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></div>
                            <div><p className="text-sm text-gray-500 font-medium">Active Subjects</p><p className="text-2xl font-bold text-gray-800">{analysisData.activeSubjects.length}</p></div>
                        </div>
                    </div>
                </div>
            )}

            <StudentPreviewModal
                isOpen={previewData.isOpen}
                onClose={() => setPreviewData(prev => ({ ...prev, isOpen: false }))}
                title={previewData.title}
                students={previewData.students}
            />
        </div>
    );
};

export default SubjectAnalysis;
