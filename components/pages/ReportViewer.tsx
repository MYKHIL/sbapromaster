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
import ReadOnlyWrapper from '../ReadOnlyWrapper';
import { sortClassesByName } from '../../utils/classSort';

const PerformanceSummaryFetcher: React.FC<{ student: Student, children: (summary: string) => React.ReactNode }> = ({ student, children }) => {
  const { performanceSummary } = useReportCardData(student);
  return <>{children(performanceSummary)}</>;
}

// ... imports remain the same

// 1. Remove `showScrollIndicator` state
// 2. Add `isComparisonMode` state
// 3. Update logic for `generatedReports`

const ReportViewer: React.FC = () => {
  const data = useData();
  const { students, classes, subjects, loadScores, loadStudents, isFetching } = data;
  const { currentUser } = useUser();

  // State
  const [selectedClassId, setSelectedClassId] = useState<number | ''>(() => {
    const saved = localStorage.getItem('reportViewer_selectedClassId');
    return saved ? Number(saved) : '';
  });

  const [selectedStudentId, setSelectedStudentId] = useState<number | 'all'>(() => {
    const saved = localStorage.getItem('reportViewer_selectedStudentId');
    if (saved === 'all') return 'all';
    return saved ? Number(saved) : 'all';
  });

  const [generatedReports, setGeneratedReports] = useState<Student[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingAllPdf, setIsGeneratingAllPdf] = useState(false);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(true);
  const [pdfError, setPdfError] = useState<any>(null);

  // New: Comparison Mode
  const [isComparisonMode, setIsComparisonMode] = useState(false);

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

  // Removed Scroll Indicator Logic

  const studentsInClass = useMemo(() => {
    if (!selectedClassId) return [];
    const selectedClass = classes.find(c => c.id === selectedClassId);
    if (!selectedClass) return [];
    return students.filter(s => s.class === selectedClass.name);
  }, [students, classes, selectedClassId]);

  const accessibleClasses = useMemo(() => {
    const available = getAvailableClasses(currentUser, classes);
    // De-duplicate by class name to prevent redundant entries in the dropdown
    const unique = available.filter((cls, index, self) =>
      index === self.findIndex((t) => t.name.trim() === cls.name.trim())
    );
    return sortClassesByName(unique);
  }, [classes, currentUser]);

  // Auto-select Class
  useEffect(() => {
    if (accessibleClasses.length === 0) return;
    const isSelectedAccessible = selectedClassId && accessibleClasses.some(c => c.id === selectedClassId);
    if (!selectedClassId || !isSelectedAccessible) {
      setSelectedClassId(accessibleClasses[0].id);
    }
  }, [accessibleClasses, selectedClassId]);

  // Main Report Generation Logic
  useEffect(() => {
    // If in comparison mode, we DO NOT auto-generate or clear reports based on selection change
    // UNLESS it's the specific action of adding a student (handled in handler).
    // Actually, to keep it simple:

    if (isComparisonMode) return;

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
  }, [selectedStudentId, selectedClassId, studentsInClass, students, isComparisonMode]);

  // Lazy Load Students
  useEffect(() => { loadStudents(); }, [loadStudents]);

  // Lazy Load Scores
  useEffect(() => {
    if (selectedClassId && subjects.length > 0) {
      // Even in comparison mode, if user changes class, we fetch scores for that class
      // so they are available for any students added from that class.
      subjects.forEach(subject => {
        loadScores(selectedClassId as number, subject.id);
      });
    }
  }, [selectedClassId, subjects, loadScores]);

  // Zoom Logic
  useEffect(() => {
    const calculateOptimalZoom = () => {
      const reportCardWidth = 800;
      const reportCardHeight = 1130;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const availableWidth = viewportWidth - 100;
      const availableHeight = viewportHeight - 250;
      const zoomByWidth = availableWidth / reportCardWidth;
      const zoomByHeight = availableHeight / reportCardHeight;
      const finalZoom = Math.max(0.25, Math.min(1, zoomByWidth, zoomByHeight));
      setZoomLevel(finalZoom);
    };
    window.addEventListener('resize', calculateOptimalZoom);
    calculateOptimalZoom();
    return () => window.removeEventListener('resize', calculateOptimalZoom);
  }, []);

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const classId = e.target.value ? Number(e.target.value) : '';
    setSelectedClassId(classId);
    localStorage.setItem('reportViewer_selectedClassId', String(classId));

    // In comparison mode, switching class does NOT reset student selection
    if (!isComparisonMode) {
      setSelectedStudentId('all');
      localStorage.setItem('reportViewer_selectedStudentId', 'all');
    }
  };

  const handleStudentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const newStudentId = val === 'all' ? 'all' : Number(val);

    setSelectedStudentId(newStudentId);
    localStorage.setItem('reportViewer_selectedStudentId', String(newStudentId));

    if (isComparisonMode && newStudentId !== 'all') {
      // Add to comparison list if not already there
      const studentToAdd = students.find(s => s.id === newStudentId);
      if (studentToAdd) {
        setGeneratedReports(prev => {
          if (prev.some(s => s.id === studentToAdd.id)) return prev;
          return [...prev, studentToAdd];
        });
        // In comparison mode, we do NOT show the customization panel automatically.
        setShowPanel(false);
      }
    } else {
      // Standard Mode: Show panel when a student is selected
      setShowPanel(true);
    }
  };

  const toggleComparisonMode = () => {
    setIsComparisonMode(prev => {
      const newState = !prev;
      if (newState) {
        // Entering comparison mode: Clear existing selection to start fresh
        // This allows user to build their comparison list from scratch
        setGeneratedReports([]);
        setSelectedStudentId('all');
        setShowPanel(false);
      } else {
        // Exiting comparison mode: Reset
        setGeneratedReports([]);
        setSelectedStudentId('all');
        setShowPanel(false);
      }
      return newState;
    });
  };

  const clearComparison = () => {
    setGeneratedReports([]);
    setSelectedStudentId('all'); // Reset selection
  };

  const removeReport = (studentId: number) => {
    setGeneratedReports(prev => prev.filter(s => s.id !== studentId));
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
    setPdfError(null);
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      const { generateReportsPDF } = await import('../../services/pdfGenerator');
      await generateReportsPDF(generatedReports, data);
    } catch (e) {
      console.error("Failed to generate PDF", e);
      setPdfError(e);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadAllPdf = async () => {
    if (accessibleClasses.length <= 1) return;
    setIsGeneratingAllPdf(true);
    setPdfError(null);
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      const { generateReportsPDF } = await import('../../services/pdfGenerator');
      const allStudentsToPrint: Student[] = [];
      accessibleClasses.forEach(cls => {
        const classStudents = students.filter(s => s.class === cls.name);
        classStudents.sort((a, b) => a.name.localeCompare(b.name));
        allStudentsToPrint.push(...classStudents);
      });
      if (allStudentsToPrint.length === 0) return;
      await generateReportsPDF(allStudentsToPrint, data);
    } catch (e) {
      console.error("Failed to generate All Classes PDF", e);
      setPdfError(e);
    } finally {
      setIsGeneratingAllPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-800">Report Cards</h1>

        </div>

        <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200 flex flex-col gap-4">
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
              <label htmlFor="student-select" className="block text-sm font-medium text-gray-700 mb-1">
                {isComparisonMode ? "Add Student to View" : "Select Student"}
              </label>
              <select
                id="student-select"
                value={selectedStudentId}
                onChange={handleStudentChange}
                disabled={!selectedClassId}
                className="w-full p-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="all">-- {isComparisonMode ? "Select to Add..." : "All Students"} --</option>
                {studentsInClass.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Comparison Mode Toggle - Relocated */}
            <div className="w-full md:w-auto flex items-center md:items-end pb-1">
              <div className="flex items-center gap-2">
                <label className="flex items-center cursor-pointer select-none text-sm font-medium text-gray-700">
                  <span className="mr-2">Comparison Mode</span>
                  <div className="relative">
                    <input type="checkbox" className="sr-only" checked={isComparisonMode} onChange={toggleComparisonMode} />
                    <div className={`block w-10 h-6 rounded-full transition-colors ${isComparisonMode ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isComparisonMode ? 'transform translate-x-4' : ''}`}></div>
                  </div>
                </label>
                {isComparisonMode && (
                  <button onClick={clearComparison} className="text-xs text-red-600 hover:underline">
                    Clear All
                  </button>
                )}
              </div>
            </div>
          </div>
          {isComparisonMode && (
            <div className="text-xs text-blue-600 italic">
              Comparison Mode Active: Select students from any class to compare them side-by-side.
            </div>
          )}
        </div>
      </div>

      {selectedStudentForPanel && selectedClassId && (
        <PerformanceSummaryFetcher student={selectedStudentForPanel}>
          {(summary) => (
            <ReadOnlyWrapper allowedRoles={['Admin', 'Teacher']}>
              <ReportCustomizationPanel
                student={selectedStudentForPanel}
                performanceSummary={summary}
                onCollapseChange={setIsPanelCollapsed}
                classId={Number(selectedClassId)}
              />
            </ReadOnlyWrapper>
          )}
        </PerformanceSummaryFetcher>
      )}

      {/* Zoom Controls (Unchanged) */}
      <div className={`fixed left-6 z-30 items-center bg-white p-2 rounded-full shadow-lg border border-gray-200 space-x-2 opacity-50 hover:opacity-100 transition-opacity duration-300 ${selectedStudentForPanel
        ? isPanelCollapsed
          ? 'flex bottom-24 lg:bottom-6'
          : 'hidden lg:flex lg:bottom-6'
        : 'flex bottom-6'
        }`}>
        <button onClick={() => setZoomLevel(prev => Math.max(0.25, prev - 0.1))} className="p-2 hover:bg-gray-100 rounded-full text-gray-600 focus:outline-none" title="Zoom Out">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <span className="text-sm font-medium w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
        <button onClick={() => setZoomLevel(prev => Math.min(2, prev + 0.1))} className="p-2 hover:bg-gray-100 rounded-full text-gray-600 focus:outline-none" title="Zoom In">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <div
        ref={scrollContainerRef}
        className="pt-8 overflow-auto pb-8 min-h-[600px] relative"
      >
        <div style={{ width: contentSize.width ? contentSize.width * zoomLevel : 'auto', height: contentSize.height ? contentSize.height * zoomLevel : 'auto' }}>
          <div
            ref={reportContainerRef}
            className="flex flex-row gap-12 w-max transition-transform duration-200 ease-in-out origin-top-left"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            {isFetching ? (
              <div className="flex flex-col items-center justify-center min-w-[800px] min-h-[600px] bg-white rounded-lg shadow-sm border border-gray-100">
                <svg className="animate-spin h-16 w-16 text-blue-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <h3 className="text-xl font-semibold text-gray-800">Generating Reports...</h3>
                <p className="text-gray-500 mt-2">Fetching specialized data records</p>
              </div>
            ) : generatedReports.length > 0 ? (
              generatedReports.map(student => (
                <div key={student.id} className="report-container relative group">
                  <ReportCard student={student} />
                  {isComparisonMode && (
                    <button
                      onClick={() => removeReport(student.id)}
                      className="absolute -top-4 -right-4 bg-red-500 text-white rounded-full p-2 shadow-lg hover:bg-red-600 transition-colors z-50 opacity-0 group-hover:opacity-100"
                      title="Remove from comparison"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-20 bg-white rounded-lg shadow-md border min-w-[800px]">
                <h2 className="text-xl text-gray-500">
                  {isComparisonMode ? "Select students to begin comparison." : "Please select a class to view reports."}
                </h2>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PDF Buttons remain unchanged */}
      {SHOW_PDF_DOWNLOAD_BUTTON && generatedReports.length > 0 && (
        <div className={`fixed bottom-6 z-20 flex-col items-center gap-4 transition-all duration-300 ${(selectedStudentForPanel && !isPanelCollapsed) ? 'hidden lg:flex' : 'flex'} ${selectedStudentForPanel ? 'lg:right-[27rem] right-6' : 'right-6'}`}>
          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="flex items-center bg-green-600 text-white px-5 py-3 rounded-full shadow-lg hover:bg-green-700 transition-all duration-300 transform hover:scale-110 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:scale-100"
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

          {accessibleClasses.length > 1 && (
            <button
              onClick={handleDownloadAllPdf}
              disabled={isGeneratingAllPdf || isGeneratingPdf}
              className="flex items-center bg-blue-600 text-white px-5 py-3 rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:scale-100"
              title="Download reports for all your available classes"
            >
              {isGeneratingAllPdf ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  <span>Generating All...</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                  <span className="ml-2 font-semibold hidden sm:inline">Download Reports from All {accessibleClasses.length} Classes</span>
                </>
              )}
            </button>
          )}
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
