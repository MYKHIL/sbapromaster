export type Page =
  | 'Dashboard'
  | 'Students'
  | 'Subjects'
  | 'Teachers'
  | 'Score Entry'
  | 'Report Viewer'
  | 'Grading System'
  | 'Assessment Types'
  | 'School Setup'
  | 'Score Summary'
  | 'Student Progress'
  | 'Subject Analysis'
  | 'Settings'
  | 'Firebase Analytics';

export interface NavigationMeta {
  openAddModal?: boolean;
}

export interface SchoolSettings {
  schoolName: string;
  address: string;
  academicYear: string;
  academicTerm: string;
  headmasterName: string;
  district: string;
  logo: string;
  headmasterSignature: string;
  vacationDate: string;
  reopeningDate: string;
  allowStudentProgressView?: boolean;
  isPromotionTerm?: boolean;
}

export interface Subject {
  id: number;
  subject: string;
  type: 'Core' | 'Elective';
  signature?: string;
}

export interface Class {
  id: number;
  name: string;
  teacherSignature?: string;
}

export interface Teacher {
  id: number;
  name: string;
  gender: 'Male' | 'Female';
  class: string;
}

export interface Grade {
  id: number;
  name: string;
  minScore: number;
  maxScore: number;
  remark: string;
}

export interface Student {
  id: number;
  name: string;
  gender: 'Male' | 'Female';
  class: string;
  age: string;
  picture?: string;
  indexNumber?: string;
  guardianName?: string;
  guardianPhone?: string;
}

export interface Score {
  id: string; // Composite ID: `${studentId}-${subjectId}`
  studentId: number;
  subjectId: number;
  assessmentScores: { [assessmentId: number]: string[] };
}

export interface Assessment {
  id: number;
  name: string;
  weight: number;
  type: 'Class' | 'Exam';
}

export interface User {
  id: number;
  name: string;
  role: 'Admin' | 'Teacher' | 'Guest';
  isReadOnly?: boolean;
  allowedClasses?: string[];
  allowedSubjects?: number[];
  passwordHash?: string;
}

export interface SchoolPeriod {
  year: string;
  term: string;
  docId: string;
}

export interface ReportSpecificData {
  studentId: number;
  attendance?: string;
  conduct?: string;
  interest?: string;
  attitude?: string;
  teacherRemark?: string;
  promotedTo?: string;
}

export interface ClassSpecificData {
  classId: number;
  totalSchoolDays?: string;
}

export interface DeviceCredential {
  schoolId: string;
  userId: number;
  lastLogin: string;
}

export interface UserLog {
  id: number;
  userId: number;
  userName: string;
  role: string;
  action: string;
  timestamp: string;
}

export interface OnlineUser {
  userId: number;
  userName: string;
  role?: string;
  lastHeartbeat: string;
}

export interface AppDataType {
  settings: SchoolSettings;
  students: Student[];
  subjects: Subject[];
  classes: Class[];
  grades: Grade[];
  assessments: Assessment[];
  scores: Score[];
  reportData: ReportSpecificData[];
  classData: ClassSpecificData[];
  users: User[];
  password?: string;
  Access?: boolean;
  activeSessions?: Record<string, string>;
  userLogs?: UserLog[];
  metadata?: {
    lastUpdated: Record<string, any>;
  };
}