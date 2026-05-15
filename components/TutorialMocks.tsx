import React, { useMemo } from 'react';
import { 
  LayoutDashboard, 
  Settings as SettingsIcon, 
  Users, 
  BookOpen, 
  GraduationCap, 
  ClipboardList, 
  BarChart3, 
  FileText,
  UserCheck,
  CreditCard,
  PlusCircle,
  LogIn,
  Save,
  CheckCircle2,
  MousePointer2,
  X,
  Building2
} from 'lucide-react';

/**
 * --- CURSOR COMPONENT ---
 */
export const MockCursor: React.FC<{ x: number; y: number; isClicking: boolean }> = ({ x, y, isClicking }) => (
  <div 
    className={`absolute z-[2000] pointer-events-none transition-all duration-700 ease-in-out`}
    style={{ 
      left: `${x}%`, 
      top: `${y}%`,
      transform: `scale(${isClicking ? 0.8 : 1})`,
    }}
  >
    <MousePointer2 
      size={24} 
      className={`text-black fill-white stroke-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] transition-transform ${isClicking ? 'scale-75' : 'scale-100'}`} 
    />
    {isClicking && (
      <div className="absolute top-0 left-0 w-8 h-8 -translate-x-1/2 -translate-y-1/2 bg-indigo-500/30 rounded-full animate-ping" />
    )}
  </div>
);

/**
 * --- MOCK UI COMPONENTS ---
 */

export const MockWelcomeScreen: React.FC<{ activeBtn?: string; isClicked?: boolean }> = ({ activeBtn, isClicked }) => (
  <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
    <div className="w-full max-w-xs space-y-6">
      <div className="text-center mb-4">
        <h1 className="text-xl font-bold text-gray-900">SBA Pro Master</h1>
        <p className="text-[10px] text-gray-500">School-Based Assessment Management</p>
      </div>
      <div className="bg-white rounded-[2rem] shadow-xl p-6 space-y-4">
        <div className={`p-4 rounded-2xl border flex items-center gap-3 text-[10px] font-bold transition-all ${activeBtn === 'login' ? (isClicked ? 'bg-indigo-100 border-indigo-400 scale-95' : 'border-indigo-600 bg-indigo-50 shadow-md') : 'border-gray-100 bg-white'}`}>
           <LogIn size={16} className="text-gray-400" /> Login to Existing School
        </div>
        <div className={`p-4 rounded-2xl flex items-center gap-3 text-[10px] font-bold text-white shadow-lg transition-all ${activeBtn === 'register' ? (isClicked ? 'bg-indigo-800 scale-95' : 'bg-indigo-700 shadow-indigo-200') : 'bg-indigo-600'}`}>
           <PlusCircle size={16} /> Register New School
        </div>
        <div className={`p-4 rounded-2xl border border-indigo-100 bg-indigo-50/50 flex items-center gap-3 text-[10px] font-bold text-indigo-700 transition-all ${activeBtn === 'pay' ? (isClicked ? 'bg-indigo-200 scale-95' : 'bg-indigo-100') : ''}`}>
           <CreditCard size={16} /> Pay / Subscription
        </div>
      </div>
    </div>
  </div>
);

export const MockRegistrationForm: React.FC<{ typingField?: string; typingVal?: string; isClicked?: boolean }> = ({ typingField, typingVal, isClicked }) => (
  <div className="p-6 h-full bg-white flex flex-col items-center">
    <div className="w-full max-w-xs space-y-5">
      <h2 className="font-bold text-gray-800 text-sm mb-4">Register New School</h2>
      {[
        { label: 'School Name', id: 'name' },
        { label: 'Academic Year', id: 'year' },
        { label: 'Term', id: 'term' },
        { label: 'Password', id: 'pass' }
      ].map(f => (
        <div key={f.id} className="space-y-1.5">
          <label className="text-[8px] font-bold text-gray-400 uppercase tracking-wider ml-1">{f.label}</label>
          <div className={`h-10 border-2 rounded-xl flex items-center px-3 text-[11px] transition-all ${typingField === f.id ? 'border-indigo-500 ring-4 ring-indigo-50 bg-white' : 'border-gray-50 bg-gray-50/50'}`}>
            {typingField === f.id ? typingVal : ''}
            {typingField === f.id && <div className="w-0.5 h-3 bg-indigo-500 ml-0.5 animate-pulse" />}
          </div>
        </div>
      ))}
      <div className={`mt-8 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-xs shadow-xl transition-all ${isClicked ? 'bg-indigo-800 scale-95' : 'hover:bg-indigo-700'}`}>
        Create School Database
      </div>
    </div>
  </div>
);

