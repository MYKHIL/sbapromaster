import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { useUser } from '../../context/UserContext';
import { getSchoolHistory, type AppDataType, createDocumentId } from '../../services/firebaseService';
import type { Student, Score, Grade } from '../../types';
import { BarChart, LineChart, PieChart } from '../../components/SimpleCharts';
import jsPDF from 'jspdf';

interface SubjectPerformance {
    subjectName: string;
    average: number;
    grade: string;
}

interface StudentHistory {
    termId: string; // school_year_term
    academicYear: string;
    academicTerm: string;
    class: string;
    averageScore: number;
    position: string;
    scores: Score[];
    subjectPerformance: SubjectPerformance[]; // New field
}

// Module-level cache for persistence across page navigation but not app reloads
let cachedSelectedStudentId: number | null = null;

const StudentProgress: React.FC = () => {
    const { settings, students, schoolId } = useData();
    const { currentUser } = useUser();

    // History Data State
    const [historyData, setHistoryData] = useState<AppDataType[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    // Selection State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(() => {
        if (cachedSelectedStudentId) {
            return students.find(s => s.id === cachedSelectedStudentId) || null;
        }
        return null;
    });

    // Update cache when selection changes
    useEffect(() => {
        if (selectedStudent) {
            cachedSelectedStudentId = selectedStudent.id;
        }
    }, [selectedStudent]);

    const [studentHistory, setStudentHistory] = useState<StudentHistory[]>([]);

    // Access Control check
    const hasAccess = currentUser?.role === 'Admin' || settings.allowStudentProgressView;

    const contentRef = React.useRef<HTMLDivElement>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!schoolId) return;
            setIsLoadingHistory(true);
            try {
                // Determine school name prefix from current ID
                // ID format: schoolname_year_term
                const prefix = schoolId.split('_')[0];
                if (prefix) {
                    const data = await getSchoolHistory(prefix);
                    setHistoryData(data);
                }
            } catch (error) {
                console.error("Failed to fetch history:", error);
            } finally {
                setIsLoadingHistory(false);
            }
        };

        if (hasAccess) {
            fetchHistory();
        }
    }, [schoolId, hasAccess]);

    // Compute history when student is selected
    useEffect(() => {
        if (!selectedStudent || historyData.length === 0) {
            setStudentHistory([]);
            return;
        }

        const history: StudentHistory[] = [];

        historyData.forEach(termData => {
            // Find student in this term (match by Index Number first, then Name)
            // Index Number provides better continuity if unique
            let studentInTerm: Student | undefined;
            if (selectedStudent.indexNumber) {
                studentInTerm = termData.students.find(s => s.indexNumber === selectedStudent.indexNumber);
            }
            if (!studentInTerm) {
                // Fallback to name match
                studentInTerm = termData.students.find(s => s.name.toLowerCase() === selectedStudent.name.toLowerCase());
            }

            if (studentInTerm) {
                // Calculate Stats for this term
                const studentScores = termData.scores.filter(s => s.studentId === studentInTerm!.id);
                const subjectPerformances: SubjectPerformance[] = [];

                // Let's use ClassSpecificData for positions if available (Wait, is it?)
                // Or ReportSpecificData?
                const reportData = termData.reportData.find(r => r.studentId === studentInTerm!.id);

                let totalPercentage = 0;
                let subjectCount = 0;

                // Helper to calculate score based on assessment weights (Mirrors useReportCardData logic)
                const calculateWeightedScore = (sId: number, subId: number, specificAssessments: any[]) => {
                    const scoreObj = studentScores.find(s => s.subjectId === subId);
                    if (!scoreObj) return 0;

                    return specificAssessments.reduce((total, assessment) => {
                        const scoresArr = scoreObj.assessmentScores?.[assessment.id] || [];
                        if (scoresArr.length === 0) return total;

                        const isExam = assessment.name.toLowerCase().includes('exam');

                        if (isExam) {
                            // EXAM LOGIC: Average scores (which are out of 100) and convert to actual weight
                            const sumOfScores = scoresArr.reduce((sum: number, scoreStr: string) => sum + Number(scoreStr.split('/')[0]), 0);
                            const averageScoreOutOf100 = sumOfScores / scoresArr.length;
                            const finalExamScore = (averageScoreOutOf100 / 100) * assessment.weight;
                            return total + finalExamScore;
                        } else {
                            // CLASSWORK LOGIC: Sum weighted scores
                            const totalScore = scoresArr.reduce((sum: number, scoreStr: string) => sum + Number(scoreStr.split('/')[0]), 0);
                            const totalMaxPossibleScore = scoresArr.reduce((sum: number, scoreStr: string) => sum + (Number(scoreStr.split('/')[1]) || assessment.weight), 0);

                            if (totalMaxPossibleScore === 0) return total;

                            const weightedScore = (totalScore / totalMaxPossibleScore) * assessment.weight;
                            return total + weightedScore;
                        }
                    }, 0);
                };

                const examAssessment = termData.assessments.find(a => a.name.toLowerCase().includes('exam'));
                const classAssessments = termData.assessments.filter(a => !examAssessment || a.id !== examAssessment.id);

                termData.subjects.forEach(subject => {
                    // Check if student has score for this subject
                    const hasScore = studentScores.some(s => s.subjectId === subject.id);

                    if (hasScore) {
                        const classScore = calculateWeightedScore(studentInTerm!.id, subject.id, classAssessments);
                        const examScore = examAssessment ? calculateWeightedScore(studentInTerm!.id, subject.id, [examAssessment]) : 0;
                        const totalScore = classScore + examScore;

                        if (totalScore > 0) {
                            totalPercentage += totalScore;
                            subjectCount++;

                            // Determine Grade
                            // Find relevant grade from termData.grades
                            const roundedMark = Math.round(totalScore);
                            const sortedGrades = [...termData.grades].sort((a, b) => b.minScore - a.minScore);
                            const gradeInfo = sortedGrades.find(g => roundedMark >= g.minScore && roundedMark <= g.maxScore);

                            subjectPerformances.push({
                                subjectName: subject.subject,
                                average: totalScore,
                                grade: gradeInfo?.name || 'F'
                            });
                        }
                    }
                });

                const average = subjectCount > 0 ? (totalPercentage / subjectCount) : 0;

                history.push({
                    termId: createDocumentId(termData.settings.schoolName, termData.settings.academicYear, termData.settings.academicTerm),
                    academicYear: termData.settings.academicYear,
                    academicTerm: termData.settings.academicTerm,
                    class: studentInTerm.class,
                    averageScore: average,
                    position: reportData?.interest || 'N/A',
                    scores: studentScores,
                    subjectPerformance: subjectPerformances
                });
            }
        });

        // Sort by time (using termId string comparison for simplicity as IDs are year_term)
        history.sort((a, b) => a.termId.localeCompare(b.termId));

        setStudentHistory(history);

    }, [selectedStudent, historyData]);

    // Calculate Strengths & Weaknesses across all terms
    const calculateInsights = () => {
        if (studentHistory.length === 0) return { strengths: [], weaknesses: [] };

        const subjectAggregates: { [key: string]: { total: number, count: number } } = {};

        studentHistory.forEach(term => {
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

        // Top 3 Strengths, Bottom 3 Weaknesses (if avg < 50 or just bottom)
        const strengths = averages.slice(0, 3).filter(s => s.avg >= 60);
        const weaknesses = averages.slice(-3).filter(s => s.avg < 60).reverse(); // Worst first

        return { strengths, weaknesses };
    };

    const insights = calculateInsights();

    // Prepare Chart Data
    const trendData = studentHistory.map(h => ({
        label: `${h.academicTerm} ${h.academicYear.substring(2)}`, // e.g. "Term 1 2024" -> "Term 1 24"
        value: h.averageScore
    }));

    const latestTerm = studentHistory[studentHistory.length - 1];

    const subjectData = latestTerm ? latestTerm.subjectPerformance.map(s => ({
        label: s.subjectName.substring(0, 10), // Truncate for display
        value: s.average,
        color: s.average >= 70 ? '#10b981' : s.average >= 50 ? '#3b82f6' : '#ef4444'
    })) : [];

    // FIX: Use dynamic grades from context instead of hardcoded A-F
    const gradeData = latestTerm ? (() => {
        const gradeCounts: { [key: string]: number } = {};
        // Initialize with all known grades to ensure legend is complete? Or just present ones?
        // User wants "scale using grade definition".

        latestTerm.subjectPerformance.forEach(s => {
            const gName = s.grade;
            gradeCounts[gName] = (gradeCounts[gName] || 0) + 1;
        });

        // Map to chart format, ensuring consistent colors if possible
        // We can assign colors based on index or predefined set
        const palette = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

        return Object.entries(gradeCounts)
            .map(([grade, count], i) => ({
                label: grade,
                value: count,
                color: palette[i % palette.length]
            }))
            .sort((a, b) => b.value - a.value); // Sort by frequency or grade? Maybe grade name?
        // Actually, sorting by Grade Name might be better if they are A, B, C... but here they could be generic.
    })() : [];

    const handleDownloadPdf = async () => {
        setIsGeneratingPdf(true);

        try {
            // Import autoTable dynamically
            const autoTable = (await import('jspdf-autotable')).default;

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 15;
            let cursorY = margin;

            // --- Helper Functions for Drawing ---

            // Draw Header
            const drawHeader = () => {
                pdf.setFontSize(18);
                pdf.setTextColor(40, 40, 40);
                pdf.text("Student Progress Report", pageWidth / 2, cursorY, { align: 'center' });
                cursorY += 10;

                pdf.setFontSize(10);
                pdf.setTextColor(100);
                const schoolName = settings.schoolName || "School Name";
                pdf.text(schoolName, pageWidth / 2, cursorY, { align: 'center' });
                cursorY += 15;

                // Student Info Box
                pdf.setDrawColor(200);
                pdf.setFillColor(248, 250, 252);
                pdf.rect(margin, cursorY, pageWidth - (margin * 2), 25, 'FD');

                pdf.setFontSize(12);
                pdf.setTextColor(0);
                pdf.setFont("helvetica", "bold");
                pdf.text(selectedStudent?.name || "", margin + 5, cursorY + 8);

                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(10);
                pdf.setTextColor(80);
                pdf.text(`Index Number: ${selectedStudent?.indexNumber || "N/A"}`, margin + 5, cursorY + 16);
                pdf.text(`Current Class: ${selectedStudent?.class || "N/A"}`, margin + 5, cursorY + 22);

                cursorY += 35;
            };

            // Draw Bar Chart (Simple Rectangles)
            const drawPDFBarChart = (x: number, y: number, w: number, h: number, data: { label: string, value: number, color?: string }[], title: string) => {
                // Title
                pdf.setFontSize(10);
                pdf.setTextColor(50);
                pdf.setFont("helvetica", "bold");
                pdf.text(title, x + (w / 2), y - 2, { align: 'center' });

                // Chart Area
                pdf.setDrawColor(230);
                pdf.rect(x, y, w, h); // Border

                if (data.length === 0) return;

                const maxValue = Math.max(...data.map(d => d.value), 100);
                const barWidth = (w - 10) / data.length;
                const chartBottom = y + h - 5;
                const chartLeft = x + 5;

                data.forEach((d, i) => {
                    const barHeight = (d.value / maxValue) * (h - 10);
                    const barX = chartLeft + (i * barWidth) + (barWidth * 0.1);
                    const barW = barWidth * 0.8;
                    const barY = chartBottom - barHeight;

                    // Bar
                    pdf.setFillColor(d.color || '#3b82f6');
                    pdf.rect(barX, barY, barW, barHeight, 'F');

                    // Value Label (Permanent)
                    pdf.setFontSize(8);
                    pdf.setTextColor(50);
                    pdf.text(d.value.toFixed(0), barX + (barW / 2), barY - 1, { align: 'center' });

                    // X-Axis Label (Truncated)
                    pdf.setFontSize(7);
                    pdf.setTextColor(100);
                    const label = d.label.length > 8 ? d.label.substring(0, 6) + '..' : d.label;
                    pdf.text(label, barX + (barW / 2), chartBottom + 4, { align: 'center' });
                });
            };

            // Draw Line Chart (Polylines)
            const drawPDFLineChart = (x: number, y: number, w: number, h: number, data: { label: string, value: number }[], title: string) => {
                pdf.setFontSize(10);
                pdf.setTextColor(50);
                pdf.setFont("helvetica", "bold");
                pdf.text(title, x + (w / 2), y - 2, { align: 'center' });

                pdf.setDrawColor(230);
                pdf.rect(x, y, w, h);

                if (data.length === 0) return;

                const maxValue = Math.max(...data.map(d => d.value), 100);
                const chartBottom = y + h - 10;
                const chartTop = y + 10;
                const effectiveH = chartBottom - chartTop;

                // If only 1 point, center it. Else distribute.
                const spacing = data.length > 1 ? (w - 20) / (data.length - 1) : 0;
                const startX = x + 10;

                // Points
                const points: { x: number, y: number }[] = data.map((d, i) => ({
                    x: data.length > 1 ? startX + (i * spacing) : x + (w / 2),
                    y: chartBottom - ((d.value / maxValue) * effectiveH)
                }));

                // Draw Lines (only if > 1 point)
                if (data.length > 1) {
                    pdf.setDrawColor(37, 99, 235); // Blue
                    pdf.setLineWidth(0.5);
                    for (let i = 0; i < points.length - 1; i++) {
                        pdf.line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
                    }
                }

                // Draw Dots & Labels
                points.forEach((p, i) => {
                    pdf.setFillColor(255, 255, 255);
                    pdf.setDrawColor(37, 99, 235);
                    pdf.circle(p.x, p.y, 1, 'FD');

                    // Label
                    pdf.setFontSize(7);
                    pdf.setTextColor(50);
                    pdf.text(data[i].value.toFixed(1), p.x, p.y - 2.5, { align: 'center' });

                    // X-Axis
                    pdf.setTextColor(100);
                    pdf.text(data[i].label, p.x, chartBottom + 4, { align: 'center' });
                });
            };

            // Draw Pie Chart (REAL Vector Pie)
            const drawPDFPieChart = (cx: number, cy: number, r: number, data: { label: string, value: number, color?: string }[], title: string) => {
                pdf.setFontSize(10);
                pdf.setTextColor(50);
                pdf.setFont("helvetica", "bold");
                pdf.text(title, cx, cy - r - 5, { align: 'center' });

                const total = data.reduce((s, d) => s + d.value, 0);
                if (total === 0) return;

                let startAngle = 0;

                // Draw slices
                data.forEach(d => {
                    const sliceAngle = (d.value / total) * 360;
                    if (sliceAngle <= 0) return;

                    pdf.setFillColor(d.color || '#ccc');
                    // jsPDF 'pie' method if available, else build path
                    try {
                        // Modern jsPDF (which we imported) supports circle sectors via the 'lines' method or advanced API?
                        // It's safest to draw a series of triangles for the generic 'jspdf' package
                        // OR use the 'arc' with fill? 
                        // Actually, we can use the 'lines' method to draw a closed path.

                        const angleStep = 5; // degrees resolution
                        const segments = Math.ceil(sliceAngle / angleStep);
                        const realStep = sliceAngle / segments;

                        const pathPoints: [number, number][] = [[0, 0]]; // Start at center (relative)

                        const dToR = Math.PI / 180;
                        // Start point on circumference
                        // Note: lines coord system is relative to start point for subsequent points?
                        // "array of coordinates ... [x, y] ... if [x, y] is not given, the first point is (0,0)"
                        // Actually, let's use global coordinates logic manually with triangles if lines is confusing.
                        // But `pdf.lines` is: lines(lines, x, y, scale, style, closed)
                        // lines = [[x1, y1], [x2, y2]...] relative to previous point.

                        // Global Points calculation approach is safer for manual triangle fans
                        for (let i = 0; i < segments; i++) {
                            const theta1 = startAngle + (i * realStep);
                            const theta2 = startAngle + ((i + 1) * realStep);

                            const p1x = cx + r * Math.cos(theta1 * dToR);
                            const p1y = cy + r * Math.sin(theta1 * dToR);
                            const p2x = cx + r * Math.cos(theta2 * dToR);
                            const p2y = cy + r * Math.sin(theta2 * dToR);

                            pdf.triangle(cx, cy, p1x, p1y, p2x, p2y, 'F');
                        }

                    } catch (e) {
                        // Fallback to circle if drawing fails
                        pdf.circle(cx, cy, r, 'S');
                    }
                    startAngle += sliceAngle;
                });

                // Inner hole for Donut Chart (Optional, makes it look modern)
                pdf.setFillColor(255, 255, 255);
                pdf.circle(cx, cy, r * 0.5, 'F');

                // Center Text (Total)
                pdf.setFontSize(8);
                pdf.setTextColor(80);
                pdf.text("Total", cx, cy - 2, { align: 'center' });
                pdf.setFontSize(12);
                pdf.setTextColor(40);
                pdf.setFont("helvetica", "bold");
                pdf.text(String(total), cx, cy + 4, { align: 'center' });

                // Legend
                let ly = cy - r + 5;
                // If many items, this might overflow. Let's put legend to the right? 
                // Or below. The pie is r=20mm approx.
                // Let's put legend below the chart
                ly = cy + r + 5;

                const legendX = cx - 20; // Start bit left

                data.forEach(d => {
                    pdf.setFillColor(d.color || '#ccc');
                    pdf.circle(legendX, ly, 1.5, 'F');
                    pdf.setFontSize(8);
                    pdf.setFont("helvetica", "normal");
                    pdf.setTextColor(80);
                    pdf.text(`${d.label}: ${d.value}`, legendX + 4, ly + 1);
                    ly += 4;
                });
            };

            // --- GENERATION START ---
            drawHeader();

            // Row 1: Line Chart & Pie (Stacked Bar) Chart
            const r1y = cursorY;
            const col1w = (pageWidth - (margin * 3)) * 0.65; // Increase width for Trend
            const col2w = (pageWidth - (margin * 3)) * 0.35; // Decrease for Pie

            drawPDFLineChart(margin, r1y, col1w, 50, trendData, "Overall Trend");

            // Pie Chart center and radius
            // Center X should be: margin + col1w + gap + (col2w / 2)
            const pieCx = margin + col1w + 10 + (col2w / 2);
            const pieCy = r1y + 25; // Center Y
            drawPDFPieChart(pieCx, pieCy, 16, gradeData, "Grade Distribution");

            cursorY += 65; // Increased height to accommodate legend logic

            // Row 2: Subject Bar Chart (Full Width)
            drawPDFBarChart(margin, cursorY, pageWidth - (margin * 2), 60, subjectData, "Subject Performance");
            cursorY += 70;

            // Row 3: Insights (Text)
            pdf.setFontSize(12);
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(40);
            pdf.text("Academic Insights", margin, cursorY);
            cursorY += 8;

            // Strengths
            pdf.setFontSize(10);
            pdf.setTextColor(22, 163, 74); // Green
            pdf.text("Strengths:", margin, cursorY);
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(60);
            const strText = insights.strengths.length > 0
                ? insights.strengths.map(s => `${s.name} (${s.avg.toFixed(0)}%)`).join(', ')
                : "No specific strengths identified.";
            pdf.text(strText, margin + 25, cursorY);
            cursorY += 6;

            // Weaknesses
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(220, 38, 38); // Red
            pdf.text("Weaknesses:", margin, cursorY);
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(60);
            const weakText = insights.weaknesses.length > 0
                ? insights.weaknesses.map(s => `${s.name} (${s.avg.toFixed(0)}%)`).join(', ')
                : "No specific weaknesses identified.";
            pdf.text(weakText, margin + 25, cursorY);
            cursorY += 15;

            // Row 4: History Table (using autoTable)
            pdf.setFontSize(12);
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(40);
            pdf.text("Detailed Subject History", margin, cursorY);
            cursorY += 5;

            // Prepare Table Data
            // Columns: Subject, Term 1, Term 2..., Trend
            const subjects = Array.from(new Set(studentHistory.flatMap(h => h.subjectPerformance.map(s => s.subjectName)))).sort();
            const terms = studentHistory.map(h => `${h.academicTerm} ${h.academicYear.substring(2)}`);

            const tableHead = [['Subject', ...terms, 'Avg']];
            const tableBody = subjects.map(subj => {
                const row = [subj];
                let totalScore = 0;
                let count = 0;
                studentHistory.forEach(h => {
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
                head: tableHead,
                body: tableBody,
                margin: { left: margin, right: margin },
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: { fillColor: [59, 130, 246] }, // Blue header
                alternateRowStyles: { fillColor: [248, 250, 252] }
            });

            // Footer (Page Numbers handled by autoTable? No, manual)
            const totalPages = pdf.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                pdf.setPage(i);
                pdf.setFontSize(9);
                pdf.setTextColor(150);
                pdf.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
            }

            pdf.save(`${selectedStudent?.name}_Progress_Report_Vector.pdf`);

        } catch (error) {
            console.error("PDF Export Error:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            alert("Failed to export PDF: " + errorMessage);
        } finally {
            setIsGeneratingPdf(false);
        }
    };


    // Helper to get score change for a specific subject
    const getSubjectTrend = (subjectName: string, currentTermIndex: number) => {
        if (currentTermIndex === 0) return 0;
        const currentScore = studentHistory[currentTermIndex].subjectPerformance.find(s => s.subjectName === subjectName)?.average || 0;
        const prevScore = studentHistory[currentTermIndex - 1].subjectPerformance.find(s => s.subjectName === subjectName)?.average || 0;
        return currentScore - prevScore;
    };


    // Filtering current students
    const filteredStudents = students.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.indexNumber.includes(searchQuery)
    );

    if (!hasAccess) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center p-8 bg-white rounded-xl shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <h2 className="text-xl font-bold text-gray-800">Access Restricted</h2>
                    <p className="text-gray-600 mt-2">You do not have permission to view student progress analytics.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-10 animate-fade-in relative">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Student Progress</h1>
                    <p className="text-gray-600 mt-1">Track academic performance over time.</p>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200" ref={contentRef}>
                {/* Search Section - Hidden in PDF capture if possible via CSS, or just keep it */}
                {/* Actually, for print we might want to hide the search bar. We can use 'data-html2canvas-ignore' attribute */}
                <div className="mb-6" data-html2canvas-ignore="true">
                    {/* ... existing Search Input ... */}
                    <label className="block text-sm font-medium text-gray-700 mb-2">Search Student</label>
                    <div className="relative">
                        <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search by name or index number..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <div className="absolute z-10 w-full bg-white mt-1 border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                {filteredStudents.slice(0, 10).map(s => (
                                    <div
                                        key={s.id}
                                        onClick={() => { setSelectedStudent(s); setSearchQuery(''); }}
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
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {selectedStudent ? (
                    <div className="space-y-8 animate-fade-in-up">
                        {/* Student Header */}
                        <div className="flex items-center space-x-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                            {/* ... existing header content ... */}
                            <div className="h-16 w-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                                {selectedStudent.name.charAt(0)}
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">{selectedStudent.name}</h2>
                                <p className="text-gray-600">Index No: <span className="font-mono font-medium">{selectedStudent.indexNumber}</span></p>
                                <p className="text-gray-600">Current Class: <span className="font-medium">{selectedStudent.class}</span></p>
                            </div>
                        </div>

                        {/* Analytics Charts Section */}
                        {studentHistory.length > 0 && (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Trend Line Chart */}
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center h-64 lg:col-span-2">
                                    <LineChart data={trendData} title="Overall Performance Trend" height={200} />
                                </div>
                                {/* Grade Distribution Pie Chart */}
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center h-64">
                                    <PieChart data={gradeData} title={`Grade Dist. (${latestTerm?.academicTerm})`} height={180} />
                                </div>
                                {/* Subject Bar Chart (Full Width) */}
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center h-64 lg:col-span-3">
                                    <BarChart data={subjectData} title={`Subject Performance (${latestTerm?.academicTerm})`} height={200} />
                                </div>
                            </div>
                        )}

                        {/* Performance Grid Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* ... existing card map ... */}
                            {studentHistory.map((item, index) => {
                                const prevTerm = studentHistory[index - 1];
                                const change = prevTerm ? item.averageScore - prevTerm.averageScore : 0;
                                const isPositive = change > 0;

                                return (
                                    <div key={item.termId} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow relative overflow-hidden group">
                                        {/* ... existing card content ... */}
                                        <div className="absolute top-0 right-0 p-2 opacity-5 scale-150 rotate-12 transition-transform group-hover:scale-125">
                                            <span className="text-4xl">📊</span>
                                        </div>
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="font-bold text-gray-800 text-lg">{item.academicTerm}</h3>
                                                <p className="text-sm text-gray-500 font-medium">{item.academicYear}</p>
                                            </div>
                                            <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full uppercase tracking-wider">{item.class}</span>
                                        </div>

                                        <div className="mt-4">
                                            <p className="text-sm text-gray-500">Average Performance</p>
                                            <div className="flex items-end space-x-2">
                                                <span className="text-3xl font-extrabold text-blue-600">{item.averageScore.toFixed(1)}%</span>
                                                {prevTerm && (
                                                    <span className={`text-sm font-semibold mb-1 ${isPositive ? 'text-green-600' : 'text-red-500'} flex items-center`}>
                                                        {isPositive ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Brief Commentary */}
                                        <div className="mt-4 pt-4 border-t border-gray-100">
                                            <p className="text-xs text-gray-500 italic">
                                                {isPositive
                                                    ? "Improvements observed. Keep maintaining upward momentum."
                                                    : "Performance dip detected. Needs more focus on weak subjects."
                                                }
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Insights Section */}
                        {/* ... existing insights ... */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-up delay-100">
                            {/* Strengths */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-green-100 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-green-50 rounded-bl-full -mr-4 -mt-4 z-0"></div>
                                <h3 className="text-lg font-bold text-gray-800 mb-4 relative z-10">Academic Strengths</h3>
                                <div className="space-y-3 relative z-10">
                                    {insights.strengths.length > 0 ? (
                                        insights.strengths.map((s, i) => (
                                            <div key={i} className="flex items-center justify-between p-2 bg-green-50 rounded-lg border border-green-100">
                                                <span className="font-semibold text-gray-700">{s.name}</span>
                                                <span className="font-bold text-green-600">{s.avg.toFixed(1)}%</span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-gray-500 italic text-sm">No significant strengths detected yet.</p>
                                    )}
                                </div>
                            </div>

                            {/* Weaknesses */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-red-100 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-bl-full -mr-4 -mt-4 z-0"></div>
                                <h3 className="text-lg font-bold text-gray-800 mb-4 relative z-10">Areas for Improvement</h3>
                                <div className="space-y-3 relative z-10">
                                    {insights.weaknesses.length > 0 ? (
                                        insights.weaknesses.map((s, i) => (
                                            <div key={i} className="flex items-center justify-between p-2 bg-red-50 rounded-lg border border-red-100">
                                                <span className="font-semibold text-gray-700">{s.name}</span>
                                                <span className="font-bold text-red-600">{s.avg.toFixed(1)}%</span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-gray-500 italic text-sm">No significant weaknesses detected.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Detailed Subject Trends */}
                        {/* ... existing table ... */}
                        {studentHistory.length > 0 && (
                            <div className="bg-white p-6 rounded-xl shadow border border-gray-200 animate-fade-in-up delay-200">
                                <h3 className="text-lg font-bold text-gray-800 mb-6">Subject Performance History</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 rounded-l-lg">Subject</th>
                                                {studentHistory.map(term => (
                                                    <th key={term.termId} className="px-4 py-3 text-center">
                                                        {term.academicTerm} <br />
                                                        <span className="text-[10px] text-gray-500 font-normal">{term.academicYear}</span>
                                                    </th>
                                                ))}
                                                <th className="px-4 py-3 rounded-r-lg text-center">Trend</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {/* Get unique subjects from all history */}
                                            {Array.from(new Set(studentHistory.flatMap(h => h.subjectPerformance.map(s => s.subjectName)))).sort().map(subject => {
                                                const trend = getSubjectTrend(subject, studentHistory.length - 1);
                                                return (
                                                    <tr key={subject} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-4 font-medium text-gray-900">{subject}</td>
                                                        {studentHistory.map(term => {
                                                            const perf = term.subjectPerformance.find(s => s.subjectName === subject);
                                                            return (
                                                                <td key={term.termId} className="px-4 py-4 text-center">
                                                                    {perf ? (
                                                                        <div className="flex flex-col items-center">
                                                                            <span className={`font-bold ${perf.average >= 70 ? 'text-green-600' : perf.average >= 50 ? 'text-blue-600' : 'text-red-500'}`}>
                                                                                {perf.average.toFixed(0)}%
                                                                            </span>
                                                                            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded mt-1">{perf.grade}</span>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-gray-300">-</span>
                                                                    )}
                                                                </td>
                                                            );
                                                        })}
                                                        <td className="px-4 py-4 text-center">
                                                            {studentHistory.length > 1 && (
                                                                <span className={`font-bold ${trend > 0 ? 'text-green-500' : trend < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                                                    {trend > 0 ? '↗' : trend < 0 ? '↘' : '—'}
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                    </div>
                ) : (
                    <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                        <span className="text-4xl block mb-4">🎓</span>
                        <h3 className="text-lg font-semibold text-gray-600">Select a student to view progress</h3>
                        <p className="text-sm text-gray-500 mt-1">Search by name or index number above</p>
                    </div>
                )}
            </div>

            {/* Fixed PDF Download Button (Matches ReportViewer) */}
            {selectedStudent && studentHistory.length > 0 && (
                <div className="fixed bottom-6 right-6 z-20 flex flex-col items-center gap-4 transition-all duration-300">
                    <button
                        onClick={handleDownloadPdf}
                        disabled={isGeneratingPdf}
                        className="flex items-center bg-green-600 text-white px-5 py-3 rounded-full shadow-lg hover:bg-green-700 transition-all duration-300 transform hover:scale-110 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:scale-100"
                        aria-label="Download Progress Report as PDF"
                    >
                        {isGeneratingPdf ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Generating...</span>
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                <span className="ml-2 font-semibold hidden sm:inline">Download PDF</span>
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};

export default StudentProgress;
