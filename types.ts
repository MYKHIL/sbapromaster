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
  | 'Data Management';

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
}

export interface ReportSpecificData {
  studentId: number;
  attendance: string;
  conduct: string;
  interest: string;
  attitude: string;
  teacherRemark: string;
}

export interface ClassSpecificData {
    classId: number;
    totalSchoolDays: string;
}