export const MockTopBar: React.FC<{ title: string }> = ({ title }) => (
  <div className="h-10 border-b border-gray-100 bg-white flex items-center px-4 justify-between rounded-tr-2xl">
    <span className="font-bold text-gray-600 text-[10px] tracking-tight uppercase">{title}</span>
    <div className="flex items-center gap-2">
      <div className="w-5 h-5 rounded-full bg-gray-100 border border-gray-200" />
      <div className="h-1.5 w-12 bg-gray-100 rounded" />
    </div>
  </div>
);

export const MockScoreEntry: React.FC<{ progress: number; typing?: boolean }> = ({ progress, typing }) => {
  const rows = [1, 2, 3];
  return (
    <div className="p-4 space-y-3 h-full">
      <div className="flex gap-2 mb-2">
        <div className="h-6 w-16 bg-gray-100 rounded border border-gray-200" />
        <div className="h-6 w-16 bg-gray-100 rounded border border-gray-200" />
      </div>
      <div className="bg-white rounded-lg border border-gray-100 overflow-hidden shadow-sm">
        <table className="w-full text-[9px]">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="p-2 text-left text-gray-400">STUDENT</th>
              <th className="p-2 text-center text-gray-400">CLASS (40)</th>
              <th className="p-2 text-center text-gray-400">EXAM (60)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r} className="border-b border-gray-50">
                <td className="p-2 font-medium text-gray-600">Student {r}</td>
                <td className="p-2 text-center">
                  <div className={`h-4 w-6 mx-auto rounded flex items-center justify-center transition-all duration-300 ${progress > i * 33 ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-100' : 'bg-gray-50'}`}>
                    {progress > i * 33 ? '34' : ''}
                    {typing && i === Math.floor(progress/33) && <div className="w-0.5 h-2 bg-indigo-500 animate-pulse ml-0.5" />}
                  </div>
                </td>
                <td className="p-2 text-center">
                   <div className={`h-4 w-6 mx-auto rounded bg-gray-50`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {progress > 95 && (
        <div className="flex justify-end animate-in zoom-in duration-300">
          <div className="bg-green-600 text-white px-2 py-1 rounded text-[8px] font-bold flex items-center gap-1 shadow-md">
            <CheckCircle2 size={10} /> SAVED
          </div>
        </div>
      )}
    </div>
  );
};

export const MockChart: React.FC<{ progress: number }> = ({ progress }) => (
  <div className="p-4 flex flex-col items-center justify-center h-full gap-4">
    <div className="flex gap-2 items-end h-24 w-full justify-center">
      {[40, 70, 55, 90, 65, 80].map((h, i) => (
        <div 
          key={i} 
          className="bg-indigo-500 rounded-t w-4 transition-all duration-1000 ease-out shadow-sm" 
          style={{ height: `${progress > 20 ? (h * progress / 100) : 0}%` }}
        />
      ))}
    </div>
    <div className="grid grid-cols-2 gap-2 w-full max-w-[120px]">
      <div className="h-2 bg-gray-100 rounded" />
      <div className="h-2 bg-gray-100 rounded" />
    </div>
  </div>
);

