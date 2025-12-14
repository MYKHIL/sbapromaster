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
        styles: { fontSize: 10, cellPadding: 3 },
    });

    doc.save(`${filename}.pdf`);
};
