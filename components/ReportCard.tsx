import React, { useRef, useLayoutEffect } from 'react';
import { useData } from '../context/DataContext';
import type { Student } from '../types';
import { useReportCardData } from '../hooks/useReportCardData';

const SIGNATURE_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTUwIDUwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGQ9Ik0yIDI1LjVDMiAyNS41IDE1LjUgMTUuNSAyOS41IDI4QzQzLjUgNDAuNSA1MyAyNS41IDY2LjUgMjAuNUM4MCAxNS41IDg4LjUgMjkgMTAwIDI5QzExMS41IDI5IDEyMyAxNS41IDEzNyAyOS45IiBzdHJva2U9IiM5Y2EzYWYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PC9zdmc+';

const FitText: React.FC<{
    children: React.ReactNode;
    maxFontSize?: number;
    minFontSize?: number;
    className?: string;
    mode?: 'single' | 'multi';
}> = ({ children, maxFontSize = 14, minFontSize = 9, className = '', mode = 'single' }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const adjustFontSize = () => {
            // Set initial font size to the max allowed to start the calculation.
            container.style.fontSize = `${maxFontSize}px`;

            const isOverflowing = () => {
                // A small buffer helps prevent floating point inaccuracies and ensures a fit.
                const buffer = 1;
                if (mode === 'single') {
                    // For single line, check if the content's width exceeds the container's width.
                    return container.scrollWidth > container.clientWidth + buffer;
                }
                // For multi-line, check if the content's height exceeds the container's height.
                return container.scrollHeight > container.clientHeight + buffer;
            };

            let currentFontSize = maxFontSize;
            // Loop downwards from max size until the content fits or min size is reached.
            while (isOverflowing() && currentFontSize > minFontSize) {
                currentFontSize -= 0.5;
                container.style.fontSize = `${currentFontSize}px`;
            }
        };

        // Run the adjustment logic once after render.
        adjustFontSize();

        // The effect re-runs if the content or size constraints change.
    }, [children, maxFontSize, minFontSize, mode]);

    const styles: React.CSSProperties = {
        width: '100%',
        lineHeight: 1.2,
        display: 'block',
    };

    if (mode === 'single') {
        styles.whiteSpace = 'nowrap';
        styles.overflow = 'hidden';
        styles.textOverflow = 'clip';
    } else {
        styles.height = '100%';
        styles.overflow = 'hidden';
    }

    return (
        <div ref={containerRef} className={className} style={styles}>
            {children}
        </div>
    );
};


