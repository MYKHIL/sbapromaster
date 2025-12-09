import React, { useState } from 'react';
import type { Page } from '../types';
import { useUser } from '../context/UserContext';

interface SidebarProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
}

const NavItem: React.FC<{
  pageName: Page;
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  icon: React.ReactElement;
  isExpanded: boolean;
}> = ({ pageName, currentPage, setCurrentPage, icon, isExpanded }) => {
  const isActive = currentPage === pageName;
  return (
    <li
      className={`flex items-center p-3 my-1 rounded-lg cursor-pointer transition-all duration-200 ${isActive
        ? 'bg-blue-600 text-white shadow-lg'
        : 'text-gray-600 hover:bg-blue-100 hover:text-blue-700'
        }`}
      onClick={() => setCurrentPage(pageName)}
    >
      {icon}
      <span className={`ml-3 font-medium transition-opacity duration-300 whitespace-nowrap ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>{pageName}</span>
    </li>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ currentPage, setCurrentPage }) => {
  const { currentUser, isAuthenticated } = useUser();
  const [isHoverExpanded, setIsHoverExpanded] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const iconClass = "h-6 w-6 flex-shrink-0";

  const isExpanded = isHoverExpanded || isMobileMenuOpen;

  const handlePageChange = (page: Page) => {
    setCurrentPage(page);
    setIsMobileMenuOpen(false); // Close mobile menu on navigation
  };

  const allPages: { name: Page; icon: React.ReactElement; requiresAuth?: boolean; allowedRoles?: string[] }[] = [
    { name: 'Dashboard', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>, requiresAuth: false },
    { name: 'School Setup', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" /></svg> },
    { name: 'Teachers', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" /></svg>, requiresAuth: true, allowedRoles: ['Admin', 'Teacher'] },
    { name: 'Subjects', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>, requiresAuth: true, allowedRoles: ['Admin', 'Teacher'] },
    { name: 'Students', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>, requiresAuth: true, allowedRoles: ['Admin', 'Teacher'] },
    { name: 'Grading System', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.153.24c-1.355 0-2.697-.44-3.75-1.25M12 4.5c-2.291 0-4.545.16-6.75.47m-6.75-.47c-1.01.143-2.01.317-3 .52m3-.52L2.62 15.696c-.122.499.106 1.028.589 1.202a5.989 5.989 0 002.153.24c1.355 0 2.697-.44 3.75-1.25M12 4.5v15.75" /></svg>, requiresAuth: true, allowedRoles: ['Admin', 'Teacher'] },
    { name: 'Assessment Types', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, requiresAuth: true, allowedRoles: ['Admin', 'Teacher'] },
    { name: 'Score Entry', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>, requiresAuth: true, allowedRoles: ['Admin', 'Teacher', 'Guest'] },
    { name: 'Report Viewer', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>, requiresAuth: true, allowedRoles: ['Admin', 'Teacher', 'Guest'] },
    { name: 'Data Management', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h15.75c.621 0 1.125.504 1.125 1.125v6.75C21 20.496 20.496 21 19.875 21H4.125A1.125 1.125 0 013 19.875v-6.75zM3 8.625C3 8.004 3.504 7.5 4.125 7.5h15.75c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125H4.125A1.125 1.125 0 013 11.25V8.625zM3 4.125C3 3.504 3.504 3 4.125 3h15.75c.621 0 1.125.504 1.125 1.125v2.25C21 6.996 20.496 7.5 19.875 7.5H4.125A1.125 1.125 0 013 6.375V4.125z" /></svg>, requiresAuth: true, allowedRoles: ['Admin', 'Teacher'] },
    { name: 'Score Summary', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>, requiresAuth: true, allowedRoles: ['Admin'] },
  ];

  // Filter pages based on user role
  const pages = isAuthenticated && currentUser
    ? allPages.filter(page => {
      if (!page.requiresAuth) return true;
      if (!page.allowedRoles) return true;
      return page.allowedRoles.includes(currentUser.role);
    })
    : allPages.filter(page => !page.requiresAuth);

  return (
    <>
      {/* Mobile Hamburger Menu Button */}
      {/* Mobile Hamburger Menu Button */}
      {!isMobileMenuOpen && (
        <button
          className="lg:hidden fixed top-4 left-4 z-50 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 hover:scale-105 active:scale-95"
          onClick={() => setIsMobileMenuOpen(true)}
          aria-label="Open menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          <span className="font-bold text-sm tracking-wide">MENU</span>
        </button>
      )}

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>
      )}

      <aside
        className={`bg-white shadow-md p-4 flex flex-col transition-all duration-300 ease-in-out z-40
          lg:relative lg:w-20 lg:hover:w-64
          fixed inset-y-0 left-0 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 w-64`}
        onMouseEnter={() => setIsHoverExpanded(true)}
        onMouseLeave={() => setIsHoverExpanded(false)}
      >
        <div className="flex items-center justify-between mb-8 flex-shrink-0">
          <div className="flex items-center overflow-hidden">
            <div className="bg-blue-600 p-2 rounded-lg flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="white" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0l-2.072-2.072a50.57 50.57 0 01-2.254-2.254" />
              </svg>
            </div>
            <h1 className={`text-xl font-bold text-gray-800 ml-3 whitespace-nowrap transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>SBA Pro Master</h1>
          </div>

          {/* Close Button for Mobile */}
          <button
            className="lg:hidden p-2 text-gray-500 hover:text-gray-700 focus:outline-none transition-colors"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="overflow-y-auto overflow-x-hidden flex-grow">
          <ul>
            {pages.map(({ name, icon }) => (
              <NavItem
                key={name}
                pageName={name}
                currentPage={currentPage}
                setCurrentPage={handlePageChange}
                icon={icon}
                isExpanded={isExpanded}
              />
            ))}
          </ul>
        </nav>
        <div className={`mt-auto p-2 text-center text-xs text-gray-400 transition-opacity duration-300 flex-shrink-0 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
          <p>&copy; 2024 SBA Pro Master</p>
          <p>Version 5.5.9</p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;