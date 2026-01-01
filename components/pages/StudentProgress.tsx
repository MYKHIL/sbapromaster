import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { useUser } from '../../context/UserContext';
import { getSchoolHistory, type AppDataType, createDocumentId } from '../../services/firebaseService';
import type { Student, Score } from '../../types';
import { BarChart, LineChart, PieChart, MultiLineChart } from '../../components/SimpleCharts';
import jsPDF from 'jspdf';
// @ts-ignore
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import BroadsheetModal from '../modals/BroadsheetModal';

interface SubjectPerformance {
    subjectName: string;
    average: number;
    grade: string;
}

interface DetailedSubjectScore {
    subjectName: string;
    classScore: number; // Weighted
    examScore: number; // Weighted
    totalScore: number;
    grade: string;
}

interface StudentHistory {
    studentId: number; // Distinguish whose history this is
    termId: string; // school_year_term
    academicYear: string;
    academicTerm: string;
    class: string;
    averageScore: number;
    position: string;
    scores: Score[];
    subjectPerformance: SubjectPerformance[];
    detailedPerformance: DetailedSubjectScore[];
    rawTermData: AppDataType; // For Broadsheet
}

// Module-level cache for persistence across page navigation but not app reloads
let cachedSelectedStudentIds: number[] = [];

