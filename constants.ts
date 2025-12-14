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
  autoAssignIndexNumbers: false,
  indexNumberGlobalPrefix: '',
  indexNumberGlobalSuffix: '',
  indexNumberCounterDigits: 3,
  indexNumberPerClass: false,
  indexNumberAutoSort: false,
  indexNumberGlobalCounter: 1,
};

export const INITIAL_STUDENTS: Student[] = [];

export const INITIAL_SUBJECTS: Subject[] = [
  { id: 1, subject: 'English Language', type: 'Core', facilitator: '', signature: '' },
  { id: 2, subject: 'Science', type: 'Core', facilitator: '', signature: '' },
  { id: 3, subject: 'Mathematics', type: 'Core', facilitator: '', signature: '' },
  { id: 4, subject: 'Social Studies', type: 'Core', facilitator: '', signature: '' },
  { id: 5, subject: 'Computing', type: 'Elective', facilitator: '', signature: '' },
  { id: 6, subject: 'Career Technology', type: 'Elective', facilitator: '', signature: '' },
  { id: 7, subject: 'Creative Arts & Design', type: 'Elective', facilitator: '', signature: '' },
  { id: 8, subject: 'Religious & Moral Education', type: 'Elective', facilitator: '', signature: '' },
  { id: 9, subject: 'Ghanaian Language', type: 'Elective', facilitator: '', signature: '' },
  { id: 10, subject: 'Creative Arts', type: 'Elective', facilitator: '', signature: '' },
  { id: 11, subject: 'OWOP', type: 'Elective', facilitator: '', signature: '' },
  { id: 12, subject: 'Numeracy', type: 'Core', facilitator: '', signature: '' },
  { id: 13, subject: 'Language & Literacy', type: 'Core', facilitator: '', signature: '' },
];

export const INITIAL_CLASSES: Class[] = [];

export const INITIAL_GRADES: Grade[] = [
  { id: 1, name: '1', minScore: 80, maxScore: 100, remark: 'Excellent' },
  { id: 2, name: '2', minScore: 70, maxScore: 79.9, remark: 'Very Good' },
  { id: 3, name: '3', minScore: 65, maxScore: 69.9, remark: 'Good' },
  { id: 4, name: '4', minScore: 60, maxScore: 64.9, remark: 'High Average' },
  { id: 5, name: '5', minScore: 55, maxScore: 59.9, remark: 'Average' },
  { id: 6, name: '6', minScore: 50, maxScore: 54.9, remark: 'Pass' },
  { id: 7, name: '7', minScore: 40, maxScore: 49.9, remark: 'Weak Pass' },
  { id: 8, name: '8', minScore: 35, maxScore: 39.9, remark: 'Lower' },
  { id: 9, name: '9', minScore: 0, maxScore: 34.9, remark: 'Lowest' },
];

export const INITIAL_ASSESSMENTS: Assessment[] = [
  { id: 1, name: 'Class Exercise', weight: 10 },
  { id: 2, name: 'Class Test', weight: 15 },
  { id: 3, name: 'Assignment', weight: 10 },
  { id: 4, name: 'Group Work', weight: 15 },
  { id: 5, name: 'Exam', weight: 50 },
];

export const INITIAL_SCORES: Score[] = [];

export const INITIAL_REPORT_DATA: ReportSpecificData[] = [];

export const INITIAL_CLASS_DATA: ClassSpecificData[] = [];