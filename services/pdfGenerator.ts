
import jsPDF from 'jspdf';
import { DataContextType } from '../context/DataContext';
import { calculateReportData, formatScore, getOrdinal } from '../hooks/useReportCardData';
import type { Student, Grade } from '../types';

// Constants for layout (in mm)
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CARD_WIDTH = 200;
const CARD_HEIGHT = 287;
const MARGIN_X = (PAGE_WIDTH - CARD_WIDTH) / 2;
const MARGIN_Y = (PAGE_HEIGHT - CARD_HEIGHT) / 2;
const CONTENT_MARGIN = 6; // Padding inside the card

export const generateReportsPDF = async (students: Student[], data: DataContextType) => {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
    });

    const { settings, classes, grades, getReportData, getClassData } = data;

    // Helper to add text with optional scaling to fit width
    const addFitText = (text: string, x: number, y: number, maxWidth: number, fontSize: number, align: 'left' | 'center' | 'right' = 'left', isBold: boolean = false) => {
        doc.setFont('times', isBold ? 'bold' : 'normal');
        doc.setFontSize(fontSize);

        let currentSize = fontSize;
        let textWidth = doc.getTextWidth(text);

        while (textWidth > maxWidth && currentSize > 6) {
            currentSize -= 0.5;
            doc.setFontSize(currentSize);
            textWidth = doc.getTextWidth(text);
        }

        doc.text(text, x, y, { align: align });
        // Reset font
        doc.setFont('times', 'normal');
        doc.setFontSize(fontSize);
    };

    // Helper to draw dotted underline field
    const addUnderlinedField = (label: string, value: string, x: number, y: number, totalWidth: number, labelWidth: number, align: 'left' | 'center' = 'left', isBold: boolean = false, fontSize: number = 10) => {
        doc.setFont('times', 'bold');
        doc.setFontSize(10); // Standard label size
        doc.text(label + ':', x, y);

        const valueX = x + labelWidth;
        const valueWidth = totalWidth - labelWidth;

        // Draw dotted line
        doc.setDrawColor(0);
        doc.setLineWidth(0.1);
        doc.setLineDashPattern([1, 1], 0);
        doc.line(valueX, y + 1, valueX + valueWidth, y + 1);
        doc.setLineDashPattern([], 0); // Reset

        // Draw value
        let textX = valueX + (valueWidth / 2);
        if (align === 'left') textX = valueX + 2;
        addFitText(value, textX, y, valueWidth - 2, fontSize, align, isBold);
    };

    // Sort grades for key
    const sortedGrades = [...grades].sort((a, b) => b.minScore - a.minScore);

    for (let i = 0; i < students.length; i++) {
        if (i > 0) doc.addPage();

        const student = students[i];
        const reportCalcData = calculateReportData(student, data);
        const reportSpecificData = getReportData(student.id);
        const classInfo = classes.find(c => c.name === student.class);
        const classSpecificData = classInfo ? getClassData(classInfo.id) : undefined;

        const totalSchoolDays = classSpecificData?.totalSchoolDays || '-';
        const numOnRoll = students.filter(s => s.class === student.class).length;

        // --- BORDER ---
        doc.setDrawColor(0);
        doc.setLineWidth(0.8);
        doc.rect(MARGIN_X, MARGIN_Y, CARD_WIDTH, CARD_HEIGHT);

        // --- HEADER ---
        let currentY = MARGIN_Y + CONTENT_MARGIN;

        // Logo
        if (settings.logo) {
            try {
                doc.addImage(settings.logo, 'PNG', MARGIN_X + 6, currentY, 35, 28, undefined, 'FAST');
            } catch (e) {
                console.warn("Failed to add logo", e);
            }
        }

        // School Info
        const centerX = MARGIN_X + CARD_WIDTH / 2;

        doc.setFont('times', 'bold');
        doc.setFontSize(22);

        let textY = currentY + 8;

        // Dynamic School Name
        // Max width 130mm to avoid logo overlap (Logo is ~41mm wide from left)
        const schoolNameLines = doc.splitTextToSize(settings.schoolName.toUpperCase(), 130);
        const nameLinesArray = Array.isArray(schoolNameLines) ? schoolNameLines : [schoolNameLines];

        nameLinesArray.forEach(line => {
            doc.text(line, centerX, textY, { align: 'center' });
            textY += 8;
        });

        // Address & District
        doc.setFontSize(11);
        doc.setFont('times', 'normal');

        const addressData = [settings.address, settings.district].filter(Boolean);

        addressData.forEach(part => {
            const lines = doc.splitTextToSize(part, 160);
            const linesArray = Array.isArray(lines) ? lines : [lines];
            linesArray.forEach(line => {
                doc.text(line, centerX, textY, { align: 'center' });
                textY += 5;
            });
        });

        textY += 2;
        doc.setFontSize(16);
        doc.setFont('times', 'bold');
        doc.text("TERMINAL REPORT", centerX, textY + 5, { align: 'center' });

        // Finalize Header Height
        // Ensure at least enough space for logo (40mm roughly) or text height
        currentY = Math.max(MARGIN_Y + 40, textY + 10);

        // Header Border Line
        doc.setLineWidth(0.5);
        doc.line(MARGIN_X, currentY, MARGIN_X + CARD_WIDTH, currentY);

        // --- STUDENT INFO ---
        currentY += 8;
        const leftColX = MARGIN_X + 6;
        const rightColX = MARGIN_X + CARD_WIDTH - 6;
        const photoWidth = 30;
        const infoWidth = CARD_WIDTH - 12 - photoWidth - 5; // Space for info

        // Name
        // Name
        addUnderlinedField("Name", student.name, leftColX, currentY, infoWidth, 15, 'left', true, 14);

        currentY += 8;
        const colGap = 4;
        const colWidth = (infoWidth - (colGap * 2)) / 3;

        // Row 1
        addUnderlinedField("Academic Year", settings.academicYear, leftColX, currentY, colWidth, 26);
        addUnderlinedField("Term", settings.academicTerm, leftColX + colWidth + colGap, currentY, colWidth, 12);
        addUnderlinedField("Class", student.class, leftColX + (colWidth + colGap) * 2, currentY, colWidth, 12);

        // Row 2
        currentY += 8;
        addUnderlinedField("Index Number", student.indexNumber, leftColX, currentY, colWidth, 25);

        const formatAge = (age: string) => (!age || isNaN(Number(age))) ? age : (Number(age) === 1 ? '1 year' : `${age} years`);
        addUnderlinedField("Age", formatAge(student.age), leftColX + colWidth + colGap, currentY, colWidth, 10);
        addUnderlinedField("Gender", student.gender, leftColX + (colWidth + colGap) * 2, currentY, colWidth, 15);

        // Row 3 (Stats)
        currentY += 8;
        const totalScoreStr = `${formatScore(reportCalcData.totalScore)} / ${reportCalcData.subjectResults.length * 100}`;
        addUnderlinedField("Total Score", totalScoreStr, leftColX, currentY, colWidth, 22);

        const aggStr = reportCalcData.aggregateScore > 0 ? reportCalcData.aggregateScore.toString() : '-';
        addUnderlinedField("Aggregate", aggStr, leftColX + colWidth + colGap, currentY, colWidth, 18);

        const posStr = `${getOrdinal(reportCalcData.overallPosition)} out of ${numOnRoll}`;
        addUnderlinedField("Position", posStr, leftColX + (colWidth + colGap) * 2, currentY, colWidth, 16);

        // Row 4 (Dates)
        currentY += 8;
        const fmtDate = (d: string) => {
            if (!d) return '';
            try {
                const dt = new Date(d);
                return `${getOrdinal(dt.getDate())} ${dt.toLocaleString('en-GB', { month: 'short' })}, ${dt.getFullYear()}`;
            } catch { return d; }
        };
        addUnderlinedField("Vacation Date", fmtDate(settings.vacationDate), leftColX, currentY, colWidth * 1.5, 25);
        addUnderlinedField("Reopening Date", fmtDate(settings.reopeningDate), leftColX + (colWidth * 1.5) + colGap, currentY, colWidth * 1.5, 28);

        // Photo
        if (student.picture) {
            try {
                doc.rect(rightColX - photoWidth, MARGIN_Y + 45, photoWidth, 36); // Photo border
                doc.addImage(student.picture, 'PNG', rightColX - photoWidth, MARGIN_Y + 45, photoWidth, 36, undefined, 'FAST');
            } catch (e) {
                console.warn("Failed to add student picture", e);
            }
        }

        // --- PRE-CALCULATE FOOTER POSITION ---
        // Components: Grading Key (Header + Content), Attendance/Remarks, Signatures

        const numCols = 4;
        const itemsPerCol = Math.ceil(sortedGrades.length / numCols);
        const gradingKeyRowsHeight = itemsPerCol * 4;
        const gradingKeyHeaderHeight = 8;
        const gradingKeyTotalHeight = gradingKeyHeaderHeight + gradingKeyRowsHeight; // no padding

        const remarksHeight = 35; // Approx
        const signaturesHeight = 35; // Approx
        const footerTotalHeight = gradingKeyTotalHeight + remarksHeight + signaturesHeight + 5; // +5 buffer

        // Anchor to bottom
        const footerStartY = MARGIN_Y + CARD_HEIGHT - footerTotalHeight - 5; // 5mm from bottom border

        // --- ACADEMIC PERFORMANCE TABLE ---
        const maxTableY = footerStartY - 5; // 5mm gap before footer

        currentY += 15;
        doc.setFont('times', 'bold');
        doc.setFontSize(12);
        doc.text("ACADEMIC PERFORMANCE", centerX, currentY, { align: 'center' });

        currentY += 3;

        const tableX = MARGIN_X + 6;
        const tableWidth = CARD_WIDTH - 12;
        const colWidths = [
            tableWidth * 0.30, tableWidth * 0.11, tableWidth * 0.11, tableWidth * 0.11,
            tableWidth * 0.08, tableWidth * 0.09, tableWidth * 0.20
        ];
        const headers = [
            "SUBJECT", `CLASS SCORE (${reportCalcData.totalClassWeight}%)`, `EXAM SCORE (${reportCalcData.examWeight}%)`,
            "TOTAL (100%)", "GRADE", "POSITION", "REMARKS"
        ];

        let headerRowHeight = 10;
        let y = currentY;

        // Header Row
        doc.setFillColor(230, 230, 230);
        doc.rect(tableX, y, tableWidth, headerRowHeight, 'F');
        doc.setFontSize(9);
        doc.setLineWidth(0.2);

        let x = tableX;
        headers.forEach((h, idx) => {
            const w = colWidths[idx];
            doc.rect(x, y, w, headerRowHeight);
            const lines = doc.splitTextToSize(h, w - 2);
            doc.text(lines, x + w / 2, y + (headerRowHeight - (lines.length * 3)) / 2 + 2, { align: 'center' });
            x += w;
        });

        y += headerRowHeight;

        // Data Rows
        doc.setFont('times', 'normal');

        // Dynamic row height
        const availableHeight = maxTableY - y;
        const numSubjects = reportCalcData.subjectResults.length;
        const standardRowHeight = 6;
        const minRowHeight = 4.5;

        let rowHeight = standardRowHeight;
        if (numSubjects > 0 && (numSubjects * standardRowHeight) > availableHeight) {
            rowHeight = Math.max(minRowHeight, availableHeight / numSubjects);
        }

        reportCalcData.subjectResults.forEach(res => {
            x = tableX;
            doc.rect(x, y, colWidths[0], rowHeight);
            doc.setFont('times', 'bold');
            addFitText(res.subject, x + 2, y + (rowHeight / 2) + 1.5, colWidths[0] - 4, 11, 'left', true);
            doc.setFont('times', 'normal');
            x += colWidths[0];

            const drawCell = (txt: string, w: number, iBold = false) => {
                doc.rect(x, y, w, rowHeight);
                if (iBold) doc.setFont('times', 'bold');
                addFitText(txt, x + w / 2, y + (rowHeight / 2) + 1.5, w - 2, 11, 'center', iBold);
                if (iBold) doc.setFont('times', 'normal');
                x += w;
            };

            drawCell(formatScore(res.classScore), colWidths[1]);
            drawCell(formatScore(res.examScore), colWidths[2]);
            drawCell(formatScore(res.totalScore), colWidths[3], true);
            drawCell(res.grade, colWidths[4]);
            drawCell(res.position > 0 ? getOrdinal(res.position) : '-', colWidths[5]);

            doc.rect(x, y, colWidths[6], rowHeight);
            doc.setFont('times', 'bold');
            addFitText(res.remark, x + 2, y + (rowHeight / 2) + 1.5, colWidths[6] - 4, 11, 'left', true);

            y += rowHeight;
        });

        // --- RENDER FOOTER ---
        currentY = footerStartY;

        // Grading Key
        doc.setFillColor(0, 0, 0);
        doc.rect(tableX, currentY, tableWidth, gradingKeyTotalHeight, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont('times', 'bold');
        doc.setFontSize(10);
        doc.text("GRADING KEY", centerX, currentY + 5, { align: 'center' });

        currentY += gradingKeyHeaderHeight;
        const colW = tableWidth / numCols;
        doc.setFontSize(8);
        doc.setFont('times', 'normal');

        for (let c = 0; c < numCols; c++) {
            const colItems = sortedGrades.slice(c * itemsPerCol, (c + 1) * itemsPerCol);
            let gy = currentY;
            colItems.forEach(g => {
                doc.setFont('times', 'bold');
                doc.text(g.name, tableX + (c * colW) + 2, gy);
                doc.setFont('times', 'normal');
                doc.text(`${g.minScore}-${g.maxScore}%`, tableX + (c * colW) + 12, gy);
                doc.text(g.remark, tableX + (c * colW) + 28, gy);
                gy += 4;
            });
        }

        doc.setTextColor(0, 0, 0);

        // Attendance & Remarks
        currentY = footerStartY + gradingKeyTotalHeight + 5;

        addUnderlinedField("Attendance", reportSpecificData?.attendance || '', MARGIN_X + 6, currentY, 30, 20);
        doc.text("out of", MARGIN_X + 40, currentY);
        addUnderlinedField("", totalSchoolDays, MARGIN_X + 54, currentY, 20, 0);

        currentY += 6;
        currentY += 6;
        addUnderlinedField("Conduct", reportSpecificData?.conduct || '', MARGIN_X + 6, currentY, tableWidth, 20, 'left');
        currentY += 6;
        addUnderlinedField("Interest", reportSpecificData?.interest || '', MARGIN_X + 6, currentY, tableWidth, 20, 'left');
        currentY += 6;
        addUnderlinedField("Attitude", reportSpecificData?.attitude || '', MARGIN_X + 6, currentY, tableWidth, 20, 'left');
        currentY += 6;
        addUnderlinedField("Class Teacher's Remarks", reportSpecificData?.teacherRemark || '', MARGIN_X + 6, currentY, tableWidth, 40, 'left');

        // Signatures
        currentY += 12;
        doc.setLineWidth(0.5);
        doc.line(MARGIN_X + 6, currentY, MARGIN_X + CARD_WIDTH - 6, currentY);

        currentY += 5;
        const sigY = currentY + 15;
        const sigWidth = 50;

        const tSigX = MARGIN_X + 10;
        if (classInfo?.teacherSignature) {
            try {
                doc.addImage(classInfo.teacherSignature, 'PNG', tSigX + 10, currentY, 30, 15, undefined, 'FAST');
            } catch { }
        }
        doc.setLineDashPattern([1, 1], 0);
        doc.line(tSigX, sigY, tSigX + sigWidth, sigY);
        doc.setFontSize(9);
        doc.setFont('times', 'bold');
        doc.text("Class Teacher's Signature", tSigX + (sigWidth / 2), sigY + 4, { align: 'center' });
        if (classInfo?.teacherName) {
            doc.setFont('times', 'normal');
            doc.text(`(${classInfo.teacherName})`, tSigX + (sigWidth / 2), sigY + 8, { align: 'center' });
        }

        const hSigX = MARGIN_X + CARD_WIDTH - 10 - sigWidth;
        if (settings.headmasterSignature) {
            try {
                doc.addImage(settings.headmasterSignature, 'PNG', hSigX + 10, currentY, 30, 15, undefined, 'FAST');
            } catch { }
        }
        doc.line(hSigX, sigY, hSigX + sigWidth, sigY);
        doc.setFont('times', 'bold');
        doc.text("Headmaster's Signature", hSigX + (sigWidth / 2), sigY + 4, { align: 'center' });
        if (settings.headmasterName) {
            doc.setFont('times', 'normal');
            doc.text(`(${settings.headmasterName})`, hSigX + (sigWidth / 2), sigY + 8, { align: 'center' });
        }
        doc.setLineDashPattern([], 0);

        const stampX = MARGIN_X + (CARD_WIDTH / 2) - 25;
        doc.setDrawColor(150);
        doc.setLineWidth(0.5);
        doc.line(stampX, currentY, stampX + 50, currentY);
        doc.line(stampX, currentY + 25, stampX + 50, currentY + 25);
        doc.line(stampX, currentY, stampX, currentY + 25);
        doc.line(stampX + 50, currentY, stampX + 50, currentY + 25);
        doc.setTextColor(150);
        doc.text("Official School Stamp", stampX + 25, currentY + 12, { align: 'center', maxWidth: 40 });
        doc.setTextColor(0);

        // Page Footer
        const printedDate = new Date();
        const dateStr = `${getOrdinal(printedDate.getDate())} ${printedDate.toLocaleString('en-GB', { month: 'long' })}, ${printedDate.getFullYear()}`;
        doc.setFontSize(8);
        doc.text(`Printed on: ${dateStr}`, MARGIN_X + 6, MARGIN_Y + CARD_HEIGHT + 4);
        doc.text("Powered by MYKHIL Creations (+233) 0542410613", MARGIN_X + CARD_WIDTH - 6, MARGIN_Y + CARD_HEIGHT + 4, { align: 'right' });
    }

    doc.save('SBA_Pro_Master_Reports.pdf');
};