const StudentProgress: React.FC = () => {
    const { settings, students, schoolId, loadStudents, loadMetadata } = useData();
    const { currentUser } = useUser();

    // History Data State
    const [historyData, setHistoryData] = useState<AppDataType[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    // Selection State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStudents, setSelectedStudents] = useState<Student[]>(() => {
        if (cachedSelectedStudentIds.length > 0) {
            return students.filter(s => cachedSelectedStudentIds.includes(s.id));
        }
        return [];
    });

    // Update cache when selection changes
    useEffect(() => {
        cachedSelectedStudentIds = selectedStudents.map(s => s.id);
    }, [selectedStudents]);

    // Map: StudentID -> History Array
    const [historiesMap, setHistoriesMap] = useState<Record<number, StudentHistory[]>>({});

    // Access Control check
    const hasAccess = currentUser?.role === 'Admin' || settings.allowStudentProgressView;

    const contentRef = React.useRef<HTMLDivElement>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [expandedTermIds, setExpandedTermIds] = useState<string[]>([]);
    const [broadsheetModal, setBroadsheetModal] = useState<{ isOpen: boolean, termData?: AppDataType, targetClass?: string }>({ isOpen: false });

    const toggleTerm = (termId: string) => {
        setExpandedTermIds(prev =>
            prev.includes(termId) ? prev.filter(id => id !== termId) : [...prev, termId]
        );
    };

    // Lazy Load Data on Mount - Force refresh to ensure we have current data
    useEffect(() => {
        loadStudents(undefined, true); // Force refresh
        loadMetadata();
    }, [loadStudents, loadMetadata]);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!schoolId) return;
            setIsLoadingHistory(true);
            try {
                // Determine school name prefix from current ID
                // ID format: schoolname_year_term
                const prefix = schoolId.split('_')[0];
                console.log('[StudentProgress] Fetching history for school prefix:', prefix);
                if (prefix) {
                    const data = await getSchoolHistory(prefix);
                    console.log('[StudentProgress] History data fetched:', data.length, 'terms');
                    setHistoryData(data);
                }
            } catch (error) {
                console.error("[StudentProgress] Failed to fetch history:", error);
            } finally {
                setIsLoadingHistory(false);
            }
        };

        if (hasAccess) {
            fetchHistory();
        }
    }, [schoolId, hasAccess]);

    // Compute history when students are selected
    useEffect(() => {
        console.log('[StudentProgress] Computing history - students:', selectedStudents.length, 'history terms:', historyData.length);

        if (selectedStudents.length === 0 || historyData.length === 0) {
            setHistoriesMap({});
            return;
        }

        const newMap: Record<number, StudentHistory[]> = {};

        // Helper: Calculate Weighted Score (Reused logic)
        const calculateScoreForStudentSubject = (
            sId: number,
            subId: number,
            termScores: Score[],
            specificAssessments: any[]
        ) => {
            const scoreObj = termScores.find(s => String(s.studentId) === String(sId) && String(s.subjectId) === String(subId));
            if (!scoreObj) return 0;

            return specificAssessments.reduce((total, assessment) => {
                const scoresArr = scoreObj.assessmentScores?.[assessment.id] || [];
                if (scoresArr.length === 0) return total;
                const isExam = assessment.name.toLowerCase().includes('exam');
                if (isExam) {
                    const sumOfScores = scoresArr.reduce((sum: number, scoreStr: string) => sum + Number(scoreStr.split('/')[0]), 0);
                    const averageScoreOutOf100 = sumOfScores / scoresArr.length;
                    return total + ((averageScoreOutOf100 / 100) * assessment.weight);
                } else {
                    const totalScore = scoresArr.reduce((sum: number, scoreStr: string) => sum + Number(scoreStr.split('/')[0]), 0);
                    const totalMaxPossibleScore = scoresArr.reduce((sum: number, scoreStr: string) => sum + (Number(scoreStr.split('/')[1]) || assessment.weight), 0);
                    if (totalMaxPossibleScore === 0) return total;
                    return total + ((totalScore / totalMaxPossibleScore) * assessment.weight);
                }
            }, 0);
        };

        // 1. Pre-calculate Ranks for each Term
        const termRankings = historyData.map(termData => {
            const tScores = termData.scores || [];
            const tStudents = termData.students || [];
            const tAssessments = termData.assessments || [];
            const tSubjects = termData.subjects || [];

            const examAss = tAssessments.find(a => a.name.toLowerCase().includes('exam'));
            const classAss = tAssessments.filter(a => !examAss || a.id !== examAss.id);

            // Group students by CLASS first for correct ranking
            const classGroups: Record<string, typeof tStudents> = {};
            tStudents.forEach(s => {
                if (!classGroups[s.class]) classGroups[s.class] = [];
                classGroups[s.class].push(s);
            });

            // Calculate ranks per class
            const ranksPerClass: Record<string, { id: number, avg: number }[]> = {};

            Object.keys(classGroups).forEach(className => {
                const students = classGroups[className];
                const avgs = students.map(s => {
                    let totalPct = 0;
                    let count = 0;
                    const myScores = tScores.filter(sc => String(sc.studentId) === String(s.id));

                    tSubjects.forEach(sub => {
                        if (myScores.some(sc => String(sc.subjectId) === String(sub.id))) {
                            const cScore = calculateScoreForStudentSubject(s.id, sub.id, myScores, classAss);
                            const eScore = examAss ? calculateScoreForStudentSubject(s.id, sub.id, myScores, [examAss]) : 0;
                            if ((cScore + eScore) > 0) {
                                totalPct += (cScore + eScore);
                                count++;
                            }
                        }
                    });
                    return { id: s.id, avg: count > 0 ? totalPct / count : 0 };
                });

                avgs.sort((a, b) => b.avg - a.avg);
                ranksPerClass[className] = avgs;
            });

            return {
                uniqueId: createDocumentId(termData.settings.schoolName, termData.settings.academicYear, termData.settings.academicTerm),
                ranksPerClass // Now keyed by class name
            };
        });

        // 2. Build History
        selectedStudents.forEach(student => {
            console.log('[StudentProgress] Processing student:', student.name, 'ID:', student.id);
            const history: StudentHistory[] = [];

            historyData.forEach((termData, termIdx) => {
                let studentInTerm: Student | undefined;
                const termStudents = termData.students || [];

                if (student.indexNumber) {
                    studentInTerm = termStudents.find(s => s.indexNumber === student.indexNumber);
                }
                if (!studentInTerm) {
                    studentInTerm = termStudents.find(s => s.name.toLowerCase() === student.name.toLowerCase());
                }

                if (studentInTerm) {
                    const termScores = termData.scores || [];
                    const studentScores = termScores.filter(s => String(s.studentId) === String(studentInTerm!.id));

                    const subjectPerformances: SubjectPerformance[] = [];
                    const detailedPerformance: DetailedSubjectScore[] = [];

                    const termAssessments = termData.assessments || [];
                    const examAssessment = termAssessments.find(a => a.name.toLowerCase().includes('exam'));
                    const classAssessments = termAssessments.filter(a => !examAssessment || a.id !== examAssessment.id);
                    const termSubjects = termData.subjects || [];

                    let totalPercentage = 0;
                    let subjectCount = 0;

                    termSubjects.forEach(subject => {
                        const hasScore = studentScores.some(s => String(s.subjectId) === String(subject.id));
                        if (hasScore) {
                            const classScore = calculateScoreForStudentSubject(studentInTerm!.id, subject.id, studentScores, classAssessments);
                            const examScore = examAssessment ? calculateScoreForStudentSubject(studentInTerm!.id, subject.id, studentScores, [examAssessment]) : 0;
                            const totalScore = classScore + examScore;

                            if (totalScore > 0) {
                                totalPercentage += totalScore;
                                subjectCount++;
                                const roundedMark = Math.round(totalScore);
                                const termGrades = termData.grades || [];
                                const sortedGrades = [...termGrades].sort((a, b) => b.minScore - a.minScore);
                                const gradeInfo = sortedGrades.find(g => roundedMark >= g.minScore && roundedMark <= g.maxScore);
                                const grade = gradeInfo?.name || 'F';

                                subjectPerformances.push({
                                    subjectName: subject.subject,
                                    average: totalScore,
                                    grade: grade
                                });

                                detailedPerformance.push({
                                    subjectName: subject.subject,
                                    classScore: classScore,
                                    examScore: examScore,
                                    totalScore: totalScore,
                                    grade: grade
                                });
                            }
                        }
                    });

                    const average = subjectCount > 0 ? (totalPercentage / subjectCount) : 0;

                    // Determine Rank - WITHIN CLASS
                    const tRankMap = termRankings[termIdx];
                    const classRanks = tRankMap.ranksPerClass[studentInTerm!.class] || [];
                    const rankIndex = classRanks.findIndex(r => String(r.id) === String(studentInTerm!.id));
                    const mRank = rankIndex + 1;
                    const resultSuffix = (["st", "nd", "rd"][((mRank + 90) % 100 - 10) % 10 - 1] || "th");
                    const positionStr = mRank > 0 ? `${mRank}${resultSuffix}` : 'N/A';

                    // Count total students in class for context (e.g. 5th / 30)
                    const totalStudentsInClass = classRanks.length;
                    const positionDisplay = mRank > 0 ? `${positionStr} / ${totalStudentsInClass}` : 'N/A';

                    history.push({
                        studentId: student.id,
                        termId: createDocumentId(termData.settings.schoolName, termData.settings.academicYear, termData.settings.academicTerm),
                        academicYear: termData.settings.academicYear,
                        academicTerm: termData.settings.academicTerm,
                        class: studentInTerm.class,
                        averageScore: average,
                        position: positionDisplay,
                        scores: studentScores,
                        subjectPerformance: subjectPerformances,
                        detailedPerformance: detailedPerformance,
                        rawTermData: termData
                    });
                }
            });

            history.sort((a, b) => a.termId.localeCompare(b.termId));
            newMap[student.id] = history;
        });

        setHistoriesMap(newMap);

    }, [selectedStudents, historyData]);

    const handleSelectStudent = (student: Student) => {
        if (!selectedStudents.find(s => s.id === student.id)) {
            setSelectedStudents([...selectedStudents, student]);
        }
        setSearchQuery('');
    };

    const handleRemoveStudent = (studentId: number) => {
        setSelectedStudents(selectedStudents.filter(s => s.id !== studentId));
    };

    // --- Render Logic Variables (Single vs Multi) ---
    const isComparisonMode = selectedStudents.length > 1;
    // For single mode, alias the first student
    const singleStudent = selectedStudents.length === 1 ? selectedStudents[0] : null;
    const singleHistory = singleStudent ? historiesMap[singleStudent.id] || [] : [];

    // Filter students for search
    const filteredStudents = students.filter(s =>
        (s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.indexNumber.includes(searchQuery)) &&
        !selectedStudents.find(sel => sel.id === s.id) // Exclude already selected
    );


    // --- Insights Logic for Single Student ---
    const calculateInsights = (history: StudentHistory[]) => {
        if (history.length === 0) return { strengths: [], weaknesses: [] };
        const subjectAggregates: { [key: string]: { total: number, count: number } } = {};
        history.forEach(term => {
            term.subjectPerformance.forEach(subj => {
                if (!subjectAggregates[subj.subjectName]) {
                    subjectAggregates[subj.subjectName] = { total: 0, count: 0 };
                }
                subjectAggregates[subj.subjectName].total += subj.average;
                subjectAggregates[subj.subjectName].count++;
            });
        });
        const averages = Object.keys(subjectAggregates).map(name => ({
            name,
            avg: subjectAggregates[name].total / subjectAggregates[name].count
        }));
        averages.sort((a, b) => b.avg - a.avg);
        const strengths = averages.slice(0, 3).filter(s => s.avg >= 60);
        const weaknesses = averages.slice(-3).filter(s => s.avg < 60).reverse();
        return { strengths, weaknesses };
    };
    const singleInsights = singleStudent ? calculateInsights(singleHistory) : { strengths: [], weaknesses: [] };


    // --- Chart Data Preparation ---
    // Single
    const singleTrendData = singleHistory.map(h => ({
        label: `${h.academicTerm} ${h.academicYear.substring(2)}`,
        value: h.averageScore
    }));
    const singleLatestTerm = singleHistory[singleHistory.length - 1];
    const singleSubjectData = singleLatestTerm ? singleLatestTerm.subjectPerformance.map(s => ({
        label: s.subjectName.substring(0, 10),
        value: s.average,
        color: s.average >= 70 ? '#10b981' : s.average >= 50 ? '#3b82f6' : '#ef4444'
    })) : [];
    const singleGradeData = singleLatestTerm ? (() => {
        const gradeCounts: { [key: string]: number } = {};
        singleLatestTerm.subjectPerformance.forEach(s => {
            gradeCounts[s.grade] = (gradeCounts[s.grade] || 0) + 1;
        });
        const palette = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];
        return Object.entries(gradeCounts).map(([grade, count], i) => ({
            label: grade,
            value: count,
            color: palette[i % palette.length]
        })).sort((a, b) => b.value - a.value);
    })() : [];

    // Multi (Comparison)
    const comparisonSeries = selectedStudents.map((s, i) => {
        const hist = historiesMap[s.id] || [];
        const palette = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea', '#db2777', '#0891b2', '#4f46e5'];
        return {
            label: s.name,
            color: palette[i % palette.length],
            data: hist.map(h => ({
                label: `${h.academicTerm} ${h.academicYear.substring(2)}`,
                value: h.averageScore
            }))
        };
    });


    // --- PDF Generation Implementation ---
    const handleDownloadPdf = async (isComparison: boolean) => {
        setIsGeneratingPdf(true);
        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 15;
            let cursorY = margin;

            // Helper: Capture chart as image
            const captureChart = async (selector: string): Promise<string | null> => {
                const element = document.querySelector(selector);
                if (!element) return null;
                const canvas = await html2canvas(element as HTMLElement, {
                    scale: 2,
                    logging: false,
                    useCORS: true
                });
                return canvas.toDataURL('image/png');
            };

            // Helper: Safely add image to PDF  
            const addImageToPdf = async (img: string | null, x: number, y: number, width: number, height: number): Promise<boolean> => {
                if (!img) return false;
                try {
                    // Validate image data
                    if (!img.startsWith('data:image/png') || img.length < 100) {
                        console.warn('Invalid image data');
                        return false;
                    }
                    pdf.addImage(img, 'PNG', x, y, width, height);
                    return true;
                } catch (error) {
                    console.error('Failed to add image to PDF:', error);
                    return false;
                }
            };


            // Helper: Add broadsheet page for a term
            const addBroadsheetPage = async (termData: AppDataType, selectedStudentIds: number[], termLabel: string) => {
                const termStudents = (termData.students || []).filter(s =>
                    selectedStudents.some(sel => sel.class === s.class)
                );
                if (termStudents.length === 0) return;

                const targetClass = selectedStudents[0].class;
                const classStudents = termStudents.filter(s => s.class === targetClass);

                const termAssessments = termData.assessments || [];
                const termSubjects = termData.subjects || [];
                const termScores = termData.scores || [];

                const examAss = termAssessments.find(a => a.name.toLowerCase().includes('exam'));
                const classAss = termAssessments.filter(a => !examAss || a.id !== examAss.id);

                // Filter subjects: only include those where at least one class student has scores
                const subjectsWithScores = termSubjects.filter(subject => {
                    return classStudents.some(student => {
                        const scoreObj = termScores.find(s =>
                            String(s.studentId) === String(student.id) &&
                            String(s.subjectId) === String(subject.id)
                        );
                        if (!scoreObj) return false;

                        // Check if any assessment has scores
                        const hasClassScores = classAss.some(ass => {
                            const rawArr = scoreObj.assessmentScores?.[ass.id] || [];
                            return rawArr.length > 0;
                        });
                        const hasExamScores = examAss && (scoreObj.assessmentScores?.[examAss.id]?.length || 0) > 0;

                        return hasClassScores || hasExamScores;
                    });
                });

                // Generate broadsheet for each subject with scores
                for (const subject of subjectsWithScores) {
                    pdf.addPage();

                    pdf.setFontSize(14);
                    pdf.setFont("helvetica", "bold");
                    pdf.text(`Broadsheet: ${termLabel}`, pageWidth / 2, 15, { align: 'center' });
                    pdf.setFontSize(10);
                    pdf.setFont("helvetica", "normal");
                    pdf.text(`Class: ${targetClass} | Subject: ${subject.subject}`, pageWidth / 2, 22, { align: 'center' });

                    const rows = classStudents.map(student => {
                        const scoreObj = termScores.find(s => String(s.studentId) === String(student.id) && String(s.subjectId) === String(subject.id));

                        const rawScores: string[] = [];
                        let subTotalA = 0;
                        let subTotalB = 0;

                        classAss.forEach(ass => {
                            const rawArr = scoreObj?.assessmentScores?.[ass.id] || [];
                            rawScores.push(rawArr.map(r => r.split('/')[0]).join(', ') || '-');

                            const rawSum = rawArr.reduce((a, b) => a + Number(b.split('/')[0]), 0);
                            const maxSum = rawArr.reduce((a, b) => a + (Number(b.split('/')[1]) || ass.weight), 0);
                            if (maxSum > 0) subTotalA += (rawSum / maxSum * ass.weight);
                        });

                        if (examAss) {
                            const rawArr = scoreObj?.assessmentScores?.[examAss.id] || [];
                            rawScores.push(rawArr.map(r => r.split('/')[0]).join(', ') || '-');
                            const avg = rawArr.length > 0 ? rawArr.reduce((a, b) => a + Number(b.split('/')[0]), 0) / rawArr.length : 0;
                            subTotalB += (avg / 100 * examAss.weight);
                        }

                        const total = subTotalA + subTotalB;
                        return {
                            name: student.name,
                            indexNumber: student.indexNumber || '-',
                            rawScores,
                            subTotalA: subTotalA.toFixed(1),
                            subTotalB: subTotalB.toFixed(1),
                            total: total.toFixed(0),
                            isSelected: selectedStudentIds.includes(student.id)
                        };
                    }).sort((a, b) => Number(b.total) - Number(a.total));

                    // Add position
                    const finalRows = rows.map((row, idx) => {
                        const pos = idx + 1;
                        const suffix = (["st", "nd", "rd"][((pos + 90) % 100 - 10) % 10 - 1] || "th");
                        return [...Object.values({ ...row, position: `${pos}${suffix}`, isSelected: undefined }), row.isSelected];
                    });

                    const headers = ['Name', 'Index', ...classAss.map(a => a.name), 'Sub A', examAss?.name || 'Exam', 'Sub B', 'Total', 'Pos'];

                    (autoTable as any)(pdf, {
                        startY: 30,
                        head: [headers],
                        body: finalRows.map(r => r.slice(0, -1)),
                        margin: { left: margin, right: margin },
                        styles: { fontSize: 7, cellPadding: 1.5 },
                        theme: 'grid',
                        didParseCell: function (data: any) {
                            const rowData = finalRows[data.row.index];
                            if (rowData && rowData[rowData.length - 1]) { // isSelected
                                data.cell.styles.fillColor = [255, 252, 200]; // Light yellow
                                data.cell.styles.fontStyle = 'bold';
                                data.cell.styles.textColor = [0, 0, 0];
                            }
                        }
                    });
                }
            };

            // Header
            pdf.setFontSize(18);
            pdf.setTextColor(40, 40, 40);
            pdf.text(isComparison ? "Student Comparison Report" : "Student Progress Report", pageWidth / 2, cursorY, { align: 'center' });
            cursorY += 10;
            pdf.setFontSize(10);
            pdf.setTextColor(100);
            pdf.text(settings.schoolName || "School Name", pageWidth / 2, cursorY, { align: 'center' });
            cursorY += 15;

            if (isComparison) {
                // COMPARISON PDF
                // Note: Charts skipped - html2canvas not reliable in PDF context

                // Table 1: Average Scores Comparison
                const terms = Array.from(new Set((Object.values(historiesMap) as StudentHistory[][]).flatMap(hArr => hArr.map(h => `${h.academicTerm} ${h.academicYear.substring(2)}`)))).sort();
                const head = [['Student', ...terms, 'Overall Avg']];
                const body = selectedStudents.map(s => {
                    const hist = historiesMap[s.id] || [];
                    const row = [s.name];
                    let totalSum = 0;
                    let count = 0;

                    terms.forEach(termLabel => {
                        const termStats = hist.find(h => `${h.academicTerm} ${h.academicYear.substring(2)}` === termLabel);
                        if (termStats) {
                            row.push(`${termStats.averageScore.toFixed(1)}%`);
                            totalSum += termStats.averageScore;
                            count++;
                        } else {
                            row.push('-');
                        }
                    });
                    const overall = count > 0 ? (totalSum / count).toFixed(1) + '%' : '-';
                    row.push(overall);
                    return row;
                });

                (autoTable as any)(pdf, {
                    startY: cursorY,
                    head: head,
                    body: body,
                    margin: { left: margin, right: margin },
                    styles: { fontSize: 8, cellPadding: 2 },
                    theme: 'grid'
                });

                cursorY = (pdf as any).lastAutoTable.finalY + 10;

                // Add broadsheet pages for ALL selected students across all their terms
                const allTermsWithStudents: Array<{ data: AppDataType, studentIds: number[], label: string }> = [];

                selectedStudents.forEach(student => {
                    const hist = historiesMap[student.id] || [];
                    hist.forEach(termHist => {
                        if (termHist.rawTermData) {
                            const termLabel = `${termHist.academicTerm} ${termHist.academicYear}`;
                            // Check if this term already exists
                            let existingTerm = allTermsWithStudents.find(t => t.label === termLabel);
                            if (existingTerm) {
                                // Add this student to existing term
                                if (!existingTerm.studentIds.includes(student.id)) {
                                    existingTerm.studentIds.push(student.id);
                                }
                            } else {
                                // Create new term entry
                                allTermsWithStudents.push({
                                    data: termHist.rawTermData,
                                    studentIds: [student.id],
                                    label: termLabel
                                });
                            }
                        }
                    });
                });

                // Generate broadsheets for each unique term with all its students
                for (const term of allTermsWithStudents) {
                    await addBroadsheetPage(term.data, term.studentIds, term.label);
                }

                pdf.save(`Comparison_Report_${new Date().toISOString().split('T')[0]}.pdf`);

            } else {
                // SINGLE STUDENT PDF
                if (!singleStudent) return;

                // Student Info
                pdf.setDrawColor(200);
                pdf.setFillColor(248, 250, 252);
                pdf.rect(margin, cursorY, pageWidth - (margin * 2), 25, 'FD');
                pdf.setFontSize(12);
                pdf.setTextColor(0);
                pdf.setFont("helvetica", "bold");
                pdf.text(singleStudent.name, margin + 5, cursorY + 8);
                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(10);
                pdf.setTextColor(80);
                pdf.text(`Index: ${singleStudent.indexNumber}`, margin + 5, cursorY + 16);
                pdf.text(`Class: ${singleStudent.class}`, margin + 5, cursorY + 22);
                cursorY += 35;

                // Note: Charts skipped - html2canvas not reliable in PDF context

                const subjects = Array.from(new Set(singleHistory.flatMap(h => h.subjectPerformance.map(s => s.subjectName)))).sort();
                const terms = singleHistory.map(h => `${h.academicTerm} ${h.academicYear.substring(2)}`);
                const tHead = [['Subject', ...terms, 'Avg']];
                const tBody = subjects.map(subj => {
                    const row = [subj];
                    let totalScore = 0;
                    let count = 0;
                    singleHistory.forEach(h => {
                        const perf = h.subjectPerformance.find(p => p.subjectName === subj);
                        if (perf) {
                            row.push(`${perf.average.toFixed(0)}%`);
                            totalScore += perf.average;
                            count++;
                        } else {
                            row.push('-');
                        }
                    });
                    const avg = count > 0 ? (totalScore / count).toFixed(0) + '%' : '-';
                    row.push(avg);
                    return row;
                });

                (autoTable as any)(pdf, {
                    startY: cursorY,
                    head: tHead,
                    body: tBody,
                    margin: { left: margin, right: margin },
                });

                // Add broadsheet pages for each term
                for (const termHist of singleHistory) {
                    if (termHist.rawTermData) {
                        await addBroadsheetPage(
                            termHist.rawTermData,
                            [singleStudent.id],
                            `${termHist.academicTerm} ${termHist.academicYear}`
                        );
                    }
                }

                pdf.save(`${singleStudent.name}_Progress_Report.pdf`);
            }
        } catch (error) {
            console.error("PDF Error", error);
            alert("Failed to generate PDF");
        } finally {
            setIsGeneratingPdf(false);
        }
    };


    if (!hasAccess) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center p-8 bg-white rounded-xl shadow-lg">
                    <p className="text-gray-600">Access Restricted</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-10 pt-16 animate-fade-in relative">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Student Progress</h1>
                    <p className="text-gray-600 mt-1">
                        {isComparisonMode ? `Comparing ${selectedStudents.length} Students` : "Track academic performance over time."}
                    </p>
                </div>
                {/* Print Button */}
                {selectedStudents.length > 0 && (
                    <button
                        onClick={() => handleDownloadPdf(isComparisonMode)}
                        disabled={isGeneratingPdf}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors text-sm font-medium"
                    >
                        {isGeneratingPdf ? 'Generating...' : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                {isComparisonMode ? "Download Comparison" : "Download Report"}
                            </>
                        )}
                    </button>
                )}
            </div>

            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200" ref={contentRef}>
                {/* Search & Selection Section */}
                <div className="mb-6" data-html2canvas-ignore="true">

                    {/* Selected Students Chips */}
                    {selectedStudents.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                            {selectedStudents.map(s => (
                                <span key={s.id} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                                    {s.name}
                                    <button onClick={() => handleRemoveStudent(s.id)} className="ml-2 text-blue-600 hover:text-blue-900 focus:outline-none">
                                        ×
                                    </button>
                                </span>
                            ))}
                            {selectedStudents.length > 0 && (
                                <button onClick={() => setSelectedStudents([])} className="text-xs text-gray-500 underline ml-2 hover:text-red-500">
                                    Clear All
                                </button>
                            )}
                        </div>
                    )}

                    <label className="block text-sm font-medium text-gray-700 mb-2">Add Student to View</label>
                    <div className="relative">
                        <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder={selectedStudents.length > 0 ? "Add another student to compare..." : "Search by name or index number..."}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <div className="absolute z-10 w-full bg-white mt-1 border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                {filteredStudents.length === 0 ? (
                                    <div className="p-3 text-gray-500 text-sm text-center">No matching students found</div>
                                ) : (
                                    filteredStudents.slice(0, 10).map(s => (
                                        <div
                                            key={s.id}
                                            onClick={() => handleSelectStudent(s)}
                                            className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 flex items-center gap-3 transition-colors"
                                        >
                                            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                                                {s.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-800">{s.name}</p>
                                                <p className="text-xs text-gray-500">{s.indexNumber} • {s.class}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {isComparisonMode ? (
                    /* --- COMPARISON VIEW --- */
                    <div className="space-y-8 animate-fade-in-up">
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-6">
                            <h2 className="text-lg font-bold text-gray-800 mb-2">Comparison Overview</h2>
                            <p className="text-sm text-gray-600">Analysing performance differences across {selectedStudents.length} selected students.</p>
                        </div>

                        {/* Comparison Chart */}
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col h-80">
                            <MultiLineChart series={comparisonSeries} title="Performance Trend Comparison" height={280} />
                        </div>

                        {/* Quick Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {selectedStudents.map(s => {
                                const h = historiesMap[s.id] || [];

                                // Calculate cumulative average across all terms with data
                                const termsWithData = h.filter(t => t.averageScore > 0);
                                const cumulativeAvg = termsWithData.length > 0
                                    ? termsWithData.reduce((sum, t) => sum + t.averageScore, 0) / termsWithData.length
                                    : 0;

                                // For trend: compare cumulative of all terms vs cumulative of all-but-last
                                const prev = termsWithData.length > 1
                                    ? termsWithData.slice(0, -1).reduce((sum, t) => sum + t.averageScore, 0) / (termsWithData.length - 1)
                                    : undefined;
                                const change = prev ? cumulativeAvg - prev : 0;

                                return (
                                    <div key={s.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm relative overflow-hidden flex flex-col h-full">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="font-bold text-gray-800 text-lg">{s.name}</h3>
                                                <p className="text-xs text-gray-500">{s.class} • {termsWithData.length} term{termsWithData.length !== 1 ? 's' : ''}</p>
                                            </div>
                                            <div className={`text-xl font-bold ${cumulativeAvg >= 70 ? 'text-green-600' : 'text-blue-600'}`}>
                                                {cumulativeAvg.toFixed(1)}% <span className="text-xs font-normal text-gray-400 block text-right">Cumulative</span>
                                            </div>
                                        </div>

                                        <div className="mt-auto space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Available Terms</p>
                                            {h.length === 0 ? (
                                                <p className="text-xs text-gray-400 italic">No history found</p>
                                            ) : (
                                                // Reverse to show latest first
                                                [...h].reverse().map((term) => (
                                                    <div key={term.termId} className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded border border-gray-100">
                                                        <div>
                                                            <span className="font-semibold text-gray-700">{term.academicTerm}</span>
                                                            <span className="text-gray-500 block text-[10px]">{term.academicYear}</span>
                                                        </div>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (term.rawTermData) {
                                                                    setBroadsheetModal({ isOpen: true, termData: term.rawTermData, targetClass: term.class });
                                                                } else {
                                                                    // Silent fallback
                                                                }
                                                            }}
                                                            className="px-2 py-1 bg-white border border-blue-200 text-blue-600 font-medium rounded hover:bg-blue-50 transition-colors shadow-sm whitespace-nowrap"
                                                            title="View Class Broadsheet"
                                                        >
                                                            Broadsheet
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : singleStudent ? (
                    /* --- SINGLE STUDENT VIEW (Preserved) --- */
                    <div className="space-y-8 animate-fade-in-up">
                        {/* Student Header */}
                        <div className="flex items-center space-x-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <div className="h-16 w-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                                {singleStudent.name.charAt(0)}
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">{singleStudent.name}</h2>
                                <p className="text-gray-600">Index No: <span className="font-mono font-medium">{singleStudent.indexNumber}</span></p>
                                <p className="text-gray-600">Current Class: <span className="font-medium">{singleStudent.class}</span></p>
                            </div>
                        </div>

                        {singleHistory.length > 0 && (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center h-64 lg:col-span-2">
                                    <LineChart data={singleTrendData} title="Overall Performance Trend" height={200} />
                                </div>
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center h-64">
                                    <PieChart data={singleGradeData} title={`Grade Dist. (${singleLatestTerm?.academicTerm})`} height={180} />
                                </div>
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center h-64 lg:col-span-3">
                                    <BarChart data={singleSubjectData} title={`Subject Performance (${singleLatestTerm?.academicTerm})`} height={200} />
                                </div>
                            </div>
                        )}

                        {/* Recent History Cards */}
                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-gray-800">Detailed Academic History</h3>
                            {singleHistory.length === 0 ? (
                                <p className="text-gray-500 italic">No academic history found.</p>
                            ) : (
                                singleHistory.map((item, index) => {
                                    const prevTerm = singleHistory[index - 1];
                                    const change = prevTerm ? item.averageScore - prevTerm.averageScore : 0;
                                    const isPositive = change > 0;
                                    const isExpanded = expandedTermIds.includes(item.termId);

                                    return (
                                        <div key={item.termId} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                            {/* Term Header (Clickable) */}
                                            <div
                                                onClick={() => toggleTerm(item.termId)}
                                                className="p-5 flex flex-col md:flex-row md:items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                                        {singleHistory.length - index}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-lg font-bold text-gray-800">{item.academicTerm} {item.academicYear}</h4>
                                                        <p className="text-sm text-gray-500">{item.class} • Position: <span className="font-medium text-gray-700">{item.position}</span></p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-6 mt-4 md:mt-0">
                                                    <div className="text-right">
                                                        <p className="text-xs text-gray-500 uppercase font-semibold">Average</p>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-2xl font-bold text-blue-600">{item.averageScore.toFixed(1)}%</span>
                                                            {prevTerm && (
                                                                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                    {isPositive ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setBroadsheetModal({ isOpen: true, termData: item.rawTermData, targetClass: item.class });
                                                        }}
                                                        className="px-3 py-1 bg-white border border-blue-200 text-blue-600 text-xs font-semibold rounded hover:bg-blue-50 transition-colors shadow-sm"
                                                    >
                                                        View Broadsheet
                                                    </button>

                                                    <svg
                                                        className={`w-6 h-6 text-gray-400 transition-transform ${isExpanded ? 'transform rotate-180' : ''}`}
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </div>
                                            </div>

                                            {/* Expanded Details Table */}
                                            {isExpanded && (
                                                <div className="border-t border-gray-100 bg-gray-50 p-6 animate-fade-in-down">
                                                    <div className="overflow-x-auto">
                                                        <table className="min-w-full text-sm">
                                                            <thead>
                                                                <tr className="text-left text-gray-500 border-b border-gray-200">
                                                                    <th className="pb-3 font-medium">Subject</th>
                                                                    <th className="pb-3 font-medium text-center">Class Score</th>
                                                                    <th className="pb-3 font-medium text-center">Exam Score</th>
                                                                    <th className="pb-3 font-medium text-center">Total</th>
                                                                    <th className="pb-3 font-medium text-center">Grade</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-100">
                                                                {item.detailedPerformance.map((subj, idx) => (
                                                                    <tr key={idx}>
                                                                        <td className="py-3 font-medium text-gray-800">{subj.subjectName}</td>
                                                                        <td className="py-3 text-center text-gray-600">{subj.classScore.toFixed(1)}</td>
                                                                        <td className="py-3 text-center text-gray-600">{subj.examScore.toFixed(1)}</td>
                                                                        <td className="py-3 text-center font-bold text-gray-900">{subj.totalScore.toFixed(0)}</td>
                                                                        <td className="py-3 text-center">
                                                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${subj.grade === 'A1' || subj.grade === 'B2' ? 'bg-green-100 text-green-700' :
                                                                                subj.grade.startsWith('F') ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                                                                                }`}>
                                                                                {subj.grade}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Insights */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-up delay-100">
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-green-100 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-green-50 rounded-bl-full -mr-4 -mt-4 z-0"></div>
                                <h3 className="text-lg font-bold text-gray-800 mb-4 relative z-10">Academic Strengths</h3>
                                <div className="space-y-3 relative z-10">
                                    {singleInsights.strengths.length > 0 ? (
                                        singleInsights.strengths.map((s, i) => (
                                            <div key={i} className="flex items-center justify-between p-2 bg-green-50 rounded-lg border border-green-100">
                                                <span className="font-semibold text-gray-700">{s.name}</span>
                                                <span className="font-bold text-green-600">{s.avg.toFixed(1)}%</span>
                                            </div>
                                        ))
                                    ) : <p className="text-gray-500 italic">No meaningful data yet.</p>}
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-xl shadow-sm border border-red-100 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-bl-full -mr-4 -mt-4 z-0"></div>
                                <h3 className="text-lg font-bold text-gray-800 mb-4 relative z-10">Areas for Improvement</h3>
                                <div className="space-y-3 relative z-10">
                                    {singleInsights.weaknesses.length > 0 ? (
                                        singleInsights.weaknesses.map((s, i) => (
                                            <div key={i} className="flex items-center justify-between p-2 bg-red-50 rounded-lg border border-red-100">
                                                <span className="font-semibold text-gray-700">{s.name}</span>
                                                <span className="font-bold text-red-600">{s.avg.toFixed(1)}%</span>
                                            </div>
                                        ))
                                    ) : <p className="text-gray-500 italic">No specific weaknesses identified.</p>}
                                </div>
                            </div>
                        </div>

                    </div>
                ) : (
                    /* --- EMPTY STATE --- */
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                        <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        <p className="text-lg font-medium">Select a student to view progress</p>
                        <p className="text-sm">Search and select multiple students to compare.</p>
                    </div>
                )}
            </div>
            {/* Broadsheet Modal */}
            {broadsheetModal.isOpen && broadsheetModal.termData && broadsheetModal.targetClass && (
                <BroadsheetModal
                    isOpen={broadsheetModal.isOpen}
                    onClose={() => setBroadsheetModal({ isOpen: false })}
                    termData={broadsheetModal.termData}
                    targetClass={broadsheetModal.targetClass}
                />
            )}
        </div>
    );
};

export default StudentProgress;
