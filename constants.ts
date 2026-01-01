// MAINTENANCE MODE: Set to false to show "Under Construction" page
export const SITE_ACTIVE = true;

// APP VERSION: Single source of truth for version number
export const APP_VERSION = '6.0.5';

import type { SchoolSettings, Student, Subject, Class, Grade, Assessment, Score, ReportSpecificData, ClassSpecificData } from './types';

// SYNC OVERLAY: Set to false to disable the blocking overlay during sync
export const SHOW_SYNC_OVERLAY = false;

export const AI_FEATURES_ENABLED = false;
export const DEV_TOOLS_ENABLED = false;
export const MULTI_SCORE_ENTRY_ENABLED = false;
export const SHOW_PDF_DOWNLOAD_BUTTON = true;
export const SHOW_USER_EXPORT_BUTTON = false;
export const WHATSAPP_DEVELOPER_NUMBER = '233542410613';
export const AUTO_SANITIZE_TEACHERS = true;

// DATABASE SWITCHING CONTROL
// 1 = Primary Database (sba-pro-master-759f6)
// 2 = Backup Database (sba-pro-master-40f08)
// Initialize from localStorage if available, otherwise default to 1
const storedIndex = typeof window !== 'undefined' ? localStorage.getItem('active_database_index') : null;
export const ACTIVE_DATABASE_INDEX = storedIndex ? parseInt(storedIndex, 10) : 1;

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId: string;
  isReserved?: boolean; // If true, excluded from random assignment
  label?: string;
}

export const FIREBASE_CONFIGS: { [key: number]: FirebaseConfig } = {
  // INDEX 1: Primary Database (Public Pool)
  1: {
    apiKey: "AIzaSyCe0O-mBCODiEA-KNVLXLMp00lJ6_Jt5SU",
    authDomain: "sba-pro-master-759f6.firebaseapp.com",
    projectId: "sba-pro-master-759f6",
    storageBucket: "sba-pro-master-759f6.firebasestorage.app",
    messagingSenderId: "239073604626",
    appId: "1:239073604626:web:452bc2719fc980704d14cb",
    measurementId: "G-47MMKKX888",
    isReserved: false,
    label: 'Primary'
  },
  // INDEX 2: Backup/Darko Database (Reserved)
  2: {
    apiKey: "AIzaSyBP6gLbFLhfbAvjB2ddXSq6zqE_gWK2MEI",
    authDomain: "sba-pro-master-40f08.firebaseapp.com",
    projectId: "sba-pro-master-40f08",
    storageBucket: "sba-pro-master-40f08.firebasestorage.app",
    messagingSenderId: "91692962474",
    appId: "1:91692962474:web:eefa6a3a04ba557c38b6d3",
    measurementId: "G-EHHNKZ5FBG",
    isReserved: true,
    label: 'Reserved/Darko'
  },
  // INDEX 3: Secondary Public Database (Public Pool)
  3: {
    apiKey: "AIzaSyBnbpBSwA-AtorGzVefj5h3fWkAVfyDWuU",
    authDomain: "sba-pro-master-e43d0.firebaseapp.com",
    projectId: "sba-pro-master-e43d0",
    storageBucket: "sba-pro-master-e43d0.firebasestorage.app",
    messagingSenderId: "126627036834",
    appId: "1:126627036834:web:4e32313e40e5c3f752a1fb",
    measurementId: "G-N09YP3PZ9J",
    isReserved: false,
    label: 'Public 2'
  }
};

// Mapping of partial school names to specific database indices
// Keys should be lowercase and sanitized (no spaces, no special chars)
export const SCHOOL_DATABASE_MAPPING: { [key: string]: number } = {
  'ayirebida': 2
};

export const INITIAL_SETTINGS: SchoolSettings = {
  schoolName: '',
  district: '',
  address: '',
  academicYear: '',
  academicTerm: '',
  vacationDate: '',
  reopeningDate: '',
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
  { id: 2, name: '2', minScore: 70, maxScore: 79, remark: 'Very Good' },
  { id: 3, name: '3', minScore: 65, maxScore: 69, remark: 'Good' },
  { id: 4, name: '4', minScore: 60, maxScore: 64, remark: 'High Average' },
  { id: 5, name: '5', minScore: 55, maxScore: 59, remark: 'Average' },
  { id: 6, name: '6', minScore: 50, maxScore: 54, remark: 'Pass' },
  { id: 7, name: '7', minScore: 40, maxScore: 49, remark: 'Weak Pass' },
  { id: 8, name: '8', minScore: 35, maxScore: 39, remark: 'Lower' },
  { id: 9, name: '9', minScore: 0, maxScore: 34, remark: 'Lowest' },
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