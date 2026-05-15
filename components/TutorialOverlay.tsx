import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, ChevronRight, ChevronLeft, Play, Info, MousePointer2, LogIn, GraduationCap, Users, BookOpen, UserCheck, PlusCircle, ClipboardList, Volume2, VolumeX, Save, Settings, Menu } from 'lucide-react';
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
  const [position, setPosition] = useState({ section: 0, step: 0 });
  const [animationProgress, setAnimationProgress] = useState(0);
  const [showSectionList, setShowSectionList] = useState(false);
  
  // Reset position and show menu on mobile when opening
  useEffect(() => {
    if (isOpen) {
      setPosition({ section: 0, step: 0 });
      setIsAutoPlaying(isAutoPlayEnabled); // Reset autoplay to user preference
      
      // Auto-show menu on mobile
      if (window.innerWidth < 1280) { // xl breakpoint
        setShowSectionList(true);
      } else {
        setShowSectionList(false);
      }
    }
  }, [isOpen]);

  // Persistent Settings
  const [isAutoPlayEnabled, setIsAutoPlayEnabled] = useState(() => {
    const saved = localStorage.getItem('tutorial_autoplay');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(() => {
    const saved = localStorage.getItem('tutorial_voice');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [isAutoPlaying, setIsAutoPlaying] = useState(isAutoPlayEnabled);
  const [isClicking, setIsClicking] = useState(false);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    localStorage.setItem('tutorial_autoplay', JSON.stringify(isAutoPlayEnabled));
    if (isOpen) setIsAutoPlaying(isAutoPlayEnabled);
  }, [isAutoPlayEnabled]);

  useEffect(() => {
    localStorage.setItem('tutorial_voice', JSON.stringify(isVoiceEnabled));
  }, [isVoiceEnabled]);

  const activeSection = TUTORIAL_DATA[position.section] || TUTORIAL_DATA[0];
  const activeStep = activeSection.steps[position.step] || activeSection.steps[0];

  const handleNext = () => {
    setPosition(prev => {
      const currentSection = TUTORIAL_DATA[prev.section] || TUTORIAL_DATA[0];
      if (prev.step < currentSection.steps.length - 1) {
        return { ...prev, step: prev.step + 1 };
      } else if (prev.section < TUTORIAL_DATA.length - 1) {
        return { section: prev.section + 1, step: 0 };
      }
      
      // If we're at the very end and click next/finish
      onClose();
      return prev;
    });
  };

  const handlePrev = () => {
    setPosition(prev => {
      if (prev.step > 0) {
        return { ...prev, step: prev.step - 1 };
      } else if (prev.section > 0) {
        const prevSection = TUTORIAL_DATA[prev.section - 1];
        return { section: prev.section - 1, step: prevSection.steps.length - 1 };
      }
      return prev;
    });
  };

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
        speechRef.current = utterance;

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
  }, [isOpen, position.section, position.step, isAutoPlaying, isVoiceEnabled]);

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
  }, [isOpen, position.section, position.step]);

  const currentMockProgress = useMemo(() => {
    if (!activeStep) return 0;
    const range = (activeStep.progressEnd || 100) - (activeStep.progressStart || 0);
    return (activeStep.progressStart || 0) + (range * animationProgress / 100);
  }, [activeStep, animationProgress]);

  const currentTypingVal = useMemo(() => {
    if (!activeStep || activeStep.action !== 'type' || !activeStep.typingVal) return '';
    const length = Math.floor((animationProgress / 100) * activeStep.typingVal.length);
    return activeStep.typingVal.slice(0, length);
  }, [activeStep, animationProgress]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-indigo-950 md:bg-indigo-950/90 md:backdrop-blur-xl" onClick={onClose} />

      <div className="relative w-full h-full md:w-[95%] md:h-[90%] max-w-7xl md:max-h-[900px] bg-white md:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border-none md:border md:border-white/20">
        
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-[60] flex items-center justify-between p-4 md:p-6 bg-gradient-to-b from-white/95 to-white/50 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none">
            <div className="flex items-center gap-2 md:gap-4">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-indigo-600 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                    <Info className="text-white" size={16} md:size={20} strokeWidth={3} />
                </div>
                <div className="flex flex-col">
                    <h2 className="font-black text-xs md:text-sm tracking-tight text-gray-800 leading-none">{activeSection.title}</h2>
                    <span className="text-[9px] md:text-[10px] font-bold text-gray-400 tracking-widest uppercase">Step {position.step + 1} of {activeSection.steps.length}</span>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {/* Mobile Menu Toggle */}
                <button 
                  onClick={() => setShowSectionList(!showSectionList)}
                  className="xl:hidden p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200"
                >
                  <Menu size={18} />
                </button>
                <button onClick={onClose} className="p-2 bg-gray-100 md:bg-white/80 rounded-full text-gray-400 hover:text-red-500 shadow-sm transition-all">
                    <X size={18} md:size={24} />
                </button>
            </div>
        </div>

        {/* Floating Settings - Visible on Desktop */}
        <div className="hidden md:flex absolute top-6 right-20 z-30 items-center gap-3">
            <div className="flex items-center gap-3 bg-white/90 backdrop-blur-md p-1.5 px-3 rounded-2xl border border-gray-100 shadow-sm">
                <label className="flex items-center gap-2 cursor-pointer group">
                    <div className="relative">
                        <input type="checkbox" className="sr-only" checked={isAutoPlayEnabled} onChange={() => setIsAutoPlayEnabled(!isAutoPlayEnabled)} />
                        <div className={`w-8 h-4 rounded-full transition-colors ${isAutoPlayEnabled ? 'bg-indigo-600' : 'bg-gray-200'}`} />
                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${isAutoPlayEnabled ? 'translate-x-4' : ''}`} />
                    </div>
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-tight">Autoplay</span>
                </label>
                <div className="w-px h-4 bg-gray-200 mx-1" />
                <label className="flex items-center gap-2 cursor-pointer group">
                    <div className="relative">
                        <input type="checkbox" className="sr-only" checked={isVoiceEnabled} onChange={() => setIsVoiceEnabled(!isVoiceEnabled)} />
                        <div className={`w-8 h-4 rounded-full transition-colors ${isVoiceEnabled ? 'bg-indigo-600' : 'bg-gray-200'}`} />
                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${isVoiceEnabled ? 'translate-x-4' : ''}`} />
                    </div>
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-tight">Voice</span>
                </label>
            </div>
        </div>

        <div className="flex-1 relative flex flex-col items-center justify-center bg-gray-50 overflow-hidden">
            
            {/* The Mock Device Container */}
            <div className={`relative w-full h-full flex flex-col items-center justify-center md:p-8 transition-all duration-500 ${showSectionList ? 'blur-sm scale-95 opacity-50' : ''}`}>
              <div className="relative w-full h-full max-w-[400px] md:max-h-[800px] md:aspect-[9/16] bg-gray-950 md:rounded-[3.5rem] shadow-[0_60px_120px_-30px_rgba(0,0,0,0.5)] md:p-4 md:border-[14px] border-gray-900 overflow-hidden flex flex-col">
                {/* Notch on Desktop */}
                <div className="hidden md:block absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-gray-900 rounded-b-2xl z-20" />
                
                <div className="relative flex-1 bg-white md:rounded-[2.5rem] overflow-hidden flex shadow-inner">
                    {activeStep && <MockCursor x={activeStep.cursorX} y={activeStep.cursorY} isClicking={isClicking} />}
                    {activeStep && !['Welcome', 'Registration', 'Subscription', 'Login'].includes(activeStep.mockPage) && (
                        <MockSidebar activePage={activeStep.mockPage} isClicked={isClicking} activeBtn={activeStep.activeBtn} />
                    )}
                    <div className="flex-1 flex flex-col overflow-hidden pt-14 md:pt-0">
                        {activeStep && activeStep.mockPage === 'Welcome' ? (
                            <MockWelcomeScreen activeBtn={activeStep.activeBtn} isClicked={isClicking} />
                        ) : (
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <MockTopBar title={activeStep?.title || ''} />
                                <div className="flex-1 overflow-hidden relative bg-gray-50/30">
                                    {activeStep?.mockPage === 'Registration' && <MockRegistrationForm typingField={activeStep.typingField} typingVal={currentTypingVal} isClicked={isClicking} />}
                                    {activeStep?.mockPage === 'Subscription' && <MockSubscription step={currentMockProgress} />}
                                    {activeStep?.mockPage === 'ScoreEntry' && <MockScoreEntry progress={currentMockProgress} typing={activeStep.action === 'type'} />}
                                    {activeStep?.mockPage === 'Reports' && <MockReportCard progress={currentMockProgress} />}
                                    {activeStep?.mockPage === 'Charts' && <MockChart progress={currentMockProgress} />}
                                    {activeStep?.mockPage === 'school' ? (
                                        <MockSchoolSetup typingField={activeStep.typingField} typingVal={currentTypingVal} />
                                    ) : activeStep && ['classes', 'students', 'grading', 'assessment', 'subjects', 'progress'].includes(activeStep.mockPage) && (
                                        <MockSetupPage 
                                            title={activeStep.mockPage} 
                                            progress={currentMockProgress} 
                                            isClicked={isClicking} 
                                            actionType={activeStep.actionType}
                                        />
                                    )}
                                    {activeStep?.mockPage === 'Login' && (
                                        <div className="p-8 flex flex-col items-center justify-center h-full gap-6 text-center">
                                            <div className="w-16 h-16 bg-white rounded-2xl shadow-xl flex items-center justify-center text-indigo-600 animate-pulse border-2 border-indigo-50"><LogIn size={32} /></div>
                                            <div className="w-full max-w-xs space-y-3">
                                                <div className="h-10 border-2 border-indigo-100 rounded-xl bg-white flex items-center px-4 text-[10px] font-bold text-gray-400">{currentTypingVal || 'Search school...'}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
              </div>
            </div>

            {/* Step Description */}
            <div className={`absolute bottom-[100px] left-4 right-4 md:left-auto md:bottom-24 md:right-10 z-30 transition-all duration-500 ${showSectionList ? 'opacity-0 translate-y-10' : 'opacity-100 translate-y-0'}`}>
                <div className="bg-indigo-900/95 backdrop-blur-md text-white p-5 md:p-6 rounded-2xl md:rounded-[2rem] shadow-2xl border border-white/10 md:max-w-[300px]">
                    <h3 className="text-xs md:text-sm font-black mb-1.5 tracking-tight flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      {activeStep?.title}
                    </h3>
                    <p className="text-[10px] md:text-xs text-indigo-100/90 leading-relaxed font-medium">{activeStep?.description}</p>
                </div>
            </div>

            {/* Navigation Controls */}
            <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 md:p-0 md:bg-transparent md:border-none md:static md:flex items-center justify-between z-[70]">
              <div className="flex items-center justify-between md:absolute md:bottom-10 md:left-10 md:right-10">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setIsAutoPlaying(!isAutoPlaying)} 
                    className={`flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-gray-100 md:bg-white/80 backdrop-blur-md rounded-xl font-bold text-[9px] md:text-[10px] uppercase tracking-widest shadow-sm transition-all ${isAutoPlaying ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400'}`}
                  >
                    {isAutoPlaying ? 'Playing' : 'Paused'}
                  </button>
                  <button 
                    onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
                    className={`md:hidden flex items-center justify-center w-9 h-9 rounded-xl transition-all ${isVoiceEnabled ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-50 text-gray-400'}`}
                  >
                    {isVoiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={handlePrev} disabled={position.section === 0 && position.step === 0} className="p-2.5 bg-gray-100 md:bg-white/80 backdrop-blur-md hover:bg-white rounded-xl text-gray-400 disabled:opacity-20 shadow-sm"><ChevronLeft size={20} /></button>
                    <button onClick={handleNext} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg transition-all active:scale-95">
                        {position.section === TUTORIAL_DATA.length - 1 && position.step === activeSection.steps.length - 1 ? 'Finish' : 'Next'}<ChevronRight size={18} strokeWidth={3} />
                    </button>
                </div>
              </div>
            </div>

            {/* Slide-out Menu */}
            <div className={`absolute left-0 top-0 bottom-0 z-[100] w-full max-w-xs bg-white shadow-2xl transition-transform duration-500 transform xl:hidden ${showSectionList ? 'translate-x-0' : '-translate-x-full'}`}>
              <div className="flex flex-col h-full">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-indigo-50">
                  <p className="text-xs font-black text-indigo-900 uppercase tracking-widest">Tutorial Tracks</p>
                  <button onClick={() => setShowSectionList(false)} className="p-1.5 bg-white rounded-lg text-gray-400"><X size={16} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {TUTORIAL_DATA.map((section, idx) => (
                      <button key={section.id} onClick={() => { setPosition({ section: idx, step: 0 }); setIsAutoPlaying(false); setShowSectionList(false); }} className={`flex items-center gap-3 p-3 rounded-2xl transition-all group ${position.section === idx ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-gray-50 text-gray-500'}`}>
                          <div className={`p-2 rounded-xl ${position.section === idx ? 'bg-white/20' : 'bg-gray-100'}`}><section.icon size={18} strokeWidth={2.5} /></div>
                          <span className="text-[11px] font-bold text-left leading-tight flex-1">{section.title}</span>
                          {position.section === idx && <ChevronRight size={14} className="animate-pulse" />}
                      </button>
                  ))}
                </div>
                <div className="p-6 bg-gray-50 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Autoplay</span>
                    <input type="checkbox" checked={isAutoPlayEnabled} onChange={() => setIsAutoPlayEnabled(!isAutoPlayEnabled)} className="w-4 h-4 text-indigo-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop Left Sidebar */}
            <div className="absolute left-8 top-1/2 -translate-y-1/2 hidden xl:flex flex-col gap-2 p-3 bg-white/80 backdrop-blur-md rounded-[2rem] border border-white/50 shadow-2xl z-40 w-56">
                <div className="px-3 py-2 mb-2 border-b border-gray-100/50"><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Tutorials</p></div>
                {TUTORIAL_DATA.map((section, idx) => (
                    <button key={section.id} onClick={() => { setPosition({ section: idx, step: 0 }); setIsAutoPlaying(false); }} className={`flex items-center gap-3 p-3 rounded-2xl transition-all group ${position.section === idx ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-white text-gray-500'}`}>
                        <div className={`p-2 rounded-xl ${position.section === idx ? 'bg-white/20' : 'bg-gray-100'}`}><section.icon size={18} strokeWidth={2.5} /></div>
                        <span className="text-[11px] font-bold text-left leading-tight flex-1">{section.title}</span>
                        {position.section === idx && <ChevronRight size={14} className="animate-pulse" />}
                    </button>
                ))}
            </div>

        </div>
      </div>
    </div>
  );
};

export default TutorialOverlay;
