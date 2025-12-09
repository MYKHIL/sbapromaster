// MAINTENANCE MODE: Set to false to show "Under Construction" page
export const SITE_ACTIVE = true;

import type { SchoolSettings, Student, Subject, Class, Grade, Assessment, Score, ReportSpecificData, ClassSpecificData } from './types';

// SYNC OVERLAY: Set to false to disable the blocking overlay during sync
export const SHOW_SYNC_OVERLAY = false;

export const AI_FEATURES_ENABLED = false; 
export const DEV_TOOLS_ENABLED = false;
export const MULTI_SCORE_ENTRY_ENABLED = false;
export const SHOW_PDF_DOWNLOAD_BUTTON = true;
export const WHATSAPP_DEVELOPER_NUMBER = '233542410613';

export const INITIAL_SETTINGS: SchoolSettings = {
  schoolName: 'SBA Pro Master Demo School',
  district: 'Tech District',
  address: '123 Innovation Drive, Codeville',
  academicYear: '2023/2024',
  academicTerm: 'Third Term',
  vacationDate: '2024-08-15',
  reopeningDate: '2024-09-10',
  headmasterName: 'Mr. Michael Darko',
  logo: '',
  headmasterSignature: '',
  isDataEntryLocked: false,
};

export const INITIAL_STUDENTS: Student[] = [
  { id: 1, name: 'John Doe', indexNumber: 'S001', gender: 'Male', class: 'JHS 1', dateOfBirth: '2010-05-15', age: '14', picture: '' },
  { id: 2, name: 'Jane Smith', indexNumber: 'S002', gender: 'Female', class: 'JHS 1', dateOfBirth: '2010-08-20', age: '13', picture: '' },
];

export const INITIAL_SUBJECTS: Subject[] = [
  { id: 1, subject: 'Mathematics', type: 'Core', facilitator: '', signature: '' },
  { id: 2, subject: 'English Language', type: 'Core', facilitator: '', signature: '' },
  { id: 3, subject: 'Integrated Science', type: 'Core', facilitator: '', signature: '' },
  { id: 4, subject: 'Social Studies', type: 'Core', facilitator: '', signature: '' },
  { id: 5, subject: 'French', type: 'Elective', facilitator: '', signature: '' },
];

export const INITIAL_CLASSES: Class[] = [
  { id: 1, name: 'JHS 1', teacherName: 'Mr. Emmanuel Quarshie', teacherSignature: '' },
  { id: 2, name: 'JHS 2', teacherName: 'Mrs. Alberta Mensah', teacherSignature: '' },
];

export const INITIAL_GRADES: Grade[] = [
  { id: 1, name: 'A+', minScore: 80, maxScore: 100, remark: 'Excellent' },
  { id: 2, name: 'A', minScore: 75, maxScore: 79, remark: 'Very Good' },
  { id: 3, name: 'B+', minScore: 70, maxScore: 74, remark: 'Good' },
  { id: 4, name: 'B', minScore: 65, maxScore: 69, remark: 'Credit' },
  { id: 5, 'name': 'C+', minScore: 60, maxScore: 64, remark: 'Credit' },
  { id: 6, 'name': 'C', minScore: 55, maxScore: 59, remark: 'Pass' },
  { id: 7, name: 'D+', minScore: 50, maxScore: 54, remark: 'Pass' },
  { id: 8, name: 'D', minScore: 45, maxScore: 49, remark: 'Weak Pass' },
  { id: 9, name: 'E', minScore: 40, maxScore: 44, remark: 'Weak Pass' },
  { id: 10, name: 'F', minScore: 0, maxScore: 39, remark: 'Fail' },
];

export const INITIAL_ASSESSMENTS: Assessment[] = [
  { id: 1, name: 'Class Test 1', weight: 10 },
  { id: 2, name: 'Class Test 2', weight: 10 },
  { id: 3, name: 'Group Work', weight: 15 },
  { id: 4, name: 'Project Work', weight: 15 },
  { id: 5, name: 'End of Term Exam', weight: 50 },
];

export const INITIAL_SCORES: Score[] = [];

export const INITIAL_REPORT_DATA: ReportSpecificData[] = [];

export const INITIAL_CLASS_DATA: ClassSpecificData[] = [];