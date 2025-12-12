import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import ReportCard from '../ReportCard';
import ReportCustomizationPanel from '../ReportCustomizationPanel';
import type { Student } from '../../types';
import { useReportCardData } from '../../hooks/useReportCardData';
// import { generateReportsPDF } from '../../services/pdfGenerator'; // Moved to dynamic import
import { SHOW_PDF_DOWNLOAD_BUTTON } from '../../constants';
import { useUser } from '../../context/UserContext';
import { getAvailableClasses } from '../../utils/permissions';
import PdfErrorModal from '../PdfErrorModal';

const PerformanceSummaryFetcher: React.FC<{ student: Student, children: (summary: string) => React.ReactNode }> = ({ student, children }) => {
  const { performanceSummary } = useReportCardData(student);
  return <>{children(performanceSummary)}</>;
}

const ReportViewer: React.FC = () => {
  const data = useData();
  const { students, classes, getClassData, updateClassData } = data;
  const { currentUser, isAuthenticated } = useUser();
  const [selectedClassId, setSelectedClassId] = useState<number | ''>(() => {
    const saved = localStorage.getItem('reportViewer_selectedClassId');
    if (saved) return Number(saved);
    // Default to first accessible class if available
    return '';
  });
  const [selectedStudentId, setSelectedStudentId] = useState<number | 'all'>(() => {
    const saved = localStorage.getItem('reportViewer_selectedStudentId');
    // If 'all' was saved, return it. If a number was saved, parse it. Default to 'all'.
    if (saved === 'all') return 'all';
    return saved ? Number(saved) : 'all';
  });
  const [generatedReports, setGeneratedReports] = useState<Student[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(true);
  const [pdfError, setPdfError] = useState<any>(null);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);

  const reportContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [contentSize, setContentSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (reportContainerRef.current) {
      setContentSize({
        width: reportContainerRef.current.scrollWidth,
        height: reportContainerRef.current.scrollHeight
      });
    }
  }, [generatedReports]);

  // Track scroll position to show/hide indicator
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const isScrollable = container.scrollWidth > container.clientWidth;
      const isAtEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 10;
      setShowScrollIndicator(isScrollable && !isAtEnd && generatedReports.length > 1);
    };

    handleScroll(); // Initial check
    container.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleScroll);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [generatedReports]);



  const studentsInClass = useMemo(() => {
    if (!selectedClassId) return [];
    const selectedClass = classes.find(c => c.id === selectedClassId);
    if (!selectedClass) return [];
    return students.filter(s => s.class === selectedClass.name);
  }, [students, classes, selectedClassId]);


  // Filter classes based on user permissions
  const accessibleClasses = useMemo(() => {
    return getAvailableClasses(currentUser, classes);
  }, [classes, currentUser]);

  // Auto-select first accessible class if none is selected
  useEffect(() => {
    if (!selectedClassId && accessibleClasses.length > 0) {
      const firstClassId = accessibleClasses[0].id;
      setSelectedClassId(firstClassId);
      localStorage.setItem('reportViewer_selectedClassId', String(firstClassId));
    }
  }, [accessibleClasses, selectedClassId]);

  // Check if user can edit comments/data for a specific class
  const canEditClass = (className: string) => {
    if (!currentUser) return false;
    if (currentUser.role === 'Admin') return true;
    if (currentUser.role === 'Teacher') {
      return currentUser.allowedClasses.includes(className);
    }
    return false; // Guests cannot edit
  };

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




  // Initialize zoom based on screen size to fit one report card (both width and height)
  useEffect(() => {
    const calculateOptimalZoom = () => {
      // A4 report card dimensions: ~800px width x ~1130px height (210mm x 297mm at 96dpi)
      const reportCardWidth = 800;
      const reportCardHeight = 1130;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Account for UI elements: header (~200px), padding, margins
      const availableWidth = viewportWidth - 100;
      const availableHeight = viewportHeight - 250;

      // Calculate zoom to fit both dimensions
      const zoomByWidth = availableWidth / reportCardWidth;
      const zoomByHeight = availableHeight / reportCardHeight;

      // Use the smaller zoom to ensure entire card fits
      const calculatedZoom = Math.min(1, zoomByWidth, zoomByHeight);

      // Ensure zoom doesn't go below 0.25 for readability
      const finalZoom = Math.max(0.25, calculatedZoom);

      setZoomLevel(finalZoom);
    };

    window.addEventListener('resize', calculateOptimalZoom);
    calculateOptimalZoom(); // Initial check

    return () => window.removeEventListener('resize', calculateOptimalZoom);
  }, []);

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const classId = e.target.value ? Number(e.target.value) : '';
    setSelectedClassId(classId);
    localStorage.setItem('reportViewer_selectedClassId', String(classId));
    setSelectedStudentId('all');
    localStorage.setItem('reportViewer_selectedStudentId', 'all');
  };

  const handleStudentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const studentId = val === 'all' ? 'all' : Number(val);
    setSelectedStudentId(studentId);
    localStorage.setItem('reportViewer_selectedStudentId', String(studentId));
  };

  const selectedStudentForPanel = useMemo(() => {
    if (!currentUser || currentUser.role === 'Guest') return undefined;

    if (showPanel && selectedStudentId !== 'all') {
      return students.find(s => s.id === selectedStudentId);
    }
    return undefined;
  }, [showPanel, selectedStudentId, students, currentUser]);

  const handleDownloadPdf = async () => {
    if (generatedReports.length === 0) return;
    setIsGeneratingPdf(true);
    setPdfError(null); // Clear any previous errors

    // Give UI time to update
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      // Dynamically import the PDF generator to avoid loading jsPDF on initial load
      // This prevents "Unknown error" crashes on startup if jsPDF fails to initialize
      const { generateReportsPDF } = await import('../../services/pdfGenerator');
      await generateReportsPDF(generatedReports, data);
    } catch (e) {
      console.error("Failed to generate PDF", e);
      setPdfError(e); // Show error modal with detailed information
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-800">Report Cards</h1>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200 flex flex-col gap-4">
          {/* Row 1: Selectors */}
          <div className="flex flex-col md:flex-row gap-4 w-full">
            <div className="w-full md:w-64">
              <label htmlFor="class-select" className="block text-sm font-medium text-gray-700 mb-1">Select Class</label>
              <select
                id="class-select"
                value={selectedClassId}
                onChange={handleClassChange}
                className="w-full p-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                {accessibleClasses.length === 0 ? (
                  <option value="">-- No Classes Available --</option>
                ) : (
                  accessibleClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                )}
              </select>
            </div>

            <div className="w-full md:w-64">
              <label htmlFor="student-select" className="block text-sm font-medium text-gray-700 mb-1">Select Student</label>
              <select
                id="student-select"
                value={selectedStudentId}
                onChange={handleStudentChange}
                disabled={!selectedClassId}
                className="w-full p-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="all">-- All Students --</option>
                {studentsInClass.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {selectedStudentForPanel && selectedClassId && (
        <PerformanceSummaryFetcher student={selectedStudentForPanel}>
          {(summary) => (
            <ReportCustomizationPanel
              student={selectedStudentForPanel}
              performanceSummary={summary}
              onCollapseChange={setIsPanelCollapsed}
              classId={Number(selectedClassId)}
            />
          )}
        </PerformanceSummaryFetcher>
      )}


      {!selectedStudentForPanel && (
        <div className="fixed bottom-6 left-6 z-30 flex items-center bg-white p-2 rounded-full shadow-lg border border-gray-200 space-x-2 opacity-50 hover:opacity-100 transition-opacity duration-300">
          <button
            onClick={() => setZoomLevel(prev => Math.max(0.25, prev - 0.1))}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-600 focus:outline-none"
            title="Zoom Out"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className="text-sm font-medium w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
          <button
            onClick={() => setZoomLevel(prev => Math.min(2, prev + 0.1))}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-600 focus:outline-none"
            title="Zoom In"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      )}

      <div
        ref={scrollContainerRef}
        className="pt-8 overflow-auto pb-8 min-h-[600px] relative"
        onClick={() => showScrollIndicator && setShowScrollIndicator(false)}
        onTouchStart={() => showScrollIndicator && setShowScrollIndicator(false)}
      >
        <div
          style={{
            width: contentSize.width ? contentSize.width * zoomLevel : 'auto',
            height: contentSize.height ? contentSize.height * zoomLevel : 'auto',
          }}
        >
          <div
            ref={reportContainerRef}
            className="flex flex-row gap-12 w-max transition-transform duration-200 ease-in-out origin-top-left"
            style={{
              transform: `scale(${zoomLevel})`,
            }}
          >
            {generatedReports.length > 0 ? (
              generatedReports.map(student => (
                <div key={student.id} className="report-container">
                  <ReportCard student={student} />
                </div>
              ))
            ) : (
              <div className="text-center py-20 bg-white rounded-lg shadow-md border min-w-[800px]">
                <h2 className="text-xl text-gray-500">
                  Please select a class to view reports.
                </h2>
              </div>
            )}
          </div>
        </div>

        {/* Horizontal Scroll Indicator */}
        {showScrollIndicator && (
          <div
            className="fixed right-0 bottom-32 z-10 animate-pulse cursor-pointer"
            onClick={() => setShowScrollIndicator(false)}
            onTouchStart={() => setShowScrollIndicator(false)}
          >
            <div className="bg-blue-600 text-white px-4 py-3 rounded-l-full shadow-lg flex items-center gap-2 hover:bg-blue-700 transition-colors">
              <span className="text-sm font-semibold">Scroll for more →</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 animate-bounce-horizontal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        )}
      </div>
      {SHOW_PDF_DOWNLOAD_BUTTON && generatedReports.length > 0 && (selectedStudentForPanel ? isPanelCollapsed : true) && (
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

      {/* PDF Error Modal */}
      <PdfErrorModal
        error={pdfError}
        isOpen={!!pdfError}
        onClose={() => setPdfError(null)}
      />
    </div>
  );
};

export default ReportViewer;