import React, { useState } from 'react';
import BottomNavigation from './components/BottomNavigation';
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
import SubjectAnalysis from './components/pages/SubjectAnalysis';
import { DataProvider, useData } from './context/DataContext';
import { UserProvider, useUser } from './context/UserContext';
import { DatabaseErrorProvider, useDatabaseError } from './context/DatabaseErrorContext';
import { FirebaseAnalyticsProvider } from './context/FirebaseAnalyticsContext';
import { UserActionProvider, useUserAction } from './context/UserActionContext';
import type { Page, NavigationMeta } from './types';
import GlobalActionBar from './components/GlobalActionBar';
import UserBadge from './components/UserBadge';
import MaintenancePage from './components/MaintenancePage';
import { TeacherPageRedirect } from './components/TeacherPageRedirect';
import { SyncOverlayConnected } from './components/SyncOverlayConnected';
import { SITE_ACTIVE } from './constants';
import GreetingToast from './components/GreetingToast';
import DatabaseErrorModal from './components/DatabaseErrorModal';
import QuotaExceededBar from './components/QuotaExceededBar';
import { isQuotaExhaustedError } from './utils/databaseErrorHandler';
import AuthOverlay from './components/AuthOverlay';
import FreshLoginModal from './components/FreshLoginModal';
import TutorialOverlay from './components/TutorialOverlay';
import { HelpCircle } from 'lucide-react';

const PageWrapper: React.FC<{ name: Page; currentPage: Page; children: React.ReactNode }> = ({ name, currentPage, children }) => {
  return (
    <div style={{ display: name === currentPage ? 'block' : 'none' }} className="h-full">
      {children}
    </div>
  );
};

const ActivePage: React.FC<{
  page: Page;
  onNavigate: (page: Page, meta?: NavigationMeta) => void;
  navigationMeta: NavigationMeta | null
}> = ({ page, onNavigate, navigationMeta }) => {
  switch (page) {
    case 'Dashboard': return <Dashboard onNavigate={onNavigate} />;
    case 'School Setup': return <Settings />;
    case 'Classes & Teachers': return <Teachers onNavigate={onNavigate} navigationMeta={navigationMeta} />;
    case 'Subjects': return <Subjects />;
    case 'Students': return <Students onNavigate={onNavigate} />;
    case 'Grading System': return <GradingSystem />;
    case 'Assessment Types': return <AssessmentTypes />;
    case 'Score Entry': return <ScoreEntry onNavigate={onNavigate} />;
    case 'Score Summary': return <ScoreSummary />;
    case 'Student Progress': return <StudentProgress />;
    case 'Subject Analysis': return <SubjectAnalysis />;
    case 'Report Viewer': return <ReportViewer />;
    case 'Firebase Analytics': return <FirebaseAnalytics />;
    default: return null;
  }
};

const GreetingWrapper: React.FC<{ currentPage: Page }> = ({ currentPage }) => {
  const { currentUser } = useUser();
  return <GreetingToast currentUser={currentUser} currentPage={currentPage} />;
};

const FreshLoginModalWrapper: React.FC = () => {
  const { currentUser } = useUser();
  return <FreshLoginModal currentUser={currentUser} />;
};

const DatabaseErrorModalWrapper: React.FC = () => {
  const { error, errorContext, showError, clearError } = useDatabaseError();
  const isQuota = isQuotaExhaustedError(error);
  const showToast = isQuota && errorContext === 'write';
  const showModal = !!error && !showToast;

  React.useEffect(() => {
    const handleQuotaEvent = (event: CustomEvent) => {
      showError(event.detail, 'write');
    };
    window.addEventListener('firebase-quota-exceeded' as any, handleQuotaEvent);
    return () => window.removeEventListener('firebase-quota-exceeded' as any, handleQuotaEvent);
  }, [showError]);

  return (
    <>
      <DatabaseErrorModal error={error} onClose={clearError} isOpen={showModal} />
      {showToast && <QuotaExceededBar onClose={clearError} />}
    </>
  );
};

import ConfirmationModal from './components/ConfirmationModal';

