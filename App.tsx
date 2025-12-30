import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/pages/Dashboard';
import ScoreEntry from './components/pages/ScoreEntry';
import ReportViewer from './components/pages/ReportViewer';
import Settings from './components/pages/Settings';
import Students from './components/pages/Students';
import Subjects from './components/pages/Subjects';
import Teachers from './components/pages/Teachers';
import GradingSystem from './components/pages/GradingSystem';
import AssessmentTypes from './components/pages/AssessmentTypes';
import DataManagement from './components/pages/DataManagement';
import ScoreSummary from './components/pages/ScoreSummary';
import StudentProgress from './components/pages/StudentProgress';
import FirebaseAnalytics from './components/pages/FirebaseAnalytics';
import { DataProvider, useData } from './context/DataContext';
import { UserProvider, useUser } from './context/UserContext';
import { DatabaseErrorProvider, useDatabaseError } from './context/DatabaseErrorContext';
import { FirebaseAnalyticsProvider } from './context/FirebaseAnalyticsContext';
import type { Page } from './types';
import GlobalActionBar from './components/GlobalActionBar';
import UserBadge from './components/UserBadge';
import MaintenancePage from './components/MaintenancePage';
import { TeacherPageRedirect } from './components/TeacherPageRedirect';
import { SyncOverlayConnected } from './components/SyncOverlayConnected';
import { SITE_ACTIVE } from './constants';
import GreetingToast from './components/GreetingToast';
import DatabaseErrorModal from './components/DatabaseErrorModal';


// This helper is now only used for pages that need to persist state.
const PageWrapper: React.FC<{ name: Page; currentPage: Page; children: React.ReactNode }> = ({ name, currentPage, children }) => {
  return (
    <div style={{ display: name === currentPage ? 'block' : 'none' }} className="h-full">
      {children}
    </div>
  );
};

// Renders the currently active page, causing it to remount on change.
const ActivePage: React.FC<{ page: Page; onNavigate: (page: Page) => void }> = ({ page, onNavigate }) => {
  // Data loading is now handled centrally in DataContext (fetchInitialData)
  // This ensures "Load Once" behavior.

  switch (page) {
    case 'Dashboard': return <Dashboard onNavigate={onNavigate} />;
    case 'School Setup': return <Settings />;
    case 'Teachers': return <Teachers />;
    case 'Subjects': return <Subjects />;
    case 'Students': return <Students />;
    case 'Grading System': return <GradingSystem />;
    case 'Assessment Types': return <AssessmentTypes />;
    case 'Score Entry': return <ScoreEntry />;
    case 'Score Summary': return <ScoreSummary />;
    case 'Student Progress': return <StudentProgress />;
    case 'Report Viewer': return <ReportViewer />;
    case 'Firebase Analytics': return <FirebaseAnalytics />;
    // Data Management is handled separately to preserve its state
    default: return null;
  }
};

import AuthOverlay from './components/AuthOverlay';

// Wrapper to consume context for GreetingToast
const GreetingWrapper: React.FC<{ currentPage: Page }> = ({ currentPage }) => {
  const { currentUser } = useUser();
  return <GreetingToast currentUser={currentUser} currentPage={currentPage} />;
};

// Wrapper to consume context for DatabaseErrorModal
const DatabaseErrorModalWrapper: React.FC = () => {
  const { error, clearError } = useDatabaseError();
  return <DatabaseErrorModal error={error} onClose={clearError} isOpen={!!error} />;
};

import ConfirmationModal from './components/ConfirmationModal';

// Main App Content component that can consume context
const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    // Try to load last visited page from localStorage
    try {
      const savedPage = localStorage.getItem('lastVisitedPage');
      if (savedPage) {
        return savedPage as Page;
      }
    } catch (e) {
      console.error('Failed to load last visited page:', e);
    }
    // Default to Dashboard if no saved page
    return 'Dashboard';
  });

  const { hasLocalChanges, isPageDirty } = useData();

  // Navigation Guard State
  const [pendingPage, setPendingPage] = useState<Page | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Navigation handler with unsaved changes check
  const handleNavigate = React.useCallback((page: Page) => {
    if (page === currentPage) return;

    // Granular Per-Page Check: Only prompt if the CURRENT page has unsaved changes
    if (isPageDirty(currentPage)) {
      setPendingPage(page);
      setShowConfirmModal(true);
      return;
    }

    setCurrentPage(page);
  }, [currentPage, isPageDirty]);

  const confirmNavigation = () => {
    if (pendingPage) {
      setCurrentPage(pendingPage);
    }
    setShowConfirmModal(false);
    setPendingPage(null);
  };

  const cancelNavigation = () => {
    setShowConfirmModal(false);
    setPendingPage(null);
  };

  // Handle browser refresh/close (Global Safety)
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Browser alert should still trigger for ANY local change to prevent data loss
      if (hasLocalChanges) {
        e.preventDefault();
        e.returnValue = ''; // Required for some browsers
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasLocalChanges]);

  // Persist current page to localStorage whenever it changes
  React.useEffect(() => {
    localStorage.setItem('lastVisitedPage', currentPage);
  }, [currentPage]);

  // Show maintenance page if site is not active
  if (!SITE_ACTIVE) {
    return <MaintenancePage />;
  }

  return (
    <AuthOverlay>
      <SyncOverlayConnected />
      <DatabaseErrorModalWrapper />
      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={cancelNavigation}
        onConfirm={confirmNavigation}
        title="Unsaved Changes"
        variant="warning"
        message={
          <span>
            You have unsaved changes on the <strong>{currentPage}</strong> page.
            Are you sure you want to leave without saving? Your changes will be lost.
          </span>
        }
        confirmText="Leave Page"
        cancelText="Stay Here"
      />
      {/* PageVisitLogger removed to prevent excessive logging */}
      <GreetingWrapper currentPage={currentPage} />
      <TeacherPageRedirect currentPage={currentPage} setCurrentPage={handleNavigate} />
      <div className="fixed top-2 lg:top-4 right-2 lg:right-4 z-[60] flex flex-col items-end gap-1.5 pointer-events-none transition-all duration-300">
        {/* Pointer events needs to be auto for children so they are clickable */}
        <div className="pointer-events-auto">
          <UserBadge />
        </div>
        <div className="pointer-events-auto">
          <GlobalActionBar currentPage={currentPage} onNavigate={handleNavigate} />
        </div>
      </div>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar currentPage={currentPage} setCurrentPage={handleNavigate} />
        <main className="flex-1 p-4 pt-20 md:p-6 md:pt-20 lg:p-10 overflow-auto">
          {/* Data Management is always rendered but its visibility is toggled to preserve state. */}
          <PageWrapper name="Data Management" currentPage={currentPage}>
            <DataManagement />
          </PageWrapper>

          {/* All other pages are rendered conditionally, causing them to remount on navigation. */}
          {currentPage !== 'Data Management' && <ActivePage page={currentPage} onNavigate={handleNavigate} />}
        </main>
      </div>
    </AuthOverlay>
  );
};

const App: React.FC = () => {
  return (
    <DatabaseErrorProvider>
      <DataProvider>
        <UserProvider>
          <FirebaseAnalyticsProvider>
            <AppContent />
          </FirebaseAnalyticsProvider>
        </UserProvider>
      </DataProvider>
    </DatabaseErrorProvider>
  );
};

export default App;