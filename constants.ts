/// <reference types="vite/client" />

// MAINTENANCE MODE: Set to false to show "Under Construction" page
export const SITE_ACTIVE = true;

// APP VERSION: Single source of truth for version number
export const APP_VERSION = '6.0.5';

import type { SchoolSettings, Student, Subject, Class, Grade, Assessment, Score, ReportSpecificData, ClassSpecificData } from './types';

// SYNC OVERLAY: Set to false to disable the blocking overlay during sync
export const SHOW_SYNC_OVERLAY = false;

export const AI_FEATURES_ENABLED = false;
export const DEV_TOOLS_ENABLED = false;
export const ENABLE_ERUDA_CONSOLE = false;
export const MULTI_SCORE_ENTRY_ENABLED = false;
export const SHOW_PDF_DOWNLOAD_BUTTON = true;
export const SHOW_USER_EXPORT_BUTTON = false;
export const WHATSAPP_DEVELOPER_NUMBER = '233542410613';
export const AUTO_SANITIZE_TEACHERS = true;

// GLOBAL STYLING: Dirty Indicators
// Brick Red Pattern: bg-red-900 / text-white
// Navy Blue Pattern: bg-blue-900 / text-white
// Amber Pattern: bg-amber-50 / text-amber-900
export const DIRTY_INDICATOR_BG = 'bg-rose-600';
export const DIRTY_INDICATOR_TEXT = 'text-white';
export const DIRTY_INDICATOR_SECONDARY_TEXT = 'text-rose-100';
export const DIRTY_INDICATOR_HOVER_BG = 'hover:bg-rose-500';
export const DIRTY_INDICATOR_BORDER = 'border-rose-700';

// ONE-TIME IMAGE REPAIR: Set to true to compress oversized student images on startup
// This reduces image resolution to prevent Firestore document size errors
// NOTE: This is now controlled manually via Firebase Analytics page
export const ENABLE_DATABASE_IMAGE_REPAIR = false;

// BUCKET CLEANUP: Set to true to delete and recreate all student buckets
// Use this to clean up buckets from previous implementations that created too many chunks
// NOTE: This is now controlled manually via Firebase Analytics page
export const CLEAR_STUDENT_BUCKETS = false;

// DATABASE SWITCHING CONTROL
// 1 = Primary Database (sba-pro-master-759f6)
// 2 = Backup Database (sba-pro-master-40f08)
// Initialize from localStorage if available, otherwise default to 1
const storedIndex = typeof window !== 'undefined' ? localStorage.getItem('active_database_index') : null;
export const ACTIVE_DATABASE_INDEX = storedIndex ? parseInt(storedIndex, 10) : 1;

// API CONFIGURATION
// Determine API Base URL based on environment
const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const isGitHubPages = typeof window !== 'undefined' && window.location.hostname.includes('github.io');

export const API_BASE_URL = isGitHubPages
  ? 'https://sbapromaster.vercel.app/api' // Use Production Vercel API for GitHub Pages
  : '/api'; // Relative path for Vercel deployment and local dev (Vite proxy/Vercel dev)

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

export let FIREBASE_CONFIGS: { [key: number]: FirebaseConfig } = {
  // Configs will be loaded from Vercel API at runtime
};

export const setFirebaseConfigs = (configs: { [key: number]: FirebaseConfig }) => {
  FIREBASE_CONFIGS = configs;
};

// Mapping of partial school names to specific database indices
// Keys should be lowercase and sanitized (no spaces, no special chars)
// This will be loaded from the API at runtime
export let SCHOOL_DATABASE_MAPPING: { [key: string]: number } = {};

export const setSchoolDatabaseMapping = (mapping: { [key: string]: number }) => {
  SCHOOL_DATABASE_MAPPING = mapping;
};

export let ACTIVATION_HASH = 'c93a215026f36ac783bcac8ba5e4bbea1c3cdb6c79d3824f9712143c44dbb0f3';

export const setActivationHash = (hash: string) => {
  if (hash) {
    ACTIVATION_HASH = hash;
  }
};
export let PAYSTACK_PUBLIC_KEY = '';

