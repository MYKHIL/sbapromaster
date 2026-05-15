import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, ChevronRight, ChevronLeft, Play, Info, MousePointer2, LogIn, GraduationCap, Users, BookOpen, UserCheck, PlusCircle, ClipboardList, Volume2, VolumeX, Save, Settings } from 'lucide-react';
import { TUTORIAL_DATA, TutorialSection, TutorialStep } from '../utils/tutorialData';
import { 
  MockSidebar, 
  MockTopBar, 
  MockScoreEntry, 
  MockChart, 
  MockRegistrationForm, 
  MockSubscription, 
  MockReportCard,
  MockWelcomeScreen,
  MockCursor,
  MockSetupPage,
  MockSchoolSetup
} from './TutorialMocks';

interface TutorialOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ isOpen, onClose }) => {
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [animationProgress, setAnimationProgress] = useState(0);
  
  // Persistent Settings
  const [isAutoPlayEnabled, setIsAutoPlayEnabled] = useState(() => {
    const saved = localStorage.getItem('tutorial_autoplay');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(() => {
    const saved = localStorage.getItem('tutorial_voice');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [isAutoPlaying, setIsAutoPlaying] = useState(isAutoPlayEnabled);
  const [isClicking, setIsClicking] = useState(false);

  useEffect(() => {
    localStorage.setItem('tutorial_autoplay', JSON.stringify(isAutoPlayEnabled));
    setIsAutoPlaying(isAutoPlayEnabled);
  }, [isAutoPlayEnabled]);

  useEffect(() => {
    localStorage.setItem('tutorial_voice', JSON.stringify(isVoiceEnabled));
  }, [isVoiceEnabled]);

  const activeSection = TUTORIAL_DATA[activeSectionIndex] || TUTORIAL_DATA[0];
  const activeStep = activeSection?.steps?.[activeStepIndex] || activeSection?.steps?.[0];

  // Voice Narration and Step Synchronization
  useEffect(() => {
    if (!isOpen || !activeStep) return;

    try {
        window.speechSynthesis.cancel();
        
        if (!isVoiceEnabled) {
          if (isAutoPlaying) {
            const timer = setTimeout(handleNext, 6000);
            return () => clearTimeout(timer);
          }
          return;
        }

        const utterance = new SpeechSynthesisUtterance(activeStep.description);
        const getVoice = () => {
          const voices = window.speechSynthesis.getVoices();
          return voices.find(v => 
              v.lang.startsWith('en') && 
              (v.name.includes('Female') || v.name.includes('Zira') || v.name.includes('Samantha') || v.name.includes('Google UK English Female') || v.name.includes('Google US English Female'))
          ) || voices.find(v => v.lang.startsWith('en'));
        };

        const femaleVoice = getVoice();
        if (femaleVoice) utterance.voice = femaleVoice;
        utterance.pitch = 1.05; 
        utterance.rate = 0.85; 
        utterance.volume = 1.0;

        utterance.onend = () => {
            if (isAutoPlaying) setTimeout(handleNext, 1500);
        };

        utterance.onerror = () => {
            if (isAutoPlaying) setTimeout(handleNext, 5000);
        };

        if (window.speechSynthesis.getVoices().length === 0) {
          window.speechSynthesis.onvoiceschanged = () => {
            utterance.voice = getVoice() || null;
            window.speechSynthesis.speak(utterance);
          };
        } else {
          window.speechSynthesis.speak(utterance);
        }
    } catch (err) {
        if (isAutoPlaying) setTimeout(handleNext, 5000);
    }

    return () => {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.onvoiceschanged) window.speechSynthesis.onvoiceschanged = null;
    };
  }, [isOpen, activeSectionIndex, activeStepIndex, isAutoPlaying, isVoiceEnabled]);

  // Handle animation progress
  useEffect(() => {
    if (!isOpen) return;

    setAnimationProgress(0);
    setIsClicking(false);

    let startTime = Date.now();
    const duration = 6000; 

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(100, (elapsed / duration) * 100);
      
      setAnimationProgress(progress);

      if (progress > 85 && activeStep.action === 'click' && !isClicking) {
        setIsClicking(true);
        setTimeout(() => setIsClicking(false), 400);
      }

      if (progress < 100) {
        requestAnimationFrame(animate);
      }
    };

    const animFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame);
  }, [isOpen, activeSectionIndex, activeStepIndex]);

  const handleNext = () => {
    if (activeStepIndex < activeSection.steps.length - 1) {
      setActiveStepIndex(prev => prev + 1);
    } else if (activeSectionIndex < TUTORIAL_DATA.length - 1) {
      setActiveSectionIndex(prev => prev + 1);
      setActiveStepIndex(0);
    } else {
      setIsAutoPlaying(false);
    }
  };

  const handlePrev = () => {
    if (activeStepIndex > 0) {
      setActiveStepIndex(prev => prev - 1);
    } else if (activeSectionIndex > 0) {
      setActiveSectionIndex(prev => prev - 1);
      setActiveStepIndex(TUTORIAL_DATA[activeSectionIndex - 1].steps.length - 1);
    }
  };

  const currentMockProgress = useMemo(() => {
    if (!activeStep) return 0;
    const range = (activeStep.progressEnd || 100) - (activeStep.progressStart || 0);
    return (activeStep.progressStart || 0) + (range * animationProgress / 100);
  }, [activeStep, animationProgress]);

  const currentTypingVal = useMemo(() => {
    if (activeStep.action !== 'type' || !activeStep.typingVal) return '';
    const length = Math.floor((animationProgress / 100) * activeStep.typingVal.length);
    return activeStep.typingVal.slice(0, length);
  }, [activeStep, animationProgress]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-indigo-950/90 backdrop-blur-xl" onClick={onClose} />

      <div className="relative w-full max-w-7xl h-full max-h-[900px] bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-white/20">
        
        {/* Header - Minimal */}
        <div className="absolute top-6 left-8 z-30 flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                <Info className="text-white" size={20} strokeWidth={3} />
            </div>
            <div className="bg-white/80 backdrop-blur-md px-4 py-2 rounded-xl border border-gray-100 shadow-sm">
                <h2 className="font-black text-sm tracking-tight text-gray-800 leading-none">{activeSection.title}</h2>
                <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Step {activeStepIndex + 1} of {activeSection.steps.length}</span>
            </div>
        </div>

        {/* Top-Right Settings */}
        <div className="absolute top-6 right-8 z-30 flex items-center gap-3">
            <div className="flex items-center gap-3 bg-white/90 backdrop-blur-md p-1.5 px-3 rounded-2xl border border-gray-100 shadow-sm">
                <label className="flex items-center gap-2 cursor-pointer group">
                    <div className="relative">
                        <input type="checkbox" className="sr-only" checked={isAutoPlayEnabled} onChange={() => setIsAutoPlayEnabled(!isAutoPlayEnabled)} />
                        <div className={`w-8 h-4 rounded-full transition-colors ${isAutoPlayEnabled ? 'bg-indigo-600' : 'bg-gray-200'}`} />
                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${isAutoPlayEnabled ? 'translate-x-4' : ''}`} />
                    </div>
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">Autoplay</span>
                </label>
                <div className="w-px h-4 bg-gray-200 mx-1" />
                <label className="flex items-center gap-2 cursor-pointer group">
                    <div className="relative">
                        <input type="checkbox" className="sr-only" checked={isVoiceEnabled} onChange={() => setIsVoiceEnabled(!isVoiceEnabled)} />
                        <div className={`w-8 h-4 rounded-full transition-colors ${isVoiceEnabled ? 'bg-indigo-600' : 'bg-gray-200'}`} />
                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${isVoiceEnabled ? 'translate-x-4' : ''}`} />
                    </div>
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">Voice</span>
                </label>
            </div>
            <button onClick={onClose} className="p-2 bg-white/80 backdrop-blur-md hover:bg-white rounded-full text-gray-400 shadow-sm transition-all">
                <X size={24} />
            </button>
        </div>

        <div className="flex-1 relative flex flex-col items-center justify-center bg-gray-50 overflow-hidden p-4 md:p-8">
            {/* The Mock Device Container */}
            <div className="relative w-full max-w-[400px] h-full max-h-[800px] aspect-[9/16] bg-gray-950 rounded-[3.5rem] shadow-[0_60px_120px_-30px_rgba(0,0,0,0.5)] p-4 border-[14px] border-gray-900 overflow-hidden transition-all duration-500">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-gray-900 rounded-b-2xl z-20" />
              <div className="relative w-full h-full bg-white rounded-[2.5rem] overflow-hidden flex shadow-inner">
                {activeStep && <MockCursor x={activeStep.cursorX} y={activeStep.cursorY} isClicking={isClicking} />}
                {activeStep && !['Welcome', 'Registration', 'Subscription', 'Login'].includes(activeStep.mockPage) && (
                    <MockSidebar activePage={activeStep.mockPage} isClicked={isClicking} activeBtn={activeStep.activeBtn} />
                )}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {activeStep.mockPage === 'Welcome' ? (
                        <MockWelcomeScreen activeBtn={activeStep.activeBtn} isClicked={isClicking} />
                    ) : (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <MockTopBar title={activeStep.title} />
                            <div className="flex-1 overflow-hidden relative bg-gray-50/30">
                                {activeStep.mockPage === 'Registration' && <MockRegistrationForm typingField={activeStep.typingField} typingVal={currentTypingVal} isClicked={isClicking} />}
                                {activeStep.mockPage === 'Subscription' && <MockSubscription step={currentMockProgress} />}
                                {activeStep.mockPage === 'ScoreEntry' && <MockScoreEntry progress={currentMockProgress} typing={activeStep.action === 'type'} />}
                                {activeStep.mockPage === 'Reports' && <MockReportCard progress={currentMockProgress} />}
                                {activeStep.mockPage === 'Charts' && <MockChart progress={currentMockProgress} />}
                                {activeStep.mockPage === 'school' ? (
                                    <MockSchoolSetup typingField={activeStep.typingField} typingVal={currentTypingVal} />
                                ) : ['classes', 'students', 'grading', 'assessment', 'subjects', 'progress'].includes(activeStep.mockPage) && (
                                    <MockSetupPage 
                                        title={activeStep.mockPage} 
                                        progress={currentMockProgress} 
                                        isClicked={isClicking} 
                                        actionType={activeStep.actionType}
                                    />
                                )}
                                {activeStep.mockPage === 'Login' && (
                                    <div className="p-8 flex flex-col items-center justify-center h-full gap-6 text-center">
                                        <div className="w-16 h-16 bg-white rounded-2xl shadow-xl flex items-center justify-center text-indigo-600 animate-pulse border-2 border-indigo-50"><LogIn size={32} /></div>
                                        <div className="w-full max-w-xs space-y-3">
                                            <div className="h-10 border-2 border-indigo-100 rounded-xl bg-white flex items-center px-4 text-[10px] font-bold text-gray-400">{currentTypingVal || 'Search school...'}</div>
                                        </div>
                                    </div>
                                )}
                                {activeStep.mockPage === 'Dashboard' && (
                                    <div className="p-6 space-y-4">
                                        <div className="h-32 bg-indigo-600 rounded-2xl shadow-lg p-4 flex flex-col justify-end"><div className="h-4 w-24 bg-white/20 rounded mb-2" /><div className="h-6 w-40 bg-white rounded" /></div>
                                        <div className="grid grid-cols-2 gap-4"><div className="h-24 bg-white rounded-2xl border border-gray-100" /><div className="h-24 bg-white rounded-2xl border border-gray-100" /></div>
                                    </div>
                                )}
                                {activeStep.mockPage === 'Settings' && (
                                    <div className="p-6 space-y-6">
                                        <div className="flex items-center justify-between border-b pb-4">
                                            <h3 className="text-[10px] font-black text-indigo-900 uppercase">System Configuration</h3>
                                        </div>
                                        <div className="space-y-4">
                                            {[
                                                { label: 'Cloud Auto-Sync', val: 'Enabled' },
                                                { label: 'Data Backup', val: 'Daily at 12AM' },
                                                { label: 'Academic Year', val: '2025/2026' }
                                            ].map((s, i) => (
                                                <div key={i} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                                    <span className="text-[10px] font-bold text-gray-600">{s.label}</span>
                                                    <span className="text-[10px] font-black text-indigo-600">{s.val}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="p-4 bg-red-50 rounded-2xl border border-red-100 flex items-center justify-center gap-2">
                                            <span className="text-[9px] font-black text-red-600 uppercase">Reset System Cache</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
              </div>
            </div>

            <div className="absolute bottom-10 right-10 z-30 max-w-[300px] animate-in slide-in-from-right duration-700">
                <div className="bg-indigo-900 text-white p-6 rounded-[2rem] shadow-2xl border border-indigo-700/50 relative overflow-hidden">
                    <h3 className="text-sm font-black mb-2 tracking-tight flex items-center gap-2"><div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />{activeStep?.title || 'Loading...'}</h3>
                    <p className="text-xs text-indigo-100/90 leading-relaxed font-medium">{activeStep?.description || 'Please wait...'}</p>
                </div>
            </div>

            <div className="absolute left-8 top-1/2 -translate-y-1/2 hidden xl:flex flex-col gap-2 p-3 bg-white/80 backdrop-blur-md rounded-[2rem] border border-white/50 shadow-2xl z-40 w-56">
                <div className="px-3 py-2 mb-2 border-b border-gray-100/50"><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Tutorials</p></div>
                {TUTORIAL_DATA.map((section, idx) => (
                    <button key={section.id} onClick={() => { setActiveSectionIndex(idx); setActiveStepIndex(0); setIsAutoPlaying(false); }} className={`flex items-center gap-3 p-3 rounded-2xl transition-all group ${activeSectionIndex === idx ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-white text-gray-500'}`}>
                        <div className={`p-2 rounded-xl ${activeSectionIndex === idx ? 'bg-white/20' : 'bg-gray-100'}`}><section.icon size={18} strokeWidth={2.5} /></div>
                        <span className="text-[11px] font-bold text-left leading-tight flex-1">{section.title}</span>
                        {activeSectionIndex === idx && <ChevronRight size={14} className="animate-pulse" />}
                    </button>
                ))}
            </div>

            <div className="absolute bottom-10 left-10 z-30 flex items-center gap-3">
                <button onClick={() => setIsAutoPlaying(!isAutoPlaying)} className={`flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-md rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-sm transition-all ${isAutoPlaying ? 'text-indigo-600' : 'text-gray-400'}`}>{isAutoPlaying ? 'Playing' : 'Paused'}</button>
                <div className="flex items-center gap-2">
                    <button onClick={handlePrev} disabled={activeSectionIndex === 0 && activeStepIndex === 0} className="p-2.5 bg-white/80 backdrop-blur-md hover:bg-white rounded-xl text-gray-400 disabled:opacity-20 shadow-sm"><ChevronLeft size={20} /></button>
                    <button onClick={handleNext} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg transition-all active:scale-95">
                        {activeSectionIndex === TUTORIAL_DATA.length - 1 && activeStepIndex === activeSection.steps.length - 1 ? 'Finish' : 'Next'}<ChevronRight size={18} strokeWidth={3} />
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default TutorialOverlay;