const ReportCard: React.FC<{ student: Student }> = ({ student }) => {
    const { students, settings, classes, grades, getReportData, getClassData } = useData();
    const { subjectResults, totalClassWeight, examWeight, aggregateScore, overallPosition, totalScore, formatScore, getOrdinal } = useReportCardData(student);

    const classInfo = classes.find(c => c.name === student.class);
    const reportData = getReportData(student.id);
    const classData = classInfo ? getClassData(classInfo.id) : undefined;
    const totalSchoolDays = classData?.totalSchoolDays || '-';
    const numOnRoll = students.filter(s => s.class === student.class).length;

    const formatDate = (dateString: string): string => {
        if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
        try {
            const date = new Date(dateString + 'T00:00:00');
            const day = date.getDate();
            const month = date.toLocaleString('en-GB', { month: 'long' });
            const year = date.getFullYear();
            return `${getOrdinal(day)} ${month}, ${year}`;
        } catch (e) { return dateString; }
    };

    const formatAge = (ageString: string): string => {
        if (!ageString || isNaN(Number(ageString))) return ageString;
        const age = Number(ageString);
        if (age === 1) {
            return '1 year';
        }
        return `${age} years`;
    };

    const printedDate = new Date();
    const formattedPrintedDate = `${getOrdinal(printedDate.getDate())} ${printedDate.toLocaleString('en-GB', { month: 'long' })}, ${printedDate.getFullYear()}`;

    const sortedGrades = [...grades].sort((a, b) => b.minScore - a.minScore);
    const numCols = 4;
    const colSize = Math.ceil(sortedGrades.length / numCols);
    const gradeColumns = Array.from({ length: numCols }, (_, i) =>
        sortedGrades.slice(i * colSize, (i + 1) * colSize)
    ).filter(col => col.length > 0);

    const InfoItem: React.FC<{ label: string; value?: React.ReactNode; className?: string }> = ({ label, value, className = '' }) => (
        <div className={`flex items-baseline py-0.5 ${className}`}>
            <span className="font-bold whitespace-nowrap pr-2 text-black">{label}:</span>
            <div className="relative w-full h-5 border-b border-dotted border-black text-black overflow-hidden">
                <div className="absolute bottom-0 left-0 right-0">
                    {value ? <FitText maxFontSize={14} minFontSize={10} mode="single">{value}</FitText> : <span className="invisible">.</span>}
                </div>
            </div>
        </div>
    );

    const DataItem: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
        <div className="flex items-baseline py-0.5">
            <span className="font-bold whitespace-nowrap pr-2 text-black">{label}:</span>
            <div className="relative w-full h-5 border-b border-dotted border-black text-black overflow-hidden">
                <div className="absolute bottom-0 left-0 right-0">
                    {value ? <FitText maxFontSize={14} minFontSize={10} mode="single">{value}</FitText> : <span className="invisible">.</span>}
                </div>
            </div>
        </div>
    );

    return (
        <div className="printable-report-card w-[200mm] min-h-[287mm] bg-white text-[13pt] text-black p-6 shadow-lg font-['Times_New_Roman'] flex flex-col border-4 border-black relative">

            <header className="flex items-center justify-between py-2 border-b-2 border-black flex-shrink-0">
                {settings.logo ? (
                    <div className="w-40 h-32 flex-shrink-0">
                        <img src={settings.logo} alt="School Logo" className="w-full h-full object-contain" />
                    </div>
                ) : (
                    <div className="w-40 h-32 flex-shrink-0" />
                )}
                <div className="text-center px-4">
                    <h1 className="text-3xl font-bold uppercase">{settings.schoolName}</h1>
                    <p className="text-md whitespace-pre-line leading-tight">{[settings.address, settings.district].filter(Boolean).join('\n')}</p>
                    <p className="text-xl font-semibold mt-1">TERMINAL REPORT</p>
                </div>
                <div className="w-40 h-32 flex-shrink-0"></div>
            </header>

            <section className="flex justify-between items-start mt-1 text-sm gap-x-4 flex-shrink-0">
                <div className="flex-grow">
                    {/* Row 1: Name */}
                    <div className="flex items-baseline py-0.5">
                        <span className="font-bold whitespace-nowrap pr-2 text-black">Name:</span>
                        <div className="relative w-full h-6 border-b border-dotted border-black text-black overflow-hidden font-bold text-lg -mb-1">
                            <div className="absolute bottom-0 left-0 right-0">
                                {student.name ? <FitText maxFontSize={18} minFontSize={14} mode="single">{student.name}</FitText> : <span className="invisible">.</span>}
                            </div>
                        </div>
                    </div>

                    <div className="mt-1 space-y-1">
                        {/* Row 2 */}
                        <div className="flex gap-x-4">
                            <div className="flex-1"><InfoItem label="Academic Year" value={settings.academicYear} /></div>
                            <div className="flex-1"><InfoItem label="Term" value={settings.academicTerm} /></div>
                            <div className="flex-1"><InfoItem label="Class" value={student.class} /></div>
                        </div>

                        {/* Row 3 */}
                        <div className="flex gap-x-4">
                            <div className="flex-1"><InfoItem label="Index Number" value={student.indexNumber} /></div>
                            <div className="flex-1"><InfoItem label="Age" value={formatAge(student.age)} /></div>
                            <div className="flex-1"><InfoItem label="Gender" value={student.gender} /></div>
                        </div>

                        {/* Row 4 */}
                        <div className="flex gap-x-4">
                            <div className="flex-1"><InfoItem label="Total Score" value={`${formatScore(totalScore)} / ${subjectResults.length * 100}`} /></div>
                            <div className="flex-1"><InfoItem label="Aggregate" value={aggregateScore > 0 ? aggregateScore : '-'} /></div>
                            <div className="flex-1"><InfoItem label="Position" value={`${getOrdinal(overallPosition)} out of ${numOnRoll} ${numOnRoll === 1 ? 'student' : 'students'}`} /></div>
                        </div>

                        {/* Row 5 */}
                        <div className="flex gap-x-4">
                            <div className="flex-1"><InfoItem label="Vacation Date" value={formatDate(settings.vacationDate)} /></div>
                            <div className="flex-1"><InfoItem label="Reopening Date" value={formatDate(settings.reopeningDate)} /></div>
                        </div>
                    </div>
                </div>
                {student.picture && (
                    <div className="w-32 h-40 flex-shrink-0 ml-4 mt-1">
                        <img src={student.picture} alt="Student" className="w-full h-full object-cover border-2 border-black" />
                    </div>
                )}
            </section>

            <section className="mt-4 flex-shrink-0">
                <div>
                    <h2 className="text-center font-bold text-lg mb-1">ACADEMIC PERFORMANCE</h2>
                    <div className="w-full">
                        <table className="w-full border-collapse border border-black">
                            <thead className="bg-gray-200 text-center font-bold text-black">
                                <tr style={{ fontSize: '11pt' }}>
                                    <td className="border border-black p-1 w-[30%]">SUBJECT</td>
                                    <td className="border border-black p-1">CLASS SCORE<br />({totalClassWeight}%)</td>
                                    <td className="border border-black p-1">EXAM SCORE<br />({examWeight}%)</td>
                                    <td className="border border-black p-1">TOTAL<br />(100%)</td>
                                    <td className="border border-black p-1">GRADE</td>
                                    <td className="border border-black p-1">POSITION</td>
                                    <td className="border border-black p-1">REMARKS</td>
                                </tr>
                            </thead>
                            <tbody>
                                {subjectResults.map((res, index) => (
                                    <tr key={index} className="text-center text-black">
                                        <td className="border border-black p-1 text-left font-bold whitespace-nowrap overflow-hidden text-ellipsis">{res.subject}</td>
                                        <td className="border border-black p-1 whitespace-nowrap overflow-hidden">{formatScore(res.classScore)}</td>
                                        <td className="border border-black p-1 whitespace-nowrap overflow-hidden">{formatScore(res.examScore)}</td>
                                        <td className="border border-black p-1 font-bold whitespace-nowrap overflow-hidden">{formatScore(res.totalScore)}</td>
                                        <td className="border border-black p-1 whitespace-nowrap overflow-hidden">{res.grade}</td>
                                        <td className="border border-black p-1 whitespace-nowrap overflow-hidden">{getOrdinal(res.position)}</td>
                                        <td className="border border-black p-1 font-bold whitespace-nowrap overflow-hidden text-ellipsis">{res.remark}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <section className="mt-2 text-xs bg-black text-white rounded-md px-2 py-1 flex-shrink-0">
                <h3 className="text-center font-bold uppercase border-b border-gray-600">Grading Key</h3>
                <div className="flex justify-center gap-x-3 mt-1">
                    {gradeColumns.map((col, colIndex) => (
                        <div key={colIndex} className="w-1/4 space-y-0">
                            {col.map(g => (
                                <div key={g.id} className="grid grid-cols-[2rem_4rem_1fr] items-baseline">
                                    <span className="font-bold">{g.name}</span>
                                    <span className="text-center">{g.minScore}-{g.maxScore}%</span>
                                    <span>{g.remark}</span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </section>

            <section className="mt-1 text-sm space-y-1 flex-shrink-0">
                <div className="flex items-baseline py-0.5">
                    <span className="font-bold whitespace-nowrap pr-2 text-black">Attendance:</span>
                    <div className="relative w-20 h-5 border-b border-dotted border-black">
                        <div className="absolute bottom-0 left-0 right-0">
                            <FitText className="text-center" maxFontSize={14} minFontSize={10} mode="single">{reportData?.attendance}</FitText>
                        </div>
                    </div>
                    <span className="px-2">out of</span>
                    <div className="relative w-20 h-5 border-b border-dotted border-black">
                        <div className="absolute bottom-0 left-0 right-0">
                            <FitText className="text-center" maxFontSize={14} minFontSize={10} mode="single">{totalSchoolDays}</FitText>
                        </div>
                    </div>
                </div>
                <DataItem label="Conduct" value={reportData?.conduct} />
                <DataItem label="Interest" value={reportData?.interest} />
                <DataItem label="Attitude" value={reportData?.attitude} />
                <DataItem label="Class Teacher's Remarks" value={reportData?.teacherRemark} />
            </section>

            <section className="mt-auto pt-4 border-t-2 border-black flex justify-between items-end text-sm text-center flex-shrink-0">
                <div className="w-48">
                    <div className="h-10 flex justify-center items-center">
                        {classInfo?.teacherSignature && <img src={classInfo.teacherSignature} alt="Teacher's Signature" className="h-full object-contain" />}
                    </div>
                    <div className="border-t border-dotted border-black mt-1 pt-1 font-semibold">
                        <div>Class Teacher's Signature</div>
                        {classInfo?.teacherName && <div className="font-normal">({classInfo.teacherName})</div>}
                    </div>
                </div>
                <div className="w-48">
                    <div className="h-10 flex justify-center items-center">
                        {settings.headmasterSignature && <img src={settings.headmasterSignature} alt="Headmaster's Signature" className="h-full object-contain" />}
                    </div>
                    <div className="border-t border-dotted border-black mt-1 pt-1 font-semibold">
                        <div>Headmaster's Signature</div>
                        {settings.headmasterName && <div className="font-normal">({settings.headmasterName})</div>}
                    </div>
                </div>
                <div className="w-56">
                    <div className="h-28 border-2 border-dashed border-black rounded-md flex justify-center items-center text-center text-gray-400 p-2">
                        <span className="text-sm font-semibold">Official School Stamp / Seal</span>
                    </div>
                    <div className="mt-1 pt-1 font-semibold invisible">
                        Official Stamp / Seal
                    </div>
                </div>
            </section>

            <footer className="absolute -bottom-5 left-0 right-0 text-[10pt] text-center">
                <div className="flex justify-between px-6">
                    <span>Printed on: {formattedPrintedDate}</span>
                    <span className="font-semibold">Powered by MYKHIL Creations (+233) 0542410613</span>
                </div>
            </footer>
        </div>
    );
};

export default ReportCard;
