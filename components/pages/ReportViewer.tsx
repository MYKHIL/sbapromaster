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
import ConfirmationModal from '../ConfirmationModal';
import ReadOnlyWrapper from '../ReadOnlyWrapper';
import { sortClassesByName } from '../../utils/classSort';
import UnsavedChangesModal from '../UnsavedChangesModal';
import { ReportCustomizationPanelHandle } from '../ReportCustomizationPanel';

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
  const { students, classes, subjects, loadScores, loadStudents, isFetching, getReportData, reportData } = data;
  const { currentUser } = useUser();

  // State
  const [selectedClassId, setSelectedClassId] = useState<number | ''>(() => {
    const available = getAvailableClasses(currentUser, classes);
    const saved = localStorage.getItem('reportViewer_selectedClassId');
    const savedId = saved ? Number(saved) : '';
    if (savedId && available.some(c => c.id === savedId)) return savedId;
    return available.length > 0 ? available[0].id : '';
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

  const [isComparisonMode, setIsComparisonMode] = useState(false);
  const [isLocalLoading, setIsLocalLoading] = useState(false);

  // Auto-pop Comments Preference (Persisted)
  const [autoPopComments, setAutoPopComments] = useState<boolean>(() => {
    const saved = localStorage.getItem('reportViewer_autoPopComments');
    return saved === null ? true : saved === 'true';
  });

  // State to handle manual expansion from the button
  const [manualExpandTrigger, setManualExpandTrigger] = useState(0);

  // Unsaved Changes Navigation Guard State
  const customizationPanelRef = useRef<ReportCustomizationPanelHandle>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingNav, setPendingNav] = useState<{
    type: 'student' | 'class' | 'navigate';
    value?: number | 'all' | '';
    direction?: 'prev' | 'next';
  } | null>(null);

  const reportContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [contentSize, setContentSize] = useState({ width: 0, height: 0 });

  // Double-load Prevention Refs
  const lastGeneratedStudentIdsRef = useRef<number[]>([]);
  const lastGeneratedClassIdRef = useRef<number | ''>('');
  const lastGeneratedStudentIdRef = useRef<number | 'all'>('all');
  const lastComparisonModeRef = useRef<boolean>(false);

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
    
    let results = students.filter(s => s.class === selectedClass.name);

    // Apply standardized sort: Gender (Desc) -> Name (Asc)
    results.sort((a, b) => {
        if (a.gender !== b.gender) {
            return b.gender.localeCompare(a.gender);
        }
        return a.name.localeCompare(b.name);
    });

    return results;
  }, [students, classes, selectedClassId]);

  // Compute a content-based unique string for students. 
  // It only changes when student IDs, names, or genders physically change, 
  // preventing redundant hook triggers on simple context reference swaps.
  const studentsInClassKey = useMemo(() => {
    return studentsInClass.map(s => `${s.id}-${s.name}-${s.gender}`).join('|');
  }, [studentsInClass]);

  const accessibleClasses = useMemo(() => {
    const available = getAvailableClasses(currentUser, classes);
    // De-duplicate by class name to prevent redundant entries in the dropdown
    const unique = available.filter((cls, index, self) =>
      index === self.findIndex((t) => (t.name || '').trim() === (cls.name || '').trim())
    );
    return sortClassesByName(unique);
  }, [classes, currentUser]);

  const [isMissingDataModalOpen, setIsMissingDataModalOpen] = useState(false);
  const [isMissingSettingsModalOpen, setIsMissingSettingsModalOpen] = useState(false);
  const [pendingPdfStudents, setPendingPdfStudents] = useState<Student[] | null>(null);
  const [missingSettingsList, setMissingSettingsList] = useState<string[]>([]);

  const missingDataList = useMemo(() => {
    if (!studentsInClass || studentsInClass.length === 0) return [];
    
    const missing: { studentId: number; studentName: string, missingRemarks: string[] }[] = [];
    const requiredFields = ['attendance', 'conduct', 'interest', 'attitude', 'teacherRemark'];
    const fieldLabels: Record<string, string> = {
        attendance: 'Attendance',
        conduct: 'Conduct',
        interest: 'Interest',
        attitude: 'Attitude',
        teacherRemark: 'Teacher Remark'
    };

    studentsInClass.forEach(student => {
        const rData = getReportData(student.id);
        const missingFields: string[] = [];

        if (rData) {
            requiredFields.forEach(field => {
                const val = rData[field as keyof typeof rData];
                if (!val || (typeof val === 'string' && val.trim() === '')) {
                    missingFields.push(fieldLabels[field]);
                }
            });
        } else {
            requiredFields.forEach(field => missingFields.push(fieldLabels[field]));
        }

        if (missingFields.length > 0) {
            missing.push({
                studentId: student.id,
                studentName: student.name,
                missingRemarks: missingFields
            });
        }
    });

    return missing;
  }, [studentsInClass, getReportData, reportData]);

  const jumpToMissingStudent = (studentId: number) => {
    setIsMissingDataModalOpen(false);
    if (customizationPanelRef.current?.hasUnsavedChanges) {
      setPendingNav({ type: 'student', value: studentId });
      setShowConfirmModal(true);
      return;
    }
    setSelectedStudentId(studentId);
    localStorage.setItem('reportViewer_selectedStudentId', String(studentId));
    if (isComparisonMode) {
      setIsComparisonMode(false);
    }
    setShowPanel(true);
    setManualExpandTrigger(0);
  };

  const jumpToNextMissing = () => {
    if (missingDataList.length === 0) return;
    
    let currentIdx = -1;
    if (selectedStudentId !== 'all') {
      currentIdx = missingDataList.findIndex(m => m.studentId === selectedStudentId);
    }
    
    // Cycle to next
    const nextIdx = (currentIdx + 1) % missingDataList.length;
    const nextMissingStudentId = missingDataList[nextIdx].studentId;
    
    jumpToMissingStudent(nextMissingStudentId);
  };

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
    if (isComparisonMode) return;

    if (!selectedClassId) {
        setGeneratedReports([]);
        setShowPanel(false);
        setIsLocalLoading(false);
        return;
    }

    // Set loading and clear current reports to force spinner
    setIsLocalLoading(true);
    setGeneratedReports([]);

    let active = true;

    const timer = setTimeout(() => {
        if (!active) return;
        if (selectedStudentId === 'all') {
            // Progressively render reports in batches to yield execution to the browser.
            // Each batch is followed by a 60ms pause so the browser can paint between cycles.
            // A batch size of 10 provides fast throughput while keeping the UI responsive.
            const batchSize = 10;
            let currentIdx = 0;

            const renderBatch = () => {
                if (!active) return;
                if (currentIdx >= studentsInClass.length) {
                    setIsLocalLoading(false);
                    return;
                }

                setGeneratedReports(prev => {
                    const nextBatch = studentsInClass.slice(0, currentIdx + batchSize);
                    return nextBatch;
                });

                currentIdx += batchSize;
                if (currentIdx < studentsInClass.length) {
                    setTimeout(renderBatch, 60);
                } else {
                    setIsLocalLoading(false);
                }
            };

            renderBatch();
            setShowPanel(false);
        } else {
            const student = studentsInClass.find(s => s.id === selectedStudentId);
            if (student) {
                setGeneratedReports([student]);
                setShowPanel(true);
            } else {
                setGeneratedReports([]);
                setShowPanel(false);
            }
            setIsLocalLoading(false);
        }
    }, 400); // Artificial delay for visual feedback

    return () => {
        active = false;
        clearTimeout(timer);
    };
  }, [selectedStudentId, selectedClassId, studentsInClassKey, isComparisonMode]);

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
    let resizeTimer: ReturnType<typeof setTimeout>;
    const lastDimensions = { width: 0, height: 0 };

    const calculateOptimalZoom = () => {
      const currentWidth = window.innerWidth;
      const currentHeight = window.innerHeight;

      // On mobile, height changes due to the URL bar collapsing/expanding on scroll.
      // We ignore minor height changes to prevent infinite resize loops.
      const widthChanged = currentWidth !== lastDimensions.width;
      const heightChanged = Math.abs(currentHeight - lastDimensions.height) > 100;

      if (!widthChanged && !heightChanged) {
        return;
      }

      lastDimensions.width = currentWidth;
      lastDimensions.height = currentHeight;

      const reportCardWidth = 800;
      const reportCardHeight = 1130;
      const availableWidth = currentWidth - 100;
      const availableHeight = currentHeight - 250;
      const zoomByWidth = availableWidth / reportCardWidth;
      const zoomByHeight = availableHeight / reportCardHeight;
      const finalZoom = Math.max(0.25, Math.min(1, zoomByWidth, zoomByHeight));
      setZoomLevel(finalZoom);
    };

    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(calculateOptimalZoom, 150);
    };

    window.addEventListener('resize', handleResize);
    calculateOptimalZoom();

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, []);

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

  const toggleAutoPop = () => {
    const newVal = !autoPopComments;
    setAutoPopComments(newVal);
    localStorage.setItem('reportViewer_autoPopComments', String(newVal));
  };

  const clearComparison = () => {
    setGeneratedReports([]);
    setSelectedStudentId('all'); // Reset selection
  };

  const removeReport = (studentId: number) => {
    setGeneratedReports(prev => prev.filter(s => s.id !== studentId));
  };

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newClassId = Number(e.target.value) || '';

    if (customizationPanelRef.current?.hasUnsavedChanges) {
      setPendingNav({ type: 'class', value: newClassId });
      setShowConfirmModal(true);
      return;
    }

    setSelectedClassId(newClassId);
    localStorage.setItem('reportViewer_selectedClassId', String(newClassId));

    // In comparison mode, switching class does NOT reset student selection
    if (!isComparisonMode) {
      setSelectedStudentId('all');
      localStorage.setItem('reportViewer_selectedStudentId', 'all');
      setManualExpandTrigger(0);
    }
  };

  const handleStudentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const newStudentId = val === 'all' ? 'all' : Number(val);

    if (customizationPanelRef.current?.hasUnsavedChanges) {
      setPendingNav({ type: 'student', value: newStudentId });
      setShowConfirmModal(true);
      return;
    }

    setSelectedStudentId(newStudentId);
    localStorage.setItem('reportViewer_selectedStudentId', String(newStudentId));

    if (isComparisonMode && newStudentId !== 'all') {
      const studentToAdd = students.find(s => s.id === newStudentId);
      if (studentToAdd) {
        setGeneratedReports(prev => {
          if (prev.some(s => s.id === studentToAdd.id)) return prev;
          return [...prev, studentToAdd];
        });
        setShowPanel(false);
      }
    } else {
      setShowPanel(true);
      setManualExpandTrigger(0);
    }
  };

  const handleNavigateStudent = (direction: 'prev' | 'next') => {
    if (customizationPanelRef.current?.hasUnsavedChanges) {
      setPendingNav({ type: 'navigate', direction });
      setShowConfirmModal(true);
      return;
    }

    if (studentsInClass.length <= 1 || selectedStudentId === 'all') return;
    
    const currentIndex = studentsInClass.findIndex(s => s.id === selectedStudentId);
    if (currentIndex === -1) return;

    let nextIndex;
    if (direction === 'next') {
      nextIndex = (currentIndex + 1) % studentsInClass.length;
    } else {
      nextIndex = (currentIndex - 1 + studentsInClass.length) % studentsInClass.length;
    }

    const nextStudent = studentsInClass[nextIndex];
    setSelectedStudentId(nextStudent.id);
    localStorage.setItem('reportViewer_selectedStudentId', String(nextStudent.id));
    
    // In comparison mode, switching student usually adds them, 
    // but here we are in the panel context (Standard Mode).
    setShowPanel(true);
    setManualExpandTrigger(0);
  };

  const executePendingNav = () => {
    if (!pendingNav) return;

    if (pendingNav.type === 'student') {
        const newStudentId = pendingNav.value as number | 'all';
        setSelectedStudentId(newStudentId);
        localStorage.setItem('reportViewer_selectedStudentId', String(newStudentId));

        if (isComparisonMode && newStudentId !== 'all') {
          const studentToAdd = students.find(s => s.id === newStudentId);
          if (studentToAdd) {
            setGeneratedReports(prev => {
              if (prev.some(s => s.id === studentToAdd.id)) return prev;
              return [...prev, studentToAdd];
            });
            setShowPanel(false);
          }
        } else {
          setShowPanel(true);
          setManualExpandTrigger(0);
        }
    } else if (pendingNav.type === 'class') {
        const newClassId = pendingNav.value as number | '';
        setSelectedClassId(newClassId);
        localStorage.setItem('reportViewer_selectedClassId', String(newClassId));
        if (!isComparisonMode) {
            setSelectedStudentId('all');
            localStorage.setItem('reportViewer_selectedStudentId', 'all');
            setManualExpandTrigger(0);
        }
    } else if (pendingNav.type === 'navigate') {
        const currentIndex = studentsInClass.findIndex(s => s.id === (selectedStudentId as number));
        if (currentIndex !== -1) {
            let nextIndex;
            if (pendingNav.direction === 'next') {
                nextIndex = (currentIndex + 1) % studentsInClass.length;
            } else {
                nextIndex = (currentIndex - 1 + studentsInClass.length) % studentsInClass.length;
            }
            const nextStudent = studentsInClass[nextIndex];
            setSelectedStudentId(nextStudent.id);
            localStorage.setItem('reportViewer_selectedStudentId', String(nextStudent.id));
            setManualExpandTrigger(0);
            setShowPanel(true);
        }
    }
    setPendingNav(null);
    setShowConfirmModal(false);
  };

  const handleModalDiscard = () => {
    executePendingNav();
  };

  const handleModalQueueAndMove = () => {
    customizationPanelRef.current?.handleSave();
    executePendingNav();
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
    // Check for missing global settings before generating PDF
    const missing = [] as string[];
    const s = data.settings;
    if (!s.schoolName) missing.push('School name');
    if (!s.address) missing.push('Address');
    if (!s.academicYear) missing.push('Academic year');
    if (!s.academicTerm) missing.push('Academic term');
    if (!s.district) missing.push('District');
    if (!s.circuit) missing.push('Circuit');
    if (!s.logo) missing.push('School logo');
    if (!s.headmasterName) missing.push("Headmaster's name");
    if (!s.headmasterSignature) missing.push("Headmaster's signature");
    if (!s.vacationDate) missing.push('Vacation date');
    if (!s.reopeningDate) missing.push('Reopening date');

    if (missing.length > 0) {
      setPendingPdfStudents(generatedReports);
      setMissingSettingsList(missing);
      setIsMissingSettingsModalOpen(true);
      return;
    }

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
    // Build full student list
    const allStudentsToPrint: Student[] = [];
    accessibleClasses.forEach(cls => {
      const classStudents = students.filter(s => s.class === cls.name);
      classStudents.sort((a, b) => a.name.localeCompare(b.name));
      allStudentsToPrint.push(...classStudents);
    });
    if (allStudentsToPrint.length === 0) return;

    // Check missing settings
    const missing = [] as string[];
    const s = data.settings;
    if (!s.schoolName) missing.push('School name');
    if (!s.address) missing.push('Address');
    if (!s.academicYear) missing.push('Academic year');
    if (!s.academicTerm) missing.push('Academic term');
    if (!s.district) missing.push('District');
    if (!s.circuit) missing.push('Circuit');
    if (!s.logo) missing.push('School logo');
    if (!s.headmasterName) missing.push("Headmaster's name");
    if (!s.headmasterSignature) missing.push("Headmaster's signature");
    if (!s.vacationDate) missing.push('Vacation date');
    if (!s.reopeningDate) missing.push('Reopening date');

    if (missing.length > 0) {
      setPendingPdfStudents(allStudentsToPrint);
      setMissingSettingsList(missing);
      setIsMissingSettingsModalOpen(true);
      return;
    }

    setIsGeneratingAllPdf(true);
    setPdfError(null);
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      const { generateReportsPDF } = await import('../../services/pdfGenerator');
      await generateReportsPDF(allStudentsToPrint, data);
    } catch (e) {
      console.error("Failed to generate All Classes PDF", e);
      setPdfError(e);
    } finally {
      setIsGeneratingAllPdf(false);
    }
  };

  const confirmMissingSettingsDownload = async (proceed: boolean) => {
    setIsMissingSettingsModalOpen(false);
    if (!proceed) {
      setPendingPdfStudents(null);
      return;
    }
    const studentsToPrint = pendingPdfStudents || [];
    setPendingPdfStudents(null);
    if (studentsToPrint.length === 0) return;
    setIsGeneratingPdf(true);
    setPdfError(null);
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      const { generateReportsPDF } = await import('../../services/pdfGenerator');
      await generateReportsPDF(studentsToPrint, data);
    } catch (e) {
      console.error("Failed to generate PDF", e);
      setPdfError(e);
    } finally {
      setIsGeneratingPdf(false);
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
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="student-select" className="block text-sm font-medium text-gray-700">
                  {isComparisonMode ? "Add Student to View" : "Select Student"}
                </label>
                {missingDataList.length > 0 && selectedClassId && !isComparisonMode && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={jumpToNextMissing}
                      title="Next Incomplete Student"
                      className="text-[10px] p-1 rounded-full bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setIsMissingDataModalOpen(true)}
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700 hover:bg-red-200 hover:text-red-800 transition-colors"
                    >
                      {missingDataList.length} incomplete
                    </button>
                  </div>
                )}
              </div>
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

            {/* Toggles & Manual Button Row */}
            <div className="w-full md:w-auto flex flex-wrap items-center md:items-end gap-x-6 gap-y-4 pb-1">
              {/* Comparison Mode Toggle */}
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

              {/* Auto-pop Comments Toggle & Manual Button - Only shown when a student is selected and NOT in comparison mode */}
              {selectedStudentId !== 'all' && !isComparisonMode && (
                <div className="flex items-center gap-x-6 gap-y-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center cursor-pointer select-none text-sm font-medium text-gray-700">
                      <span className="mr-2 whitespace-nowrap">Auto-show (Mobile)</span>
                      <div className="relative">
                        <input type="checkbox" className="sr-only" checked={autoPopComments} onChange={toggleAutoPop} />
                        <div className={`block w-10 h-6 rounded-full transition-colors ${autoPopComments ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${autoPopComments ? 'transform translate-x-4' : ''}`}></div>
                      </div>
                    </label>
                  </div>

                  {!autoPopComments && (
                    <button
                      onClick={() => setManualExpandTrigger(prev => prev + 1)}
                      className={`
                        lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-300
                        ${isPanelCollapsed ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 border border-blue-200'}
                      `}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                      {isPanelCollapsed ? 'Show Comments' : 'Hide Comments'}
                    </button>
                  )}
                </div>
              )}
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
                ref={customizationPanelRef}
                student={selectedStudentForPanel}
                performanceSummary={summary}
                onCollapseChange={setIsPanelCollapsed}
                classId={Number(selectedClassId)}
                shouldAutoExpand={autoPopComments}
                manualExpandTrigger={manualExpandTrigger}
                onNavigate={handleNavigateStudent}
              />
            </ReadOnlyWrapper>
          )}
        </PerformanceSummaryFetcher>
      )}

      {/* Zoom Controls (Shifted up on mobile to avoid bottom nav interference) */}
      <div className={`fixed left-6 z-30 items-center bg-white p-2 rounded-full shadow-lg border border-gray-200 space-x-2 opacity-50 hover:opacity-100 transition-opacity duration-300 ${selectedStudentForPanel
        ? isPanelCollapsed
          ? 'flex bottom-36 lg:bottom-6'
          : 'hidden lg:flex lg:bottom-6'
        : 'flex bottom-28 lg:bottom-6'
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
            {generatedReports.length > 0 ? (
              generatedReports.map(generatedStudent => {
                // Map to the freshest student context object to support instant updates
                const student = students.find(s => s.id === generatedStudent.id) || generatedStudent;
                return (
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
                );
              })
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
        <div className={`fixed bottom-24 lg:bottom-6 z-20 flex-col items-center gap-4 transition-all duration-300 ${(selectedStudentForPanel && !isPanelCollapsed) ? 'hidden lg:flex' : 'flex'} ${selectedStudentForPanel ? 'lg:right-[31.5rem] right-6' : 'right-6'}`}>
          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf || isFetching || isLocalLoading}
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
              disabled={isGeneratingAllPdf || isGeneratingPdf || isFetching || isLocalLoading}
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

      {/* Unsaved Changes Guard Modal */}
      <UnsavedChangesModal
        isOpen={showConfirmModal}
        onStay={() => setShowConfirmModal(false)}
        onDiscard={handleModalDiscard}
        onQueueAndMove={handleModalQueueAndMove}
      />
      {/* Beautiful Centered Glassmorphism Loading Widget (Ultra-sleek & Minimal) */}
      {(isFetching || isLocalLoading) && !(studentsInClass.length > 0 && generatedReports.length >= studentsInClass.length) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none animate-in fade-in duration-200">
          <div className="bg-white/95 backdrop-blur-md border border-gray-200/80 rounded-2xl shadow-2xl p-3 w-64 flex items-center space-x-3 relative overflow-hidden transition-all duration-300 pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="relative flex-shrink-0 flex items-center justify-center">
              {/* Spinning Loader Ring */}
              <svg className="animate-spin h-9 w-9 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3.5"></circle>
                <path className="opacity-80" fill="currentColor" strokeLinecap="round" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {/* Progress Count / Percentage Center Label */}
              {studentsInClass.length > 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[9px] font-black text-blue-700">
                    {Math.round((generatedReports.length / studentsInClass.length) * 100)}%
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 text-left">
              <h4 className="text-xs font-bold text-gray-800 truncate">Generating Reports</h4>
              <p className="text-[10px] font-semibold text-gray-500 truncate">
                {generatedReports.length > 0 
                  ? `${generatedReports.length} of ${studentsInClass.length} cards`
                  : 'Preparing records...'}
              </p>
            </div>

            {/* Premium Bottom-Edge Integrated Progress Bar */}
            {studentsInClass.length > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gray-100/50 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full transition-all duration-300"
                  style={{ width: `${(generatedReports.length / studentsInClass.length) * 100}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Missing Data Modal */}
      {isMissingDataModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">Incomplete Report Data</h3>
              <button onClick={() => setIsMissingDataModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto custom-scrollbar flex-1 space-y-3">
              <p className="text-sm text-gray-600 mb-2">The following students have missing remarks or attendance data for their report cards:</p>
              {missingDataList.map((entry, idx) => (
                <button
                  key={idx}
                  onClick={() => jumpToMissingStudent(entry.studentId)}
                  className="w-full text-left text-sm text-red-800 flex flex-col bg-red-50 p-2.5 rounded border border-red-100 hover:bg-red-100 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
                >
                  <span className="font-semibold">{entry.studentName}</span>
                  <span className="text-red-500 mt-1 text-[11px] uppercase tracking-wide">
                    Missing: {entry.missingRemarks.join(', ')}
                  </span>
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end">
              <button
                onClick={() => setIsMissingDataModalOpen(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Missing Settings Modal (before PDF download) */}
      <ConfirmationModal
        isOpen={isMissingSettingsModalOpen}
        onClose={() => { setIsMissingSettingsModalOpen(false); setPendingPdfStudents(null); }}
        onConfirm={() => confirmMissingSettingsDownload(true)}
        title="Missing School Settings"
        variant="warning"
        confirmText="Download Anyway"
        cancelText="Cancel"
        additionalActionText={(currentUser?.role === 'Admin') ? 'Open School Setup' : 'Remind Administrator'}
        additionalAction={async () => {
          setIsMissingSettingsModalOpen(false);
            const missing = missingSettingsList.length > 0 ? missingSettingsList : ((): string[] => {
              const s = data.settings;
              const _m: string[] = [];
              if (!s.schoolName) _m.push('School name');
              if (!s.address) _m.push('Address');
              if (!s.academicYear) _m.push('Academic year');
              if (!s.academicTerm) _m.push('Academic term');
              if (!s.district) _m.push('District');
              if (!s.circuit) _m.push('Circuit');
              if (!s.logo) _m.push('School logo');
              if (!s.headmasterName) _m.push("Headmaster's name");
              if (!s.headmasterSignature) _m.push("Headmaster's signature");
              if (!s.vacationDate) _m.push('Vacation date');
              if (!s.reopeningDate) _m.push('Reopening date');
              return _m;
            })();
            const message = `The following school settings are missing: ${missing.join(', ')}.`;
            if (currentUser?.role === 'Admin') {
            try { window.dispatchEvent(new CustomEvent('app-navigate', { detail: { page: 'School Setup' } })); } catch { }
          } else {
            try {
              await navigator.clipboard.writeText(message + ' Please update these settings.');
              alert('Reminder copied to clipboard. Please send it to your administrator.');
            } catch {
              alert('Please contact your administrator to update school settings.');
            }
          }
        }}
        message={
          <div>
            <p className="mb-2">The generated report cards may be incomplete because some required school settings are missing:</p>
              <ul className="list-disc pl-5">
                {missingSettingsList.length > 0 ? (
                  missingSettingsList.map((m, i) => <li key={i}>{m}</li>)
                ) : (
                  // Fallback: compute on the fly
                  (() => {
                    const s = data.settings;
                    const fallback: string[] = [];
                    if (!s.schoolName) fallback.push('School name');
                    if (!s.address) fallback.push('Address');
                    if (!s.academicYear) fallback.push('Academic year');
                    if (!s.academicTerm) fallback.push('Academic term');
                    if (!s.district) fallback.push('District');
                    if (!s.circuit) fallback.push('Circuit');
                    if (!s.logo) fallback.push('School logo');
                    if (!s.headmasterName) fallback.push("Headmaster's name");
                    if (!s.headmasterSignature) fallback.push("Headmaster's signature");
                    if (!s.vacationDate) fallback.push('Vacation date');
                    if (!s.reopeningDate) fallback.push('Reopening date');
                    return fallback.map((m, i) => <li key={i}>{m}</li>);
                  })()
                )}
              </ul>
            {currentUser?.role === 'Admin' ? (
              <p className="mt-2 text-sm text-gray-600">You are an administrator — you can open the School Setup page to update these values now.</p>
            ) : (
              <p className="mt-2 text-sm text-gray-600">Please remind your administrator to update these settings, or choose "Download Anyway" to continue.</p>
            )}
          </div>
        }
      />
    </div>
  );
};

export default ReportViewer;
