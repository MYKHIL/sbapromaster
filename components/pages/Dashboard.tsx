import React from 'react';
import { useData } from '../../context/DataContext';

import { useUser } from '../../context/UserContext';
import { Page, Notification } from '../../types';

// FIX: Replaced `JSX.Element` with `React.ReactElement` to resolve namespace issue.
const StatCard: React.FC<{ title: string; value: number | string; icon: React.ReactElement }> = ({ title, value, icon }) => (
  <div className="bg-white p-6 rounded-xl shadow-md flex items-center space-x-4 transition-transform hover:scale-105">
    <div className="bg-blue-100 text-blue-600 p-3 rounded-full">
      {icon}
    </div>
    <div>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  </div>
);

const Dashboard: React.FC<{ onNavigate?: (page: Page) => void }> = ({ onNavigate }) => {
  const { students, subjects, settings } = useData();
  // Notifications are now global in GlobalActionBar

  return (
    <div className="space-y-8">
      <div className="p-8 bg-white rounded-2xl shadow-md border border-gray-200">
        <h1 className="text-4xl font-bold text-gray-800">Welcome to SBA Pro Master</h1>
        <p className="mt-2 text-lg text-gray-600">
          Managing school assessments has never been easier.
        </p>
        <p className="mt-1 text-lg text-gray-600">
          Currently managing assessments for <span className="font-semibold text-blue-600">{settings.schoolName}</span>.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard title="Total Students" value={students.length} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>} />
        <StatCard title="Total Subjects" value={subjects.length} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>} />
        <StatCard title="Academic Year" value={settings.academicYear} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} />
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Quick Start Guide</h2>
        <ol className="list-decimal list-inside space-y-3 text-gray-600">
          <li>Go to the <span className="font-semibold text-blue-600">Settings</span> page to configure school details.</li>
          <li>Add your students and subjects in the <span className="font-semibold text-blue-600">Students</span> and <span className="font-semibold text-blue-600">Subjects</span> pages.</li>
          <li>Use the <span className="font-semibold text-blue-600">Score Entry</span> page to input assessment scores for each student.</li>
          <li>Generate and print beautiful report cards from the <span className="font-semibold text-blue-600">Report Viewer</span>.</li>
        </ol>
      </div>

    </div>
  );
};

export default Dashboard;
