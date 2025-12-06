import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import ReportCard from '../ReportCard';
import ReportCustomizationPanel from '../ReportCustomizationPanel';
import type { Student } from '../../types';
import { useReportCardData } from '../../hooks/useReportCardData';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { SHOW_PDF_DOWNLOAD_BUTTON } from '../../constants';

const PerformanceSummaryFetcher: React.FC<{ student: Student, children: (summary: string) => React.ReactNode }> = ({ student, children }) => {
    const { performanceSummary } = useReportCardData(student);
    return <>{children(performanceSummary)}</>;
}

const ReportViewer: React.FC = () => {
  const { students, classes, getClassData, updateClassData } = useData();
  const [selectedClassId, setSelectedClassId] = useState<number | ''>(classes[0]?.id || '');
  const [selectedStudentId, setSelectedStudentId] = useState<number | 'all'>('all');
  const [generatedReports, setGeneratedReports] = useState<Student[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [totalDays, setTotalDays] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const reportContainerRef = useRef<HTMLDivElement>(null);
  const reportScaleContainerRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    if (selectedClassId) {
        const classData = getClassData(Number(selectedClassId));
        setTotalDays(classData?.totalSchoolDays || '');
    } else {
        setTotalDays('');
    }
  }, [selectedClassId, getClassData]);

  const studentsInClass = useMemo(() => {
    if (!selectedClassId) return [];
    const selectedClass = classes.find(c => c.id === selectedClassId);
    if (!selectedClass) return [];
    return students.filter(s => s.class === selectedClass.name);
  }, [students, classes, selectedClassId]);

  useEffect(() => {
    if (!selectedClassId) {
      setGeneratedReports([]);
      setShowPanel(false);
      return;
    }

    if (selectedStudentId === 'all') {
      setGeneratedReports(studentsInClass);
      setShowPanel(false);
    } else {
      const student = students.find(s => s.id === selectedStudentId);
      if (student) {
        setGeneratedReports([student]);
        setShowPanel(true);
      } else {
        setGeneratedReports([]);
        setShowPanel(false);
      }
    }
  }, [selectedStudentId, selectedClassId, studentsInClass, students]);
  
  // Effect to scale report card previews to fit the screen
  useEffect(() => {
    const scaleReports = () => {
        if (!reportContainerRef.current || !reportScaleContainerRef.current) return;
        const containerWidth = reportScaleContainerRef.current.offsetWidth;
        const reportWidth = 210; // A4 width in mm, which our styling is based on
        
        // Convert mm to an approximate pixel value for scaling. A common screen DPI is 96, 1mm ~ 3.78px
        const reportPixelWidth = reportWidth * 3.78;
        
        if (containerWidth < reportPixelWidth) {
            const scale = containerWidth / reportPixelWidth;
            reportContainerRef.current.style.transform = `scale(${scale})`;
            reportContainerRef.current.style.transformOrigin = 'top center';
        } else {
            reportContainerRef.current.style.transform = 'scale(1)';
            reportContainerRef.current.style.transformOrigin = 'top center';
        }
    };
    
    scaleReports();
    window.addEventListener('resize', scaleReports);
    return () => window.removeEventListener('resize', scaleReports);
  }, [generatedReports]);


  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const classId = e.target.value ? Number(e.target.value) : '';
      setSelectedClassId(classId);
      setSelectedStudentId('all');
  };

  const handleStudentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const studentId = e.target.value === 'all' ? 'all' : Number(e.target.value);
      setSelectedStudentId(studentId);
  };
  
  const selectedStudentForPanel = useMemo(() => {
    if (showPanel && selectedStudentId !== 'all') {
        return students.find(s => s.id === selectedStudentId);
    }
    return undefined;
  }, [showPanel, selectedStudentId, students]);

  const handleTotalDaysBlur = () => {
    if (selectedClassId) {
        updateClassData(Number(selectedClassId), { totalSchoolDays: totalDays });
    }
  };
  
  const handleDownloadPdf = async () => {
    if (!reportContainerRef.current) return;
    setIsGeneratingPdf(true);

    const reportElements = reportContainerRef.current.querySelectorAll('.printable-report-card');
    if (reportElements.length === 0) {
        setIsGeneratingPdf(false);
        return;
    }

    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });
    
    // A4 dimensions
    const A4_WIDTH = 210;
    const A4_HEIGHT = 297;
    // Report card dimensions from TailwindCSS classes (w-[200mm] h-[287mm])
    const REPORT_WIDTH = 200;
    const REPORT_HEIGHT = 287;
    // Calculate margins to center the report on the A4 page
    const MARGIN_X = (A4_WIDTH - REPORT_WIDTH) / 2;
    const MARGIN_Y = (A4_HEIGHT - REPORT_HEIGHT) / 2;

    // Temporarily remove scaling transform from the container for accurate capture
    const originalTransform = reportContainerRef.current.style.transform;
    reportContainerRef.current.style.transform = 'scale(1)';

    for (let i = 0; i < reportElements.length; i++) {
        const reportElement = reportElements[i] as HTMLElement;

        // Brief delay to allow the browser to re-render at full scale before capture
        await new Promise(resolve => setTimeout(resolve, 50));

        const canvas = await html2canvas(reportElement, {
            scale: 3, // Increased scale for crisp text and images
            useCORS: true,
            width: reportElement.offsetWidth,
            height: reportElement.offsetHeight,
            windowWidth: reportElement.scrollWidth,
            windowHeight: reportElement.scrollHeight,
        });

        const imgData = canvas.toDataURL('image/png', 1.0); // Use full quality PNG
        
        if (i > 0) {
            pdf.addPage();
        }
        
        // Add the captured image to the PDF with high-quality (lossless) compression,
        // maintaining its native dimensions and centering it on the page.
        // This prevents stretching and ensures an exact replica.
        pdf.addImage(imgData, 'PNG', MARGIN_X, MARGIN_Y, REPORT_WIDTH, REPORT_HEIGHT);
    }
    
    // Restore the original transform to the container after capturing all reports
    reportContainerRef.current.style.transform = originalTransform;

    pdf.save('SBA_Pro_Master_Reports.pdf');
    setIsGeneratingPdf(false);
  };


  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Report Viewer</h1>
      
      <div className="bg-gray-100 py-4">
        <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200 flex flex-col sm:flex-row flex-wrap items-center gap-4">
            <div className="w-full sm:w-auto sm:flex-1">
                <label className="block text-sm font-medium text-gray-800 mb-1">Select Class</label>
                <select
                  value={selectedClassId}
                  onChange={handleClassChange}
                  className="w-full p-2 bg-white border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="" disabled>Select a class</option>
                  {classes.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
            </div>
            <div className="w-full sm:w-auto sm:flex-1">
                <label className="block text-sm font-medium text-gray-800 mb-1">Total School Days</label>
                <input 
                  type="text"
                  value={totalDays}
                  onChange={e => setTotalDays(e.target.value)}
                  onBlur={handleTotalDaysBlur}
                  disabled={!selectedClassId}
                  placeholder="e.g., 65"
                  className="w-full p-2 bg-white border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                />
            </div>
             <div className="w-full sm:w-auto sm:flex-1">
                <label className="block text-sm font-medium text-gray-800 mb-1">Select Student</label>
                <select
                  value={selectedStudentId}
                  onChange={handleStudentChange}
                  disabled={!selectedClassId}
                  className="w-full p-2 bg-white border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                >
                  <option value="all">All Students</option>
                  {studentsInClass.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </select>
            </div>
        </div>
      </div>
      
      {selectedStudentForPanel && (
            <PerformanceSummaryFetcher student={selectedStudentForPanel}>
                {(summary) => (
                    <ReportCustomizationPanel student={selectedStudentForPanel} performanceSummary={summary} />
                )}
            </PerformanceSummaryFetcher>
       )}


      <div ref={reportScaleContainerRef} className="pt-8">
        <div ref={reportContainerRef} className="space-y-12 mx-auto">
          {generatedReports.length > 0 ? (
            generatedReports.map(student => (
              <div key={student.id} className="report-container">
                <ReportCard student={student} />
              </div>
            ))
          ) : (
            <div className="text-center py-20 bg-white rounded-lg shadow-md border">
              <h2 className="text-xl text-gray-500">
                Please select a class to view reports.
              </h2>
            </div>
          )}
        </div>
      </div>
      {SHOW_PDF_DOWNLOAD_BUTTON && generatedReports.length > 0 && (
          <div className="fixed bottom-6 right-6 z-20 flex flex-col items-center gap-4">
              <button
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="flex items-center bg-green-600 text-white px-5 py-3 rounded-full shadow-lg hover:bg-green-700 transition-all duration-300 transform hover:scale-110 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:scale-100"
                aria-label="Download Reports as PDF"
              >
                {isGeneratingPdf ? (
                    <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <span>Generating...</span>
                    </>
                ) : (
                    <>
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                         <span className="ml-2 font-semibold hidden sm:inline">Download PDF</span>
                    </>
                )}
              </button>
          </div>
      )}
    </div>
  );
};

export default ReportViewer;