const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    try {
      let savedPage = localStorage.getItem('lastVisitedPage');
      if (savedPage) {
        if (savedPage === 'Teachers') savedPage = 'Classes & Teachers';
        return savedPage as Page;
      }
    } catch (e) {}
    return 'Dashboard';
  });

  const { hasLocalChanges } = useData();
  const { isAuthenticated } = useUser();
  const [navigationMeta, setNavigationMeta] = useState<NavigationMeta | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const { recordAction } = useUserAction();

  React.useEffect(() => {
    recordAction(`App started on ${currentPage} page`);
  }, [recordAction]);

  const handleNavigate = React.useCallback((page: Page, meta?: NavigationMeta) => {
    if (page === currentPage && !meta) return;
    setNavigationMeta(meta || null);
    setCurrentPage(page);
    recordAction(`Navigated to ${page}${meta ? ` (${JSON.stringify(meta)})` : ''}`);
  }, [currentPage, recordAction]);

  // Listen for global navigation events from components that don't receive onNavigate
  React.useEffect(() => {
    const handler = (e: any) => {
      const detail = e.detail as { page: Page; meta?: NavigationMeta };
      if (detail?.page) handleNavigate(detail.page, detail.meta);
    };
    window.addEventListener('app-navigate' as any, handler as any);
    return () => window.removeEventListener('app-navigate' as any, handler as any);
  }, [handleNavigate]);

  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasLocalChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasLocalChanges]);

  React.useEffect(() => {
    localStorage.setItem('lastVisitedPage', currentPage);
  }, [currentPage]);

  if (!SITE_ACTIVE) {
    return <MaintenancePage />;
  }

  return (
    <>
      <AuthOverlay>
        <SyncOverlayConnected />
        <DatabaseErrorModalWrapper />
        <ConfirmationModal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={() => setShowConfirmModal(false)}
          title="Unsaved Changes"
          variant="warning"
          message={<span>Unsaved changes detected.</span>}
        />
        <FreshLoginModalWrapper />
        <GreetingWrapper currentPage={currentPage} />
        <TeacherPageRedirect currentPage={currentPage} setCurrentPage={handleNavigate} />
        <div className="fixed top-2 lg:top-4 right-2 lg:right-4 z-[60] flex flex-col items-end gap-1.5 pointer-events-none transition-all duration-300">
          <div className="pointer-events-auto">{!isTutorialOpen && <UserBadge onOpenTutorial={() => setIsTutorialOpen(true)} />}</div>
          <div className="pointer-events-auto"><GlobalActionBar currentPage={currentPage} onNavigate={handleNavigate} /></div>
        </div>

        <BottomNavigation currentPage={currentPage} onNavigate={handleNavigate} />

        <div className="flex h-screen overflow-hidden bg-gray-50">
          <Sidebar currentPage={currentPage} setCurrentPage={handleNavigate} />
          <main className="flex-1 p-4 pt-20 pb-36 md:p-6 md:pt-20 md:pb-32 lg:p-10 overflow-auto">
            <PageWrapper name="Settings" currentPage={currentPage}>
              <DataManagement navigationMeta={navigationMeta} />
            </PageWrapper>
            {currentPage !== 'Settings' && <ActivePage page={currentPage} onNavigate={handleNavigate} navigationMeta={navigationMeta} />}
          </main>
        </div>
      </AuthOverlay>

      {/* Floating Help Button - Visible on Welcome/Login, Hidden when Logged In or during tutorial */}
      {!isAuthenticated && !isTutorialOpen && (
        <button
          onClick={() => {
            setIsTutorialOpen(true);
            recordAction('Opened User Tutorial');
          }}
          className="fixed bottom-24 right-4 lg:bottom-8 lg:right-8 z-[1001] w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-indigo-700 hover:scale-110 active:scale-95 transition-all duration-300 group overflow-hidden border-4 border-white"
          title="App Tutorial"
        >
          <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
          <HelpCircle size={32} className="relative z-10" />
        </button>
      )}

      {/* Tutorial Overlay - Moved Outside AuthOverlay */}
      <TutorialOverlay isOpen={isTutorialOpen} onClose={() => setIsTutorialOpen(false)} />
    </>
  );
};

const App: React.FC = () => {
  React.useEffect(() => {
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      const errorString = args.map(a => String(a)).join(' ');
      if (errorString.includes('resource-exhausted') || errorString.includes('Quota exceeded')) {
        window.dispatchEvent(new CustomEvent('firebase-quota-exceeded', {
          detail: { code: 'resource-exhausted', message: 'Daily quota exceeded' }
        }));
      }
      originalConsoleError.apply(console, args);
    };
    return () => { console.error = originalConsoleError; };
  }, []);

  return (
    <UserActionProvider>
      <DatabaseErrorProvider>
        <DataProvider>
          <UserProvider>
            <FirebaseAnalyticsProvider>
              <AppContent />
            </FirebaseAnalyticsProvider>
          </UserProvider>
        </DataProvider>
      </DatabaseErrorProvider>
    </UserActionProvider>
  );
};

export default App;