export const setPaystackPublicKey = (key: string) => {
  PAYSTACK_PUBLIC_KEY = key;
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
  indexNumberGlobalPrefix: '',
  indexNumberGlobalSuffix: '',
  indexNumberCounterDigits: 3,
  indexNumberPerClass: false,
  indexNumberGlobalCounter: 1,
  allowPersistence: true,
  showAggregateScore: false,
  aggregateScoreClasses: [],
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
  { id: 1, name: 'Class Exercise', weight: 10, type: 'Class' },
  { id: 2, name: 'Class Test', weight: 15, type: 'Class' },
  { id: 3, name: 'Assignment', weight: 10, type: 'Class' },
  { id: 4, name: 'Group Work', weight: 15, type: 'Class' },
  { id: 5, name: 'Exam', weight: 50, type: 'Exam' },
];

export const INITIAL_SCORES: Score[] = [];

export const INITIAL_REPORT_DATA: ReportSpecificData[] = [];

export const INITIAL_CLASS_DATA: ClassSpecificData[] = [];

export const ADMIN_EMAIL = 'darkmic50@gmail.com';

export const SUBSCRIPTION_TIERS = [
  {
    name: import.meta.env.VITE_TIER_NAME_TRIAL as string,
    maxStudents: Number(import.meta.env.VITE_TIER_STUDENTS_TRIAL),
    maxClass: Number(import.meta.env.VITE_TIER_CLASSES_TRIAL),
    duration: import.meta.env.VITE_TIER_DURATION_TRIAL as string,
    price: import.meta.env.VITE_TIER_PRICE_TRIAL as string
  },
  {
    name: import.meta.env.VITE_TIER_NAME_BASIC as string,
    maxStudents: Number(import.meta.env.VITE_TIER_STUDENTS_BASIC),
    maxClass: Number(import.meta.env.VITE_TIER_CLASSES_BASIC),
    duration: import.meta.env.VITE_TIER_DURATION_BASIC as string,
    price: import.meta.env.VITE_TIER_PRICE_BASIC as string
  },
  {
    name: import.meta.env.VITE_TIER_NAME_STANDARD as string,
    maxStudents: Number(import.meta.env.VITE_TIER_STUDENTS_STANDARD),
    maxClass: Number(import.meta.env.VITE_TIER_CLASSES_STANDARD),
    duration: import.meta.env.VITE_TIER_DURATION_STANDARD as string,
    price: import.meta.env.VITE_TIER_PRICE_STANDARD as string
  },
  {
    name: import.meta.env.VITE_TIER_NAME_PREMIUM as string,
    maxStudents: Number(import.meta.env.VITE_TIER_STUDENTS_PREMIUM),
    maxClass: Number(import.meta.env.VITE_TIER_CLASSES_PREMIUM),
    duration: import.meta.env.VITE_TIER_DURATION_PREMIUM as string,
    price: import.meta.env.VITE_TIER_PRICE_PREMIUM as string
  },
  {
    name: import.meta.env.VITE_TIER_NAME_PROFESSIONAL as string,
    maxStudents: Number(import.meta.env.VITE_TIER_STUDENTS_PROFESSIONAL),
    maxClass: Number(import.meta.env.VITE_TIER_CLASSES_PROFESSIONAL),
    duration: import.meta.env.VITE_TIER_DURATION_PROFESSIONAL as string,
    price: import.meta.env.VITE_TIER_PRICE_PROFESSIONAL as string
  },
  {
    name: import.meta.env.VITE_TIER_NAME_ENTERPRISE as string,
    maxStudents: Number(import.meta.env.VITE_TIER_STUDENTS_ENTERPRISE),
    maxClass: Number(import.meta.env.VITE_TIER_CLASSES_ENTERPRISE),
    duration: import.meta.env.VITE_TIER_DURATION_ENTERPRISE as string,
    price: import.meta.env.VITE_TIER_PRICE_ENTERPRISE as string
  },
  {
    name: import.meta.env.VITE_TIER_NAME_CUSTOM as string,
    maxStudents: Number(import.meta.env.VITE_TIER_STUDENTS_CUSTOM),
    maxClass: Number(import.meta.env.VITE_TIER_CLASSES_CUSTOM),
    duration: import.meta.env.VITE_TIER_DURATION_CUSTOM as string,
    price: import.meta.env.VITE_TIER_PRICE_CUSTOM as string
  },
];