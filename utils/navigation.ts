import type { Page } from '../types';

export const pagePaths: Record<Page, string> = {
  Dashboard: '/dashboard',
  Students: '/students',
  Subjects: '/subjects',
  'Classes & Teachers': '/classes-and-teachers',
  'Score Entry': '/score-entry',
  'Report Viewer': '/report-viewer',
  'Grading System': '/grading-system',
  'Assessment Types': '/assessment-types',
  'School Setup': '/school-setup',
  ScoreSummary: '/score-summary',
  'Student Progress': '/student-progress',
  'Subject Analysis': '/subject-analysis',
  Settings: '/settings',
  'Firebase Analytics': '/firebase-analytics',
};

export const pageFromPath = (pathname: string): Page => {
  const matchingPage = (Object.keys(pagePaths) as Page[]).find(page => pagePaths[page] === pathname);
  return matchingPage || 'Dashboard';
};
