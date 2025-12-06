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
import { DataProvider } from './context/DataContext';
import type { Page } from './types';

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
        case 'Report Viewer': return <ReportViewer />;
        // Data Management is handled separately to preserve its state
        default: return null;
    }
};

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('Dashboard');

  return (
    <DataProvider>
      <div className="flex h-screen bg-gray-50 font-sans text-gray-800">
        <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
        <main className="flex-1 p-4 md:p-6 lg:p-10 overflow-auto">
          {/* Data Management is always rendered but its visibility is toggled to preserve state. */}
          <PageWrapper name="Data Management" currentPage={currentPage}>
            <DataManagement />
          </PageWrapper>

          {/* All other pages are rendered conditionally, causing them to remount on navigation. */}
          {currentPage !== 'Data Management' && <ActivePage page={currentPage} />}
        </main>
      </div>
    </DataProvider>
  );
};

export default App;