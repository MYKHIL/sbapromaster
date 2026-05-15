import { 
  PlusCircle, 
  CreditCard, 
  LogIn, 
  Settings, 
  ClipboardList, 
  FileText, 
  UserCheck, 
  BarChart3,
  Building2
} from 'lucide-react';

export interface TutorialStep {
  title: string;
  description: string;
  mockPage: 'Welcome' | 'Registration' | 'Subscription' | 'Login' | 'ScoreEntry' | 'Reports' | 'Charts' | 'Settings' | 'Dashboard' | 'school' | 'classes' | 'students' | 'grading' | 'assessment' | 'subjects' | 'progress';
  cursorX: number;
  cursorY: number;
  action: 'none' | 'click' | 'type';
  actionType?: 'add' | 'edit' | 'delete' | 'none';
  typingField?: string;
  typingVal?: string;
  activeBtn?: string;
  progressStart: number;
  progressEnd: number;
}

export interface TutorialSection {
  id: string;
  title: string;
  icon: any;
  steps: TutorialStep[];
}

export const TUTORIAL_DATA: TutorialSection[] = [
  {
    id: 'register',
    title: 'School Registration',
    icon: PlusCircle,
    steps: [
      {
        title: 'Start Registration',
        description: 'Welcome. To begin, navigate to the welcome screen and click on Register New School to create your unique database.',
        mockPage: 'Welcome',
        cursorX: 50,
        cursorY: 58,
        action: 'click',
        activeBtn: 'register',
        progressStart: 0,
        progressEnd: 100
      },
      {
        title: 'Enter School Name',
        description: 'Now, type in your school name. This name will appear on all your official terminal reports and documents.',
        mockPage: 'Registration',
        cursorX: 50,
        cursorY: 38,
        action: 'type',
        typingField: 'name',
        typingVal: 'SBA Academy',
        progressStart: 0,
        progressEnd: 100
      },
      {
        title: 'Set Academic Year',
        description: 'Provide the current academic year. We recommend using the format shown in the example.',
        mockPage: 'Registration',
        cursorX: 50,
        cursorY: 52,
        action: 'type',
        typingField: 'year',
        typingVal: '2025-2026',
        progressStart: 0,
        progressEnd: 100
      },
      {
        title: 'Create Database',
        description: 'Click on Create School Database. Once successful, the system will automatically redirect you to the subscription portal.',
        mockPage: 'Registration',
        cursorX: 50,
        cursorY: 88,
        action: 'click',
        progressStart: 0,
        progressEnd: 100
      }
    ]
  },
  {
    id: 'subscription',
    title: 'Subscription & Payment',
    icon: CreditCard,
    steps: [
      {
        title: 'Select a Plan',
        description: 'Choose a plan that fits your students count. We support all major mobile money networks and bank cards.',
        mockPage: 'Subscription',
        cursorX: 65,
        cursorY: 42,
        action: 'click',
        progressStart: 0,
        progressEnd: 60
      },
      {
        title: 'Secure Payment',
        description: 'Confirm your payment details. Once verified, your school license will be updated instantly across all devices.',
        mockPage: 'Subscription',
        cursorX: 50,
        cursorY: 88,
        action: 'click',
        progressStart: 60,
        progressEnd: 100
      }
    ]
  },
  {
    id: 'login',
    title: 'Logging In',
    icon: LogIn,
    steps: [
      {
        title: 'Select Login',
        description: 'To access your data, click on Login to Existing School on the main welcome screen.',
        mockPage: 'Welcome',
        cursorX: 50,
        cursorY: 44,
        action: 'click',
        activeBtn: 'login',
        progressStart: 0,
        progressEnd: 100
      },
      {
        title: 'Search and Access',
        description: 'Search for your school, select the correct academic term, and enter your password to enter the dashboard.',
        mockPage: 'Login',
        cursorX: 50,
        cursorY: 62,
        action: 'type',
        typingVal: 'SBA Academy',
        progressStart: 0,
        progressEnd: 100
      }
    ]
  },
  {
    id: 'setup',
    title: 'Initial Setup',
    icon: Settings,
    steps: [
      {
        title: 'School Identity',
        description: 'Click the building icon to configure your school profile, motto, and contact details.',
        mockPage: 'school',
        cursorX: 7,
        cursorY: 21,
        action: 'click',
        progressStart: 0,
        progressEnd: 100
      },
      {
        title: 'School Profile',
        description: 'Enter your School Name, District, and Address. This data forms the header of your terminal reports.',
        mockPage: 'school',
        cursorX: 50,
        cursorY: 26,
        action: 'type',
        typingField: 'name',
        typingVal: 'SBA International School',
        progressStart: 0,
        progressEnd: 100
      },
      {
        title: 'Headmaster Details',
        description: "Type in the Headmaster's name. You can also upload the school logo for institutional branding.",
        mockPage: 'school',
        cursorX: 50,
        cursorY: 48,
        action: 'type',
        typingField: 'headmaster',
        typingVal: 'Dr. Isaac Boateng',
        progressStart: 0,
        progressEnd: 100
      },
      {
        title: 'Digital Signature',
        description: "Click the signature box. You can either UPLOAD a scanned image or DRAW it directly with your mouse or finger.",
        mockPage: 'school',
        cursorX: 50,
        cursorY: 75,
        action: 'click',
        progressStart: 0,
        progressEnd: 100
      },
      {
        title: 'Classes & Teachers',
        description: 'Manage your teaching staff. Remember, both Head and Teacher signatures will appear on each student\'s report card.',
        mockPage: 'classes',
        cursorX: 7,
        cursorY: 28,
        action: 'click',
        progressStart: 0,
        progressEnd: 100
      },
      {
        title: 'Add New Class',
        description: 'Click the Plus button and type in the class name (e.g., JHS 3 Gold).',
        mockPage: 'classes',
        cursorX: 85,
        cursorY: 12,
        action: 'click',
        actionType: 'add',
        progressStart: 0,
        progressEnd: 100
      },
      {
        title: 'Grading System',
        description: 'Set up your grading scale. This ensures that scores are automatically converted to letter grades.',
        mockPage: 'grading',
        cursorX: 7,
        cursorY: 49,
        action: 'click',
        progressStart: 0,
        progressEnd: 100
      },
      {
        title: 'Assessment Types',
        description: 'Configure your term weights. You can define how much Class Work vs Exams contribute to the final grade.',
        mockPage: 'assessment',
        cursorX: 7,
        cursorY: 55,
        action: 'click',
        progressStart: 0,
        progressEnd: 100
      },
      {
        title: 'Subject List',
        description: 'Define the subjects taught in your school. Each subject can be assigned specific weighting later.',
        mockPage: 'subjects',
        cursorX: 7,
        cursorY: 35,
        action: 'click',
        progressStart: 0,
        progressEnd: 100
      },
      {
        title: 'Student Enrollment',
        description: 'Now enroll students (e.g., John Mensah) into their respective classes.',
        mockPage: 'students',
        cursorX: 7,
        cursorY: 42,
        action: 'click',
        progressStart: 0,
        progressEnd: 100
      }
    ]
  },
  {
    id: 'score-entry',
    title: 'Score Entry',
    icon: ClipboardList,
    steps: [
      {
        title: 'Access Score Entry',
        description: 'Click the edit icon in the sidebar to open the marks entry grid.',
        mockPage: 'ScoreEntry',
        cursorX: 7,
        cursorY: 62,
        action: 'click',
        progressStart: 0,
        progressEnd: 100
      }
    ]
  },
  {
    id: 'reports',
    title: 'Reports & Remarks',
    icon: FileText,
    steps: [
      {
        title: 'View Reports',
        description: 'Click the document icon to view and print terminal reports.',
        mockPage: 'Reports',
        cursorX: 7,
        cursorY: 69,
        action: 'click',
        progressStart: 0,
        progressEnd: 100
      }
    ]
  }
];