export const MockReportCard: React.FC<{ progress: number }> = ({ progress }) => (
  <div className="p-4 bg-white border border-gray-100 rounded-xl shadow-lg h-full flex flex-col">
    <div className="flex items-center gap-2 mb-4 border-b pb-3">
      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-[10px]">JD</div>
      <div className="space-y-0.5">
        <div className="h-2 w-20 bg-gray-200 rounded" />
        <div className="h-1.5 w-12 bg-gray-100 rounded" />
      </div>
    </div>
    <div className="space-y-3 flex-1">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-[8px] font-bold text-gray-400">
             <span>SUBJECT {i}</span>
             <span className="text-indigo-600">{progress > (i * 30) ? (70 + i * 5) : 0}%</span>
          </div>
          <div className="h-1.5 w-full bg-gray-50 rounded-full overflow-hidden">
             <div 
               className="h-full bg-indigo-500 transition-all duration-1000 ease-out" 
               style={{ width: `${progress > (i * 30) ? (70 + i * 5) : 0}%` }}
             />
          </div>
        </div>
      ))}
    </div>
    <div className="mt-4 pt-3 border-t">
       <div className="text-[8px] text-gray-400 font-bold mb-1 uppercase tracking-tighter">Teacher's Remarks</div>
       <div className={`p-2 rounded-lg bg-gray-50 text-[9px] text-gray-600 transition-all ${progress > 80 ? 'opacity-100' : 'opacity-0'}`}>
         {progress > 80 ? 'An excellent performance this term. Keep it up!' : ''}
         {progress > 80 && progress < 100 && <span className="w-0.5 h-2 bg-gray-400 animate-pulse ml-0.5" />}
       </div>
    </div>
  </div>
);

