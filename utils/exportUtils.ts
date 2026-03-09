import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Export data to a formatted Excel file
 * @param data Array of objects containing the data
 * @param headers Array of column headers
 * @param keys Array of keys corresponding to the headers in the data objects
 * @param filename Name of the file to download (without extension)
 * @param sheetName Name of the worksheet
 */
export const exportToExcel = async (
    data: any[],
    headers: string[],
    keys: string[],
    filename: string,
    sheetName: string = 'Sheet1'
) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    // Add headers
    const headerRow = worksheet.addRow(headers);

    // Style headers
    headerRow.eachCell((cell) => {
        cell.font = { bold: true, size: 12 };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD3D3D3' } // Light gray background
        };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Add data rows
    data.forEach(item => {
        const rowData = keys.map(key => item[key] || '');
        const row = worksheet.addRow(rowData);

        // Style data cells
        row.eachCell((cell) => {
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
        });
    });

    // Auto-fit columns (simple approximation)
    worksheet.columns.forEach((column, i) => {
        let maxLength = 0;
        column.eachCell!({ includeEmpty: true }, (cell) => {
            const columnLength = cell.value ? cell.value.toString().length : 10;
            if (columnLength > maxLength) {
                maxLength = columnLength;
            }
        });
        column.width = maxLength < 10 ? 10 : maxLength + 2;
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Trigger download
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
};

/**
 * specialized Export for Subject Analysis with Complex Merging & Styling
 */
export const exportSubjectAnalysisExcel = async (
    subjectGradeCounts: Record<string, Record<string, Record<string, number>>>,
    aggregateCountsByGender: Record<string, Record<number, number>>,
    gradeNames: string[],
    activeSubjects: string[],
    sortedAggregates: number[],
    totalStudents: number,
    averageAggregate: string,
    className: string,
    filename: string,
    passMark: number,
    passStats: { Male: { count: number, percentage: number }, Female: { count: number, percentage: number }, Total: { count: number, percentage: number } }
) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Subject Analysis');

    // 1. Report Header
    const titleRow = worksheet.addRow([`SUBJECT ANALYSIS REPORT - ${className}`]);
    worksheet.mergeCells(`A1:${String.fromCharCode(65 + gradeNames.length + 2)}1`); // Merge spanning all columns
    titleRow.getCell(1).font = { bold: true, size: 16 };
    titleRow.getCell(1).alignment = { horizontal: 'center' };
    
    worksheet.addRow([`Generated on: ${new Date().toLocaleDateString()}`]);
    worksheet.mergeCells(`A2:${String.fromCharCode(65 + gradeNames.length + 2)}2`);
    
    // Pass Mark Header Detail
    const passDetailRow = worksheet.addRow([`Pass Aggregate: ≤ ${passMark} | Male Pass: ${passStats.Male.count} (${passStats.Male.percentage.toFixed(1)}%) | Female Pass: ${passStats.Female.count} (${passStats.Female.percentage.toFixed(1)}%)`]);
    worksheet.mergeCells(`A3:${String.fromCharCode(65 + gradeNames.length + 2)}3`);
    passDetailRow.getCell(1).font = { italic: true, size: 10 };
    
    worksheet.addRow([]); // Spacer

    // 2. Section 1: Subject-wise Grade Analysis
    const sec1Title = worksheet.addRow(['SECTION 1: SUBJECT-WISE GRADE ANALYSIS']);
    sec1Title.getCell(1).font = { bold: true, size: 12 };
    worksheet.addRow([]); // Spacer
    
    const headers = ['SUBJECT', 'GENDER', ...gradeNames.map(g => `Grade ${g}`), 'TOTAL'];
    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }; // Blue Header
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // Data Rows
    // FIXED: currentRow was 6, which was the header row. Data starts at row 8 (Title(1), Date(2), Pass(3), Spacer(4), SecTitle(5), Spacer(6), Headers(7))
    let currentRow = 8; 
    activeSubjects.forEach(subject => {
        const startMergeRow = currentRow;
        ['Male', 'Female', 'Total'].forEach((gender) => {
            const rowValues = [subject, gender];
            let rowTotal = 0;
            gradeNames.forEach(grade => {
                const count = subjectGradeCounts[subject][gender][grade] || 0;
                rowValues.push(count);
                rowTotal += count;
            });
            rowValues.push(rowTotal);
            
            const row = worksheet.addRow(rowValues);
            
            // Gender-based Styling
            row.eachCell((cell, colNumber) => {
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                cell.alignment = { horizontal: colNumber <= 2 ? 'left' : 'center', vertical: 'middle' };
                
                if (gender === 'Male') {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7EFFF' } }; // Soft Blue
                } else if (gender === 'Female') {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE7EF' } }; // Soft Pink
                } else if (gender === 'Total') {
                    cell.font = { bold: true };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }; // Light Gray
                }
            });
            currentRow++;
        });
        
        // Merge Subject Cell across 3 rows
        worksheet.mergeCells(`A${startMergeRow}:A${currentRow - 1}`);
        const subjectCell = worksheet.getCell(`A${startMergeRow}`);
        subjectCell.font = { bold: true, color: { argb: 'FF000000' } };
        subjectCell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    worksheet.addRow([]); // Spacer
    worksheet.addRow([]); // Spacer

    // 3. Section 2: Aggregate Performance Analysis
    const sec2Title = worksheet.addRow(['SECTION 2: AGGREGATE PERFORMANCE ANALYSIS']);
    sec2Title.getCell(1).font = { bold: true, size: 12 };
    worksheet.addRow([]); // Spacer

    const aggHeaders = ['GENDER', ...sortedAggregates.map(a => `Agg ${a}`), 'PASSED', 'PASS %', 'TOTAL'];
    const aggHeaderRow = worksheet.addRow(aggHeaders);
    aggHeaderRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    ['Male', 'Female', 'Total'].forEach(gender => {
        const rowValues = [gender];
        let genderTotal = 0;
        
        sortedAggregates.forEach(agg => {
            let count = 0;
            if (gender === 'Total') {
                count = (aggregateCountsByGender['Male'][agg] || 0) + (aggregateCountsByGender['Female'][agg] || 0);
            } else {
                count = aggregateCountsByGender[gender][agg] || 0;
            }
            rowValues.push(count);
            genderTotal += count;
        });

        // Add Pass Stats
        const stats = gender === 'Total' ? passStats.Total : (gender === 'Male' ? passStats.Male : passStats.Female);
        rowValues.push(stats.count);
        rowValues.push(`${stats.percentage.toFixed(1)}%`);

        rowValues.push(gender === 'Total' ? totalStudents : genderTotal);
        
        const row = worksheet.addRow(rowValues);
        row.eachCell((cell, colNumber) => {
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.alignment = { horizontal: colNumber === 1 ? 'left' : 'center', vertical: 'middle' };
            
            // Pass column coloring (Emerald/Green)
            if (colNumber === sortedAggregates.length + 2 || colNumber === sortedAggregates.length + 3) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7FFE7' } }; // Soft Green
            } else if (gender === 'Male') {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7EFFF' } };
            } else if (gender === 'Female') {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE7EF' } };
            }

            if (gender === 'Total') {
                cell.font = { bold: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
            }
        });
    });

    // 4. Statistics Summary
    worksheet.addRow([]);
    worksheet.addRow(['SUMMARY METRICS']);
    const statsStartRow = worksheet.lastRow!.number;
    worksheet.getCell(`A${statsStartRow}`).font = { bold: true };
    worksheet.addRow(['Total Students:', totalStudents]);
    worksheet.addRow(['Average Aggregate:', averageAggregate]);
    worksheet.addRow(['Male Pass Rate:', `${passStats.Male.percentage.toFixed(1)}% (${passStats.Male.count} students)`]);
    worksheet.addRow(['Female Pass Rate:', `${passStats.Female.percentage.toFixed(1)}% (${passStats.Female.count} students)`]);

    // Cleanup and Download
    worksheet.columns.forEach(column => column.width = 15);
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
};

/**
 * Export data to a PDF file with a table
 * @param title Title of the report
 * @param headers Array of column headers
 * @param data Array of arrays containing the row data
 * @param filename Name of the file to download (without extension)
 */
export const exportToPDF = (
    title: string,
    headers: string[],
    data: any[][],
    filename: string
) => {
    const doc = new jsPDF();

    // Add title
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    const dateStr = new Date().toLocaleDateString();
    doc.text(`Generated on: ${dateStr}`, 14, 30);

    // Add table
    autoTable(doc, {
        head: [headers],
        body: data,
        startY: 40,
        theme: 'grid',
        headStyles: { fillColor: [66, 139, 202] }, // Blue header
        styles: { fontSize: 8, cellPadding: 2 },
    });

    doc.save(`${filename}.pdf`);
};
