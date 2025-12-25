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
  | 'Data Management'
  | 'Score Summary'
  | 'Student Progress';

export interface Student {
  id: number;
  name: string;
  indexNumber: string;
  gender: 'Male' | 'Female';
  class: string;
  dateOfBirth: string;
  age: string;

  picture: string; // base64 string
}

export interface Subject {
  id: number;
  subject: string;
  type: 'Core' | 'Elective';
  facilitator: string; // From DB schema
  signature: string; // From DB schema, base64 string
}

export interface Class {
  id: number;
  name: string;
  teacherName: string;
  teacherSignature: string; // base64 string

  // Index Number Configuration (when per-class mode is enabled)
  indexNumberPrefix?: string; // Class-specific prefix (e.g., "JHS1-")
  indexNumberSuffix?: string; // Class-specific suffix (e.g., "-A")
  indexNumberCounter?: number; // Current counter for this class
}

export interface Grade {
  id: number;
  name: string;
  minScore: number;
  maxScore: number;
  remark: string;
}

export interface Assessment {
  id: number;
  name: string;
  weight: number; // Percentage & Max Score
}

export interface Score {
  id: string; // e.g., `${studentId}-${subjectId}`
  studentId: number;
  subjectId: number;
  assessmentScores: {
    [assessmentId: number]: string[]; // Array of scores, e.g., ["15/20", "18/20"]
  };
}

export interface SchoolSettings {
  schoolName: string;
  district: string;
  address: string;
  academicYear: string;
  academicTerm: string;
  vacationDate: string;
  reopeningDate: string;
  headmasterName: string;
  logo: string; // base64 string
  headmasterSignature: string; // base64 string
  isDataEntryLocked?: boolean; // If true, non-admins cannot add/edit/delete

  // Index Number Auto-Assignment Configuration
  autoAssignIndexNumbers?: boolean; // If true, index numbers will be auto-assigned
  indexNumberGlobalPrefix?: string; // Global prefix for all index numbers (e.g., "0220009")
  indexNumberGlobalSuffix?: string; // Global suffix for all index numbers (e.g., "25")
  indexNumberCounterDigits?: number; // Number of digits for counter (default: 3)
  indexNumberPerClass?: boolean; // If true, each class has its own counter
  indexNumberAutoSort?: boolean; // If true, sort students alphabetically before assigning
  indexNumberGlobalCounter?: number; // Global counter when not using per-class counters
  allowStudentProgressView?: boolean; // Allow non-admins to view student progress page
  isPromotionTerm?: boolean; // If true, enables the promotion field in reports
}

export interface ReportSpecificData {
  studentId: number;
  attendance: string;
  conduct: string;
  interest: string;
  attitude: string;
  teacherRemark: string;
  promotedTo?: string; // Optional field for promotion status (e.g. "JHS 2")
}

export interface ClassSpecificData {
  classId: number;
  totalSchoolDays: string;
}

// Authentication & Authorization Types
export type UserRole = 'Admin' | 'Teacher' | 'Guest';

export interface Notification {
  id: string;
  senderId?: number; // Optional for system messages, required for user messages
  senderName?: string;
  type: 'system' | 'missing_data_alert' | 'feedback';
  context?: {
    classId?: number;
    subjectId?: number;
    dataType: 'scores' | 'remarks';
  };
  message: string;
  link?: string;
  read: boolean;
  date: string;
  classId?: number; // Deprecated, use context.classId
  replies?: {
    senderId: number;
    senderName: string;
    message: string;
    date: string;
  }[];
}

export interface User {
  id: number;
  name: string;
  role: UserRole;
  allowedClasses: string[]; // Class names the user has access to
  allowedSubjects: string[]; // Subject names the user has access to
  classSubjects?: { [className: string]: string[] }; // Optional: class -> subjects mapping
  passwordHash: string; // Hashed password
  isReadOnly?: boolean; // If true, user cannot edit anything regardless of role
  notifications?: Notification[];
}

export interface DeviceCredential {
  deviceId: string; // Unique device fingerprint
  userId: number; // User ID associated with this device
  lastLogin: string; // ISO timestamp of last login
}

export interface UserLog {
  id: string; // timestamp-random
  userId: number;
  userName: string;
  role: UserRole;
  action: 'Login' | 'Logout' | 'Page Visit';
  timestamp: string; // ISO
  deviceId?: string;
  pageName?: string; // Current page being visited
  previousPage?: string; // Last page visited (for navigation logs)
}

export interface OnlineUser {
  userId: number;
  userName: string;
  role: string;
  lastActive: string; // ISO
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
  users?: User[];
  userLogs?: UserLog[];
  activeSessions?: Record<string, string>;
  Access?: boolean;
  password?: string;
  deviceCredentials?: DeviceCredential[];
}