export const MockSidebar: React.FC<{ activePage: string; isClicked?: boolean; activeBtn?: string }> = ({ activePage, isClicked, activeBtn }) => {
  const items = [
    { id: 'Dashboard', icon: LayoutDashboard },
    { id: 'school', icon: Building2, label: 'School Setup' },
    { id: 'classes', icon: Users, label: 'Classes & Teachers' },
    { id: 'subjects', icon: BookOpen, label: 'Subjects' },
    { id: 'students', icon: UserCheck, label: 'Students' },
    { id: 'grading', icon: GraduationCap, label: 'Grading System' },
    { id: 'assessment', icon: ClipboardList, label: 'Assessment Types' },
    { id: 'ScoreEntry', icon: ClipboardList, label: 'Score Entry' },
    { id: 'Reports', icon: FileText, label: 'Reports' },
    { id: 'progress', icon: BarChart3, label: 'Student Progress' },
    { id: 'Settings', icon: SettingsIcon, label: 'Settings' },
  ];

  return (
    <div className="w-14 h-full bg-white border-r border-gray-100 flex flex-col items-center py-6 gap-3 z-10 shrink-0 shadow-sm">
      <div className="w-9 h-9 bg-indigo-600 rounded-xl mb-6 flex items-center justify-center shadow-lg shadow-indigo-100">
        <GraduationCap size={20} className="text-white" />
      </div>
      {items.map((item) => (
        <div 
          key={item.id}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${activePage === item.id || activeBtn === item.id ? (isClicked && activeBtn === item.id ? 'bg-indigo-700 scale-90 text-white' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-100') : 'text-gray-400 hover:bg-gray-50'}`}
          title={item.label || item.id}
        >
          <item.icon size={18} strokeWidth={activePage === item.id ? 3 : 2} />
        </div>
      ))}
    </div>
  );
};

export const MockSchoolSetup: React.FC<{ typingField?: string; typingVal?: string }> = ({ typingField, typingVal }) => {
  const fieldValues: Record<string, string> = {
    name: 'SBA International School',
    district: 'Accra Metropolitan',
    address: '123 Education Lane, Accra',
    headmaster: 'Dr. Isaac Boateng',
    year: '2025/2026',
    term: 'First Term'
  };

  return (
    <div className="p-6 h-full bg-white flex flex-col overflow-y-auto custom-scrollbar pb-20">
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
           <h2 className="font-black text-indigo-900 text-xs uppercase tracking-widest">Institution Profile</h2>
           <div className="w-10 h-10 rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center" title="School Logo">
              <PlusCircle size={14} className="text-gray-300" />
           </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {[
            { label: 'School Name', id: 'name' },
            { label: 'District', id: 'district' },
            { label: 'School Address', id: 'address' },
            { label: 'Headmaster / Headmistress', id: 'headmaster' }
          ].map(f => (
            <div key={f.id} className="space-y-1.5">
              <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">{f.label}</label>
              <div className={`h-10 border-2 rounded-xl flex items-center px-4 text-[11px] font-bold transition-all ${typingField === f.id ? 'border-indigo-600 bg-white shadow-sm ring-4 ring-indigo-50' : 'border-gray-50 bg-gray-50/50'}`}>
                {typingField === f.id ? typingVal : (fieldValues[f.id] || '')}
                {typingField === f.id && <div className="w-0.5 h-3 bg-indigo-600 ml-0.5 animate-pulse" />}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Academic Year</label>
              <div className="h-10 border-2 border-gray-50 bg-gray-50/50 rounded-xl flex items-center px-4 text-[11px] font-bold">{fieldValues.year}</div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Term</label>
              <div className="h-10 border-2 border-gray-50 bg-gray-50/50 rounded-xl flex items-center px-4 text-[11px] font-bold">{fieldValues.term}</div>
            </div>
        </div>

        <div className="space-y-2">
            <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Head's Digital Signature</label>
            <div className="h-20 border-2 border-dashed border-indigo-100 bg-indigo-50/30 rounded-2xl flex flex-col items-center justify-center gap-1 group transition-all hover:bg-indigo-50">
               <div className="text-[9px] font-black text-indigo-600 uppercase tracking-tighter">Click to Draw or Upload</div>
               <div className="h-6 w-24 border-b border-indigo-300 relative">
                  <div className="absolute bottom-0 left-2 w-16 h-4 bg-indigo-200/50 rounded-full blur-xl animate-pulse" />
                  <span className="absolute bottom-1 left-2 font-serif text-indigo-400 opacity-50 italic text-[10px]">Isaac Boateng</span>
               </div>
            </div>
            <p className="text-[7px] text-gray-400 font-medium italic">* This signature will automatically appear on all terminal reports.</p>
        </div>

        <div className="pt-4">
          <div className="h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100">
            Save Profile
          </div>
        </div>
      </div>
    </div>
  );
};

export const MockSetupPage: React.FC<{ 
  title: string; 
  progress: number; 
  isClicked?: boolean;
  actionType?: 'add' | 'edit' | 'delete' | 'none';
}> = ({ title, progress, isClicked, actionType = 'add' }) => {
  const isPerforming = progress > 50;
  const isFinished = progress > 90;

  const initialData = useMemo(() => {
    if (title === 'classes') {
      return [
        { id: 1, name: 'Primary 4A', sub: 'Teacher: B. Mensah' },
        { id: 2, name: 'JHS 2 Blue', sub: 'Teacher: A. Boateng' },
      ];
    }
    if (title === 'grading') {
      return [
        { id: 1, name: 'Grade A (Excellent)', sub: 'Range: 80 - 100' },
        { id: 2, name: 'Grade B (Very Good)', sub: 'Range: 70 - 79' },
      ];
    }
    if (title === 'assessment') {
      return [
        { id: 1, name: 'Class Work', sub: 'Weight: 30%' },
        { id: 2, name: 'Terminal Exams', sub: 'Weight: 70%' },
      ];
    }
    if (title === 'progress' || title === 'charts') {
      return [
        { id: 1, name: 'First Term Average', sub: 'Score: 78.4%' },
        { id: 2, name: 'Second Term Average', sub: 'Score: 82.1%' },
      ];
    }
    if (title === 'subjects') {
      return [
        { id: 1, name: 'Mathematics', sub: 'Code: MATH' },
        { id: 2, name: 'English Language', sub: 'Code: ENGL' },
      ];
    }
    return [
        { id: 1, name: 'John Mensah', sub: 'ID: SBA-001' },
        { id: 2, name: 'Sarah Smith', sub: 'ID: SBA-002' },
    ];
  }, [title]);

  return (
    <div className="p-5 space-y-5 h-full bg-gray-50/50">
        <div className="flex justify-between items-center">
            <h3 className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">{title.replace(/([A-Z])/g, ' $1')}</h3>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-lg transition-all ${isClicked && !isPerforming ? 'bg-indigo-800 scale-90' : 'bg-indigo-600'}`}>
                <PlusCircle size={16} />
            </div>
        </div>

        <div className="space-y-3">
            {initialData.map((item, idx) => (
                <div 
                  key={item.id} 
                  className={`bg-white p-4 rounded-2xl border transition-all duration-500 flex items-center justify-between ${
                    actionType === 'delete' && idx === 1 && isPerforming ? 'opacity-0 scale-95 -translate-x-10' : 
                    actionType === 'edit' && idx === 1 && isPerforming ? 'border-indigo-400 bg-indigo-50 shadow-md scale-[1.02]' : 
                    'border-gray-100 shadow-sm'
                  }`}
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold ${actionType === 'edit' && idx === 1 && isPerforming ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                          {idx === 1 && actionType === 'edit' && isPerforming ? <CheckCircle2 size={14} /> : item.id}
                        </div>
                        <div className="space-y-0.5">
                            <div className="h-3 flex items-center">
                              <span className="text-[10px] font-bold text-gray-700">
                                {actionType === 'edit' && idx === 1 && isPerforming ? (isFinished ? (title === 'classes' ? 'JHS 1 Red' : 'Updated Name') : 'Typing...') : item.name}
                              </span>
                            </div>
                            <div className="h-2 flex items-center">
                              <span className="text-[8px] text-gray-400 font-medium">{item.sub}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${actionType === 'edit' && idx === 1 && isPerforming ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-400'}`}>
                          <FileText size={12} />
                        </div>
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${actionType === 'delete' && idx === 1 && isPerforming ? 'bg-red-600 text-white' : 'bg-red-50 text-red-400'}`}>
                          <X size={12} />
                        </div>
                    </div>
                </div>
            ))}
            
            {/* Animated New Row */}
            {actionType === 'add' && isPerforming && (
                <div className="bg-white p-4 rounded-2xl border-2 border-indigo-200 shadow-xl flex items-center justify-between animate-in slide-in-from-top fade-in duration-700 bg-indigo-50/30">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white">3</div>
                        <div className="space-y-0.5">
                            <div className="h-3 flex items-center">
                              <span className="text-[10px] font-black text-indigo-900">
                                {isFinished ? (
                                    title === 'classes' ? 'JHS 3 Gold' : 
                                    title === 'subjects' ? 'Integrated Science' :
                                    title === 'grading' ? 'Grade C (Good)' :
                                    title === 'assessment' ? 'Project Work' :
                                    'Ama Serwaa'
                                ) : 'Adding...'}
                              </span>
                            </div>
                            <div className="h-2 flex items-center">
                              <span className="text-[8px] text-indigo-400 font-bold tracking-tight">
                                {title === 'classes' ? 'Teacher: K. Adjei' : 
                                 title === 'subjects' ? 'Code: SCIE' :
                                 title === 'grading' ? 'Range: 60 - 69' :
                                 title === 'assessment' ? 'Weight: 20%' :
                                 'ID: SBA-003'}
                              </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="w-7 h-7 rounded-lg bg-green-500 flex items-center justify-center text-white shadow-lg shadow-green-100">
                            <Save size={14} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export const MockSubscription: React.FC<{ step: number }> = ({ step }) => (
  <div className="p-4 space-y-4 h-full bg-white">
    <div className="grid grid-cols-2 gap-2">
      {[1, 2].map(i => (
        <div key={i} className={`p-3 rounded-xl border-2 transition-all ${step > 30 && i === 2 ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100'}`}>
          <div className="w-4 h-4 rounded-full bg-gray-100 mb-2" />
          <div className="h-2 w-12 bg-gray-200 rounded mb-1" />
          <div className="h-3 w-16 bg-indigo-100 rounded" />
        </div>
      ))}
    </div>
    {step > 60 && (
      <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100 animate-in slide-in-from-bottom duration-500">
        <div className="flex justify-between items-center mb-4">
          <div className="h-3 w-20 bg-gray-200 rounded" />
          <div className="h-3 w-10 bg-indigo-600 rounded" />
        </div>
        <div className="h-8 w-full bg-indigo-600 rounded-lg flex items-center justify-center text-white text-[10px] gap-2 shadow-md">
          <CreditCard size={12} /> Confirm Payment
        </div>
      </div>
    )}
  </div>
);
