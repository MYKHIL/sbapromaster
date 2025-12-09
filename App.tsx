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
import { DataProvider } from './context/DataContext';
import { UserProvider, useUser } from './context/UserContext';
import type { Page } from './types';
import UserBadge from './components/UserBadge';
import MaintenancePage from './components/MaintenancePage';
import { TeacherPageRedirect } from './components/TeacherPageRedirect';
import { SyncOverlayConnected } from './components/SyncOverlayConnected';
import { SITE_ACTIVE } from './constants';
import GreetingToast from './components/GreetingToast';

// This helper is now only used for pages that need to persist state.
const PageWrapper: React.FC<{ name: Page; currentPage: Page; children: React.ReactNode }> = ({ name, currentPage, children }) => {
  return (
    <div style={{ display: name === currentPage ? 'block' : 'none' }} className="h-full">
      {children}
    </div>
  );
};

// Renders the currently active page, causing it to remount on change.
const ActivePage: React.FC<{ page: Page }> = ({ page }) => {
  switch (page) {
    case 'Dashboard': return <Dashboard />;
    case 'School Setup': return <Settings />;
    case 'Teachers': return <Teachers />;
    case 'Subjects': return <Subjects />;
    case 'Students': return <Students />;
    case 'Grading System': return <GradingSystem />;
    case 'Assessment Types': return <AssessmentTypes />;
    case 'Score Entry': return <ScoreEntry />;
    case 'Score Summary': return <ScoreSummary />;
    case 'Report Viewer': return <ReportViewer />;
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

const App: React.FC = () => {
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

  // Persist current page to localStorage whenever it changes
  React.useEffect(() => {
    localStorage.setItem('lastVisitedPage', currentPage);
  }, [currentPage]);

  // Show maintenance page if site is not active
  if (!SITE_ACTIVE) {
    return <MaintenancePage />;
  }

  return (
    <DataProvider>
      <UserProvider>
        <AuthOverlay>
          <SyncOverlayConnected />
          <GreetingWrapper currentPage={currentPage} />
          <TeacherPageRedirect currentPage={currentPage} setCurrentPage={setCurrentPage} />
          <UserBadge />
          <div className="flex h-screen overflow-hidden bg-gray-50">
            <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
            <main className="flex-1 p-4 pt-20 md:p-6 md:pt-20 lg:p-10 overflow-auto">
              {/* Data Management is always rendered but its visibility is toggled to preserve state. */}
              <PageWrapper name="Data Management" currentPage={currentPage}>
                <DataManagement />
              </PageWrapper>

              {/* All other pages are rendered conditionally, causing them to remount on navigation. */}
              {currentPage !== 'Data Management' && <ActivePage page={currentPage} />}
            </main>
          </div>
        </AuthOverlay>
      </UserProvider>
    </DataProvider>
  );
};

export default App;