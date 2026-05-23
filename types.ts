export type Page =
  | 'Dashboard'
  | 'Students'
  | 'Subjects'
  | 'Classes & Teachers'
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
  allowPersistence?: boolean;
  isDataEntryLocked?: boolean;
  indexNumberGlobalPrefix?: string;
  indexNumberGlobalSuffix?: string;
  indexNumberPerClass?: boolean;
  indexNumberGlobalCounter?: number;
  indexNumberCounterDigits?: number;
  showAggregateScore?: boolean;
  aggregateScoreClasses?: number[];
  autoAssignIndexNumbers?: boolean;
  indexNumberAutoSort?: boolean;
}

export interface Subject {
  id: number;
  subject: string;
  type: 'Core' | 'Elective';
  signature?: string;
  facilitator?: string;
  _isLocallyCreated?: boolean;
  deleted?: boolean;
  deletedAt?: string;
  deletedBy?: number;
}

export interface Class {
  id: number;
  name: string;
  teacherName?: string;
  teacherSignature?: string;
  indexNumberPrefix?: string;
  indexNumberSuffix?: string;
  indexNumberCounter?: number;
  _isLocallyCreated?: boolean;
  deleted?: boolean;
  deletedAt?: string;
  deletedBy?: number;
}

export interface Teacher {
  id: number;
  name: string;
  gender: 'Male' | 'Female';
  class: string;
  _isLocallyCreated?: boolean;
}

export interface Grade {
  id: number;
  name: string;
  minScore: number;
  maxScore: number;
  remark: string;
  _isLocallyCreated?: boolean;
  deleted?: boolean;
  deletedAt?: string;
  deletedBy?: number;
}

export interface Student {
  id: number;
  name: string;
  gender: 'Male' | 'Female';
  class: string;
  age: string;
  picture?: string;
  indexNumber?: string;
  dateOfBirth?: string;
  guardianName?: string;
  guardianPhone?: string;
  _isLocallyCreated?: boolean;
  deleted?: boolean;
  deletedAt?: string;
  deletedBy?: number;
}

export interface Score {
  id: string; // Composite ID: `${studentId}-${subjectId}`
  studentId: number;
  subjectId: number;
  assessmentScores: { [assessmentId: number]: string[] };
  _isLocallyCreated?: boolean;
}

export interface Assessment {
  id: number;
  name: string;
  weight: number;
  type?: 'Class' | 'Exam';
  _isLocallyCreated?: boolean;
  deleted?: boolean;
  deletedAt?: string;
  deletedBy?: number;
}

export type UserRole = 'Admin' | 'Teacher' | 'Guest';

export interface User {
  id: number;
  name: string;
  role: UserRole;
  isReadOnly?: boolean;
  allowedClasses?: string[];
  allowedSubjects?: number[];
  classSubjects?: Record<string, number[]>; // Maps class name to list of subject IDs
  passwordHash?: string;
  notifications?: Notification[];
}

export interface Notification {
  id: string;
  senderId: number;
  senderName: string;
  type: 'missing_data_alert' | 'feedback' | string;
  context?: {
    classId?: number;
    dataType?: 'scores' | 'remarks' | string;
  };
  message: string;
  link?: string;
  read: boolean;
  date: string;
  replies?: {
    senderId: number;
    senderName: string;
    message: string;
    date: string;
  }[];
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
  _isLocallyCreated?: boolean;
}

export interface ClassSpecificData {
  classId: number;
  totalSchoolDays?: string;
  _isLocallyCreated?: boolean;
}

export interface DeviceCredential {
  schoolId: string;
  userId: number;
  deviceId?: string;
  lastLogin: string;
}

export interface UserLog {
  id: number;
  userId: number;
  userName: string;
  role: string;
  action: string;
  timestamp: string;
  isRead?: boolean;
  _isLocallyCreated?: boolean;
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