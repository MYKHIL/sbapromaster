import React, { useMemo } from 'react';
import { AppDataType, Student, Score } from '../../types';
import jsPDF from 'jspdf';
// @ts-ignore
import autoTable from 'jspdf-autotable';

interface BroadsheetModalProps {
    isOpen: boolean;
    onClose: () => void;
    termData: AppDataType; // The specific term data
    targetClass: string;
}

const BroadsheetModal: React.FC<BroadsheetModalProps> = ({ isOpen, onClose, termData, targetClass }) => {
    if (!isOpen) return null;

    const subjects = termData.subjects || [];
    const assessments = termData.assessments || [];

    // Split assessments into Exam and Class
    const examAssessment = assessments.find(a => a.name.toLowerCase().includes('exam'));
    const classAssessments = assessments.filter(a => !examAssessment || a.id !== examAssessment.id);

    // Calculate processed data for the table
    const tableData = useMemo(() => {
        const studentsInClass = (termData.students || []).filter(s => s.class === targetClass);
        const scores = termData.scores || [];

        // Calculate averages for ranking
        const studentAverages = studentsInClass.map(student => {
            const studentScores = scores.filter(s => s.studentId === student.id);

            // Calculate total weighted score across all subjects
            let totalWeightedScore = 0;
            let subjectCount = 0;

            subjects.forEach(subject => {
                const scoreObj = studentScores.find(s => s.subjectId === subject.id);
                if (scoreObj) {
                    // Helper to calc weighted score for a subject
                    const calcPart = (specificAsses: typeof assessments) => {
                        return specificAsses.reduce((sum, ass) => {
                            const rawStrs = scoreObj.assessmentScores?.[ass.id] || [];
                            if (rawStrs.length === 0) return sum;

                            // Handle Exam differently? Usually single entry, but logic should be robust
                            const isExam = ass.name.toLowerCase().includes('exam');

                            if (isExam) {
                                // Exam: avg(raw) / 100 * weight
                                const rawSum = rawStrs.reduce((a, b) => a + Number(b.split('/')[0]), 0);
                                const avg = rawSum / rawStrs.length;
                                return sum + (avg / 100 * ass.weight);
                            } else {
                                // Class: sum(raw) / sum(max) * weight
                                const rawSum = rawStrs.reduce((a, b) => a + Number(b.split('/')[0]), 0);
                                const maxSum = rawStrs.reduce((a, b) => a + (Number(b.split('/')[1]) || ass.weight), 0);
                                if (maxSum === 0) return sum;
                                return sum + (rawSum / maxSum * ass.weight);
                            }
                        }, 0);
                    };

                    const cScore = calcPart(classAssessments);
                    const eScore = examAssessment ? calcPart([examAssessment]) : 0;
                    if (cScore + eScore > 0) {
                        totalWeightedScore += (cScore + eScore);
                        subjectCount++;
                    }
                }
            });

            const overallAvg = subjectCount > 0 ? totalWeightedScore / subjectCount : 0;
            return {
                ...student,
                overallAvg,
                scores: studentScores
            };
        });

        // Sort by Average Descending to determine position
        studentAverages.sort((a, b) => b.overallAvg - a.overallAvg);

        // Map to final display rows
        return studentAverages.map((student, index) => {
            // Per Subject Rows? Or Flat List? 
            // Request says: Student | Index | Class Ex | Class Test | ... | Sub Total A | Exam | Sub Total B | Total | Position
            // This structure implies ONE ROW PER SUBJECT per student? Or aggregates?
            // "we could have the list of students in each class for the term and their rawscores in each assessment type for that term"
            // Usually a broadsheet is Subject-centric or Student-centric.
            // If it's a "Class Broadsheet", it typically lists ALL Subjects for ALL Students, which is a massive grid.
            // OR it lists Students and their aggregate performance.
            // Re-reading request: "Student | Index Number | Class Exercise ... | Position"
            // This looks like a per-subject breakdown calculation... BUT "Total (A+B)" usually implies Subject Final.
            // IF it's per student, per subject, that's huge. 
            // "list of students in each class for the term" -> implies rows are students.
            // IF rows are students, then columns must be aggregated... BUT "rawscores in each assessment type" implies specific subject context?
            // "in THAT term" - usually Broadsheets are PER SUBJECT or PER CLASS (Summary).
            // Request: "rawscores in *each assessment type*... Class Exercise, Class Test..."
            // These are assessment categories.
            // If I have Math, English, Science... and Class Exercise in all of them...
            // It's impossible to sum "Class Exercise" raw scores across DIFFERENT subjects meaningfully (different max scores).
            // INTERPRETATION: The user probably wants a SUBJECT-SPECIFIC Broadsheet selector inside this modal, OR the view is PER SUBJECT.
            // HOWEVER, the context is "Student Progress" -> "History Card" (Single Student Context).
            // BUT user said: "separate implementation where we could have the LIST OF STUDENTS in each class".
            // So this is for the WHOLE CLASS.
            // It's a "Term Broadsheet".
            // LIKELY SCENARIO: The Broadsheet needs to be filtered by SUBJECT. You can't show raw scores for "Homework" across 10 subjects in one cell.
            // SO: I will add a Subject Dropdown in the Modal. Default to first subject.

            const position = index + 1;
            const suffix = (["st", "nd", "rd"][((position + 90) % 100 - 10) % 10 - 1] || "th");

            return {
                ...student,
                positionVal: position,
                positionDisplay: `${position}${suffix}`,
            };

        });
    }, [termData, targetClass, subjects, assessments, classAssessments, examAssessment]);

    // Helper to generate rows for a specific subject
    const generateRowsForSubject = React.useCallback((subjId: number) => {
        return tableData.map(student => {
            const scoreObj = student.scores.find(s => s.subjectId === subjId);

            const rawScores: Record<string, string> = {};
            let subTotalA = 0;
            let subTotalB = 0;

            classAssessments.forEach(ass => {
                const rawArr = scoreObj?.assessmentScores?.[ass.id] || [];
                // Display raw: "10, 8"
                rawScores[ass.name] = rawArr.map(r => r.split('/')[0]).join(', ') || '-';

                // Calc weighted contribution
                const rawSum = rawArr.reduce((a, b) => a + Number(b.split('/')[0]), 0);
                const maxSum = rawArr.reduce((a, b) => a + (Number(b.split('/')[1]) || ass.weight), 0);
                if (maxSum > 0) {
                    subTotalA += (rawSum / maxSum * ass.weight);
                }
            });

            if (examAssessment) {
                const rawArr = scoreObj?.assessmentScores?.[examAssessment.id] || [];
                rawScores[examAssessment.name] = rawArr.map(r => r.split('/')[0]).join(', ') || '-';

                const rawSum = rawArr.reduce((a, b) => a + Number(b.split('/')[0]), 0);
                // Exam is usually direct percentage contribution or simple avg
                const avg = rawArr.length > 0 ? rawSum / rawArr.length : 0;
                subTotalB += (avg / 100 * examAssessment.weight);
            }

            const total = subTotalA + subTotalB;

            return {
                studentName: student.name,
                indexNumber: student.indexNumber,
                rawScores,
                subTotalA,
                subTotalB,
                total
            };
        }).sort((a, b) => b.total - a.total).map((row, idx) => {
            const pos = idx + 1;
            const suffix = (["st", "nd", "rd"][((pos + 90) % 100 - 10) % 10 - 1] || "th");
            return { ...row, position: `${pos}${suffix}` };
        });
    }, [tableData, classAssessments, examAssessment]);

    const [selectedSubjectId, setSelectedSubjectId] = React.useState<number>(subjects[0]?.id || 0);

    // Filter table data for selected subject
    const finalRows = useMemo(() => {
        if (selectedSubjectId === 0 && subjects.length > 0) {
            return generateRowsForSubject(subjects[0].id);
        }
        return generateRowsForSubject(selectedSubjectId);
    }, [generateRowsForSubject, selectedSubjectId, subjects]);


    const handlePrint = () => {
        const doc = new jsPDF('l', 'mm', 'a4');

        subjects.forEach((subject, index) => {
            if (index > 0) doc.addPage();

            const subjectRows = generateRowsForSubject(subject.id);

            doc.setFontSize(16);
            doc.text(`Broadsheet: ${termData.settings.academicYear} - ${termData.settings.academicTerm}`, 14, 15);
            doc.setFontSize(12);
            doc.text(`Class: ${targetClass} | Subject: ${subject.subject}`, 14, 22);

            // Columns: Name, Index, ...Class Assessments..., Sub A, Exam, Sub B, Total, Pos
            const headers = [
                'Name',
                'Index No',
                ...classAssessments.map(a => a.name),
                'Sub Total (A)',
                examAssessment?.name || 'Exam',
                'Sub Total (B)',
                'Total',
                'Pos'
            ];

            const body = subjectRows.map(row => [
                row.studentName,
                row.indexNumber || '-',
                ...classAssessments.map(a => row.rawScores[a.name]),
                row.subTotalA.toFixed(1),
                examAssessment ? row.rawScores[examAssessment.name] : '-',
                row.subTotalB.toFixed(1),
                row.total.toFixed(0),
                row.position
            ]);

            (autoTable as any)(doc, {
                startY: 30,
                head: [headers],
                body: body,
                styles: { fontSize: 8 },
                theme: 'grid'
            });
        });

        doc.save(`Broadsheet_${targetClass}_ALL.pdf`);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50 rounded-t-xl">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Class Broadsheet</h2>
                        <p className="text-gray-500">{termData.settings.academicYear} • {termData.settings.academicTerm} • {targetClass}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <select
                            value={selectedSubjectId}
                            onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
                            className="px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            {subjects.map(s => (
                                <option key={s.id} value={s.id}>{s.subject}</option>
                            ))}
                        </select>
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Export PDF
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 transition-colors bg-white rounded-lg border border-gray-200 hover:bg-gray-100"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>

                {/* Table Content */}
                <div className="flex-1 overflow-auto p-6">
                    <table className="min-w-full text-sm divide-y divide-gray-200 border border-gray-200">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b shadow-sm">Student</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b shadow-sm">Index No</th>
                                {classAssessments.map(a => (
                                    <th key={a.id} className="px-4 py-3 text-center font-semibold text-gray-700 border-b shadow-sm bg-blue-50/50">{a.name}</th>
                                ))}
                                <th className="px-4 py-3 text-center font-bold text-blue-800 border-b shadow-sm bg-blue-100">Sub Total (A)</th>
                                <th className="px-4 py-3 text-center font-semibold text-gray-700 border-b shadow-sm bg-orange-50/50">{examAssessment?.name || 'Exam'}</th>
                                <th className="px-4 py-3 text-center font-bold text-orange-800 border-b shadow-sm bg-orange-100">Sub Total (B)</th>
                                <th className="px-4 py-3 text-center font-black text-gray-900 border-b shadow-sm bg-gray-100">Total</th>
                                <th className="px-4 py-3 text-center font-bold text-gray-900 border-b shadow-sm">Pos</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {finalRows.map((row, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{row.studentName}</td>
                                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{row.indexNumber || '-'}</td>
                                    {classAssessments.map(a => (
                                        <td key={a.id} className="px-4 py-3 text-center text-gray-600 font-mono">{row.rawScores[a.name]}</td>
                                    ))}
                                    <td className="px-4 py-3 text-center font-bold text-blue-700 bg-blue-50/30">{row.subTotalA.toFixed(1)}</td>
                                    <td className="px-4 py-3 text-center text-gray-600 font-mono">{examAssessment ? row.rawScores[examAssessment.name] : '-'}</td>
                                    <td className="px-4 py-3 text-center font-bold text-orange-700 bg-orange-50/30">{row.subTotalB.toFixed(1)}</td>
                                    <td className="px-4 py-3 text-center font-black text-gray-900 text-lg bg-gray-50/50">{row.total.toFixed(0)}</td>
                                    <td className="px-4 py-3 text-center font-bold text-gray-600">
                                        <span className={`px-2 py-1 rounded-full text-xs ${parseInt(row.position) <= 3 ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            {row.position}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default BroadsheetModal;
