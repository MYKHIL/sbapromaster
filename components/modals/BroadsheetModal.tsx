import React, { useMemo, useState } from 'react';
import { AppDataType, Score } from '../../types';
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
    const scores = termData.scores || [];
    const studentsInClass = (termData.students || []).filter(s => s.class === targetClass && !s.deleted);

    // Split assessments into Exam and Class
    const examAssessment = assessments.find(a => a.name.toLowerCase().includes('exam'));
    const classAssessments = assessments.filter(a => !examAssessment || a.id !== examAssessment.id);

    // Filter subjects: only include those where at least one class student has scores
    const filteredSubjects = useMemo(() => {
        return subjects.filter(subject => {
            return studentsInClass.some(student => {
                const scoreObj = scores.find(s =>
                    String(s.studentId) === String(student.id) &&
                    String(s.subjectId) === String(subject.id)
                );
                if (!scoreObj) return false;

                // Check if any assessment has scores
                const hasClassScores = classAssessments.some(ass => {
                    const rawArr = scoreObj.assessmentScores?.[ass.id] || [];
                    return rawArr.length > 0;
                });
                const hasExamScores = examAssessment && (scoreObj.assessmentScores?.[examAssessment.id]?.length || 0) > 0;

                return hasClassScores || hasExamScores;
            });
        });
    }, [subjects, studentsInClass, scores, classAssessments, examAssessment]);

    // Calculate processed data for the table
    const tableData = useMemo(() => {
        const studentsInClass = (termData.students || []).filter(s => s.class === targetClass && !s.deleted);
        const scores = termData.scores || [];

        // Calculate averages for ranking
        const studentAverages = studentsInClass.map(student => {
            const studentScores = scores.filter(s => s.studentId === student.id);

            // Calculate total weighted score across all subjects
            let totalWeightedScore = 0;
            let subjectCount = 0;

            filteredSubjects.forEach(subject => {
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
                                const rawSum = rawStrs.reduce((a, b) => {
                                    const s = (b || '').toString();
                                    if (!s.includes('/')) return a;
                                    return a + (Number(s.split('/')[0]) || 0);
                                }, 0);
                                const avg = rawStrs.length > 0 ? rawSum / rawStrs.length : 0;
                                return sum + (avg / 100 * ass.weight);
                            } else {
                                // Class: sum(raw) / sum(max) * weight
                                const rawSum = rawStrs.reduce((a, b) => {
                                    const s = (b || '').toString();
                                    if (!s.includes('/')) return a;
                                    return a + (Number(s.split('/')[0]) || 0);
                                }, 0);
                                const maxSum = rawStrs.reduce((a, b) => {
                                    const s = (b || '').toString();
                                    if (!s.includes('/')) return a + ass.weight;
                                    return a + (Number(s.split('/')[1]) || ass.weight);
                                }, 0);
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
            const position = index + 1;
            const suffix = (["st", "nd", "rd"][((position + 90) % 100 - 10) % 10 - 1] || "th");

            return {
                ...student,
                positionVal: position,
                positionDisplay: `${position}${suffix}`,
            };
        });
    }, [termData, targetClass, filteredSubjects, assessments, classAssessments, examAssessment]);

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
                rawScores[ass.name] = rawArr.map(r => (r || '').split('/')[0]).join(', ') || '-';

                // Calc weighted contribution
                const rawSum = rawArr.reduce((a, b) => {
                    const s = (b || '').toString();
                    if (!s.includes('/')) return a;
                    return a + (Number(s.split('/')[0]) || 0);
                }, 0);
                const maxSum = rawArr.reduce((a, b) => {
                    const s = (b || '').toString();
                    if (!s.includes('/')) return a + ass.weight;
                    return a + (Number(s.split('/')[1]) || ass.weight);
                }, 0);
                if (maxSum > 0) {
                    subTotalA += (rawSum / maxSum * ass.weight);
                }
            });

            if (examAssessment) {
                const rawArr = scoreObj?.assessmentScores?.[examAssessment.id] || [];
                rawScores[examAssessment.name] = rawArr.map(r => (r || '').split('/')[0]).join(', ') || '-';

                const rawSum = rawArr.reduce((a, b) => {
                    const s = (b || '').toString();
                    if (!s.includes('/')) return a;
                    return a + (Number(s.split('/')[0]) || 0);
                }, 0);
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

    const [selectedSubjectId, setSelectedSubjectId] = useState<number>(filteredSubjects[0]?.id || 0);
    const [exportConfig, setExportConfig] = useState<{ includeSummary: boolean, includeDetails: boolean, scope: 'all' | 'current' }>({ 
        includeSummary: true, 
        includeDetails: true,
        scope: 'all' 
    });

    // Filter table data for selected subject
    const finalRows = useMemo(() => {
        if (selectedSubjectId === 0 && filteredSubjects.length > 0) {
            return generateRowsForSubject(filteredSubjects[0].id);
        }
        return generateRowsForSubject(selectedSubjectId);
    }, [generateRowsForSubject, selectedSubjectId, filteredSubjects]);

    // Helper to generate a single subject page
    const drawSubjectPage = (doc: any, subjectId: number, isFirstPage: boolean) => {
        const subject = filteredSubjects.find(s => s.id === subjectId);
        if (!subject) return;

        if (!isFirstPage) doc.addPage();

        const subjectRows = generateRowsForSubject(subject.id);

        doc.setFontSize(16);
        doc.text(`Broadsheet: ${termData.settings.academicYear} - ${termData.settings.academicTerm}`, 14, 15);
        doc.setFontSize(12);
        doc.text(`Class: ${targetClass} | Subject: ${subject.subject}`, 14, 22);

        const headers = [
            'Name',
            'Index No',
            ...classAssessments.map(a => a.name),
            'Sub Total\n(A)',
            examAssessment?.name || 'Exam',
            'Sub Total\n(B)',
            'Total\n(A + B)',
            'Position'
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
            styles: { fontSize: 8, halign: 'center', valign: 'middle' },
            columnStyles: {
                0: { halign: 'left' },
                1: { halign: 'left' }
            },
            theme: 'grid'
        });
    };

    // Helper to generate Master Summary page
    const drawMasterSummaryPage = (doc: any) => {
        doc.setFontSize(18);
        doc.text(`Master Broadsheet Summary: ${targetClass}`, 14, 15);
        doc.setFontSize(11);
        doc.text(`${termData.settings.academicYear} - ${termData.settings.academicTerm}`, 14, 22);

        const headers = [
            'Student Name',
            'Index',
            ...filteredSubjects.map(s => s.subject),
            'Total Score',
            'Average',
            'Position'
        ];

        const body = tableData.map(student => {
            const subjectTotals = filteredSubjects.map(subj => {
                const scoreObj = student.scores.find(s => s.subjectId === subj.id);
                if (!scoreObj) return '-';

                // Re-calc specific subject total (sum weighted)
                const calcPart = (specificAsses: typeof assessments) => {
                    return specificAsses.reduce((sum, ass) => {
                        const rawStrs = scoreObj.assessmentScores?.[ass.id] || [];
                        if (rawStrs.length === 0) return sum;
                        const isExam = ass.name.toLowerCase().includes('exam');
                        const rawSum = rawStrs.reduce((a, b) => a + (Number((b || '').toString().split('/')[0]) || 0), 0);
                        if (isExam) {
                            const avg = rawStrs.length > 0 ? rawSum / rawStrs.length : 0;
                            return sum + (avg / 100 * ass.weight);
                        } else {
                            const maxSum = rawStrs.reduce((a, b) => a + (Number((b || '').toString().split('/')[1]) || ass.weight), 0);
                            return sum + (maxSum === 0 ? 0 : (rawSum / maxSum * ass.weight));
                        }
                    }, 0);
                };
                const total = calcPart(classAssessments) + (examAssessment ? calcPart([examAssessment]) : 0);
                return total > 0 ? total.toFixed(0) : '-';
            });

            // Overall Total Across All Subjects
            const overallTotalValue = filteredSubjects.reduce((sum, subj) => {
                const scoreObj = student.scores.find(s => s.subjectId === subj.id);
                if (!scoreObj) return sum;
                const calcPart = (specificAsses: typeof assessments) => {
                    return specificAsses.reduce((acc, ass) => {
                        const rawStrs = scoreObj.assessmentScores?.[ass.id] || [];
                        if (rawStrs.length === 0) return acc;
                        const isExam = ass.name.toLowerCase().includes('exam');
                        const rawSum = rawStrs.reduce((a, b) => a + (Number((b || '').toString().split('/')[0]) || 0), 0);
                        if (isExam) {
                            const avg = rawStrs.length > 0 ? rawSum / rawStrs.length : 0;
                            return acc + (avg / 100 * ass.weight);
                        } else {
                            const maxSum = rawStrs.reduce((a, b) => a + (Number((b || '').toString().split('/')[1]) || ass.weight), 0);
                            return acc + (maxSum === 0 ? 0 : (rawSum / maxSum * ass.weight));
                        }
                    }, 0);
                };
                return sum + calcPart(classAssessments) + (examAssessment ? calcPart([examAssessment]) : 0);
            }, 0);

            return [
                student.name,
                student.indexNumber || '-',
                ...subjectTotals,
                overallTotalValue.toFixed(0),
                student.overallAvg.toFixed(1) + '%',
                student.positionDisplay
            ];
        });

        (autoTable as any)(doc, {
            startY: 30,
            head: [headers],
            body: body,
            styles: { fontSize: 7, halign: 'center', valign: 'middle' },
            columnStyles: {
                0: { halign: 'left', fontStyle: 'bold' },
                1: { halign: 'left' }
            },
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185] }
        });
    };

    const handlePrint = () => {
        if (!exportConfig.includeSummary && !exportConfig.includeDetails) return;

        const doc = new jsPDF('l', 'mm', 'a4');
        let pageCount = 0;

        // 1. Master Summary
        if (exportConfig.includeSummary) {
            drawMasterSummaryPage(doc);
            pageCount++;
        }

        // 2. Individual Subject Breakdowns
        if (exportConfig.includeDetails) {
            if (exportConfig.scope === 'current') {
                drawSubjectPage(doc, selectedSubjectId, pageCount === 0);
            } else {
                filteredSubjects.forEach((subject) => {
                    drawSubjectPage(doc, subject.id, pageCount === 0);
                    pageCount++;
                });
            }
        }

        const fileName = exportConfig.scope === 'current' 
            ? `Broadsheet_${targetClass}_${filteredSubjects.find(s => s.id === selectedSubjectId)?.subject || 'Subject'}.pdf`
            : `Broadsheet_${targetClass}_Full.pdf`;
            
        doc.save(fileName);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-4 md:p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50 rounded-t-xl">
                    <div className="text-center md:text-left">
                        <h2 className="text-2xl font-bold text-gray-800">Class Broadsheet</h2>
                        <p className="text-gray-500 text-sm md:text-base">{termData.settings.academicYear} • {termData.settings.academicTerm} • {targetClass}</p>
                    </div>
                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full md:w-auto">
                        <select
                            value={selectedSubjectId}
                            onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
                            className="px-3 py-2 text-sm md:text-base rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-auto"
                        >
                            {filteredSubjects.map(s => (
                                <option key={s.id} value={s.id}>{s.subject}</option>
                            ))}
                        </select>
                        <div className="flex items-center gap-4 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
                            <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={exportConfig.includeSummary} 
                                    onChange={(e) => setExportConfig(prev => ({ ...prev, includeSummary: e.target.checked }))}
                                    className="w-4 h-4 rounded text-blue-600"
                                />
                                Summary
                            </label>
                            <div className="w-px h-4 bg-gray-200"></div>
                            <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={exportConfig.includeDetails} 
                                    onChange={(e) => setExportConfig(prev => ({ ...prev, includeDetails: e.target.checked }))}
                                    className="w-4 h-4 rounded text-blue-600"
                                />
                                Details
                            </label>
                            {exportConfig.includeDetails && (
                                <>
                                    <div className="w-px h-4 bg-gray-200 mx-1"></div>
                                    <select 
                                        value={exportConfig.scope}
                                        onChange={(e) => setExportConfig(prev => ({ ...prev, scope: e.target.value as 'all' | 'current' }))}
                                        className="text-[10px] font-bold text-blue-600 border-none bg-transparent focus:ring-0 cursor-pointer uppercase p-0"
                                    >
                                        <option value="all">All Subjects</option>
                                        <option value="current">Current Only</option>
                                    </select>
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <button
                                onClick={handlePrint}
                                disabled={!exportConfig.includeSummary && !exportConfig.includeDetails}
                                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm md:text-base rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap ${(!exportConfig.includeSummary && !exportConfig.includeDetails) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                Export Broadsheet
                            </button>
                            <button
                                onClick={onClose}
                                className="p-2 text-gray-400 hover:text-gray-600 transition-colors bg-white rounded-lg border border-gray-200 hover:bg-gray-100"
                            >
                                <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Table Content */}
                <div className="flex-1 overflow-auto p-2 md:p-6">
                    <table className="min-w-full text-sm divide-y divide-gray-200 border border-gray-200">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b shadow-sm">Student</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b shadow-sm">Index No</th>
                                {classAssessments.map(a => (
                                    <th key={a.id} className="px-4 py-3 text-center font-semibold text-gray-700 border-b shadow-sm bg-blue-50/50">{a.name}</th>
                                ))}
                                <th className="px-4 py-3 text-center border-b shadow-sm bg-blue-100">
                                    <div className="leading-tight">
                                        <div className="font-bold text-blue-800">Sub Total</div>
                                        <div className="text-sm font-semibold text-blue-700">(A)</div>
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-center font-semibold text-gray-700 border-b shadow-sm bg-orange-50/50">{examAssessment?.name || 'Exam'}</th>
                                <th className="px-4 py-3 text-center border-b shadow-sm bg-orange-100">
                                    <div className="leading-tight">
                                        <div className="font-bold text-orange-800">Sub Total</div>
                                        <div className="text-sm font-semibold text-orange-700">(B)</div>
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-center border-b shadow-sm bg-gray-100">
                                    <div className="leading-tight">
                                        <div className="font-black text-gray-900">Total</div>
                                        <div className="text-sm font-semibold text-gray-700">(A+B)</div>
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-center font-bold text-gray-900 border-b shadow-sm">Position</th>
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
