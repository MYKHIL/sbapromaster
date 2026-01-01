import React, { useState, useRef, useEffect } from 'react';
import { SimulationEngine, SimulationStats } from './SimulationEngine';
import {
    Play,
    Square,
    Database,
    Users,
    AlertTriangle,
    Terminal,
    Activity,
    PlusCircle,
    BarChart3,
    Server
} from 'lucide-react';

const App: React.FC = () => {
    const [logs, setLogs] = useState<string[]>([]);
    const [stats, setStats] = useState<SimulationStats>({ reads: 0, writes: 0, errors: 0, activeUsers: 0 });
    const [schoolName, setSchoolName] = useState('Test Academy');
    const [studentCount, setStudentCount] = useState(50);
    const [teacherCount, setTeacherCount] = useState(5);
    const [simUsers, setSimUsers] = useState(10);
    const [intensity, setIntensity] = useState(1);
    const [isRunning, setIsRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isSettingUp, setIsSettingUp] = useState(false);
    const [isConsoleOpen, setIsConsoleOpen] = useState(true);
    const [activeWork, setActiveWork] = useState<any[]>([]);

    const logEndRef = useRef<HTMLDivElement>(null);

    const engine = useRef<SimulationEngine>(
        new SimulationEngine(
            (msg) => setLogs(prev => [...prev.slice(-99), msg]),
            (newStats) => setStats(newStats),
            (workUpdate) => setActiveWork(prev => {
                const filtered = prev.filter(p => p.id !== workUpdate.id).slice(-4);
                return [...filtered, workUpdate];
            })
        )
    );

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const handleSetup = async () => {
        setIsSettingUp(true);
        const success = await engine.current.setupDummySchool(schoolName);
        if (success) {
            await engine.current.createDummyData(studentCount, teacherCount);
        }
        setIsSettingUp(false);
    };

    const handleToggleSim = () => {
        if (isRunning) {
            engine.current.stop();
            setIsRunning(false);
            setIsPaused(false);
        } else {
            setIsRunning(true);
            setIsPaused(false);
            engine.current.startLoadTest(schoolName, simUsers, intensity).then(() => {
                setIsRunning(false);
                setIsPaused(false);
            });
        }
    };

    const handleTogglePause = () => {
        const paused = engine.current.togglePause();
        setIsPaused(paused);
    };

    return (
        <div className="min-h-screen bg-[#0f172a] text-slate-200 p-6 font-sans">
            <header className="max-w-7xl mx-auto mb-10 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                        Firebase Load Simulator
                    </h1>
                    <p className="text-slate-400 mt-1">SBA Pro Master Quota Stress Testing Tool</p>
                </div>
                <div className="flex gap-4 items-center bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 backdrop-blur-sm">
                    <Activity className={`w-5 h-5 ${isRunning ? 'text-green-400 animate-pulse' : 'text-slate-500'}`} />
                    <span className="text-sm font-medium">{isRunning ? 'Simulation Active' : 'System Idle'}</span>
                </div>
            </header>

            <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Stats Grid */}
                <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
                    <StatCard label="Firestore Reads" value={stats.reads} icon={<Database className="text-cyan-400" />} />
                    <StatCard label="Firestore Writes" value={stats.writes} icon={<PlusCircle className="text-purple-400" />} />
                    <StatCard label="Active Users" value={stats.activeUsers} icon={<Users className="text-blue-400" />} />
                    <StatCard label="Sync Errors" value={stats.errors} icon={<AlertTriangle className="text-red-400" />} color="text-red-400" />
                </div>

                {/* Main Content Area */}
                <section className={`transition-all duration-300 ${isConsoleOpen ? 'lg:col-span-8' : 'lg:col-span-12'} flex flex-col gap-6`}>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Configuration Panel */}
                        <div className="bg-slate-800/40 border border-slate-700/50 p-6 rounded-2xl backdrop-blur-md">
                            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                                <Server className="w-5 h-5 text-cyan-400" /> Environment Setup
                            </h2>

                            <div className="space-y-4">
                                <InputGroup label="School Name" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
                                <div className="grid grid-cols-2 gap-4">
                                    <InputGroup label="Students" type="number" value={studentCount} onChange={(e) => setStudentCount(Number(e.target.value))} />
                                    <InputGroup label="Teachers" type="number" value={teacherCount} onChange={(e) => setTeacherCount(Number(e.target.value))} />
                                </div>
                                <button
                                    onClick={handleSetup}
                                    disabled={isSettingUp || isRunning}
                                    className="w-full py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-xl transition-all font-semibold flex justify-center items-center gap-2"
                                >
                                    {isSettingUp ? 'Generating...' : 'Initialize School Data'}
                                </button>
                            </div>
                        </div>

                        {/* Load Control Panel */}
                        <div className="bg-slate-800/40 border border-slate-700/50 p-6 rounded-2xl backdrop-blur-md flex flex-col">
                            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                                <Activity className="w-5 h-5 text-purple-400" /> Stress Controls
                            </h2>

                            <div className="space-y-4 flex-1">
                                <InputGroup label="Simulated Users" type="number" value={simUsers} onChange={(e) => setSimUsers(Number(e.target.value))} />
                                <div className="space-y-1">
                                    <label className="text-xs uppercase tracking-wider text-slate-500 font-bold">Intensity (Multi-multiplier)</label>
                                    <input
                                        type="range" min="1" max="10"
                                        value={intensity}
                                        onChange={(e) => setIntensity(Number(e.target.value))}
                                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                                    />
                                    <div className="flex justify-between text-[10px] text-slate-500">
                                        <span>Normal</span>
                                        <span>Heavy Load</span>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={handleToggleSim}
                                        disabled={isSettingUp}
                                        className={`flex-1 py-4 rounded-xl transition-all font-bold text-lg flex justify-center items-center gap-3 ${isRunning
                                            ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30'
                                            : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-900/20 hover:scale-[1.02]'
                                            }`}
                                    >
                                        {isRunning ? (
                                            <><Square className="w-5 h-5 fill-current" /> Stop</>
                                        ) : (
                                            <><Play className="w-5 h-5 fill-current" /> Start Test</>
                                        )}
                                    </button>

                                    {isRunning && (
                                        <button
                                            onClick={handleTogglePause}
                                            className={`px-6 rounded-xl border font-bold transition-all flex items-center justify-center ${isPaused
                                                ? 'bg-orange-500/20 text-orange-400 border-orange-500/50'
                                                : 'bg-slate-700/50 text-slate-300 border-slate-600'
                                                }`}
                                        >
                                            {isPaused ? <Play className="w-5 h-5 fill-current" /> : <div className="flex gap-1"><div className="w-1.5 h-5 bg-current rounded-full"></div><div className="w-1.5 h-5 bg-current rounded-full"></div></div>}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Live Teacher Preview (Human Realism) */}
                    <div className="bg-slate-800/40 border border-slate-700/50 p-6 rounded-2xl backdrop-blur-md flex-1">
                        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                            <Activity className="w-5 h-5 text-green-400" /> Teacher's Workspace (Live Preview)
                        </h2>

                        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                                    <tr>
                                        <th className="px-4 py-3">Student Name</th>
                                        <th className="px-4 py-3">Subject</th>
                                        <th className="px-4 py-3 text-center">Class Work (10)</th>
                                        <th className="px-4 py-3 text-center">Exam (50)</th>
                                        <th className="px-4 py-3 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {/* Show the last 5 active student records being updated */}
                                    {activeWork.map((work, idx) => (
                                        <tr key={idx} className="animate-in fade-in slide-in-from-top-1 duration-300">
                                            <td className="px-4 py-3 font-medium text-slate-200">{work.name}</td>
                                            <td className="px-4 py-3 text-slate-400 text-xs">{work.subject}</td>
                                            <td className="px-4 py-3 text-center">
                                                <div className={`inline-block w-10 py-1 rounded bg-slate-900 border ${work.typing === 'cw' ? 'border-yellow-500 animate-pulse text-yellow-400' : 'border-slate-700 text-slate-400'}`}>
                                                    {work.cw}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className={`inline-block w-10 py-1 rounded bg-slate-900 border ${work.typing === 'ex' ? 'border-yellow-500 animate-pulse text-yellow-400' : 'border-slate-700 text-slate-400'}`}>
                                                    {work.ex}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {work.status === 'saving' ? (
                                                    <span className="text-[10px] text-blue-400 animate-pulse">Saving...</span>
                                                ) : work.status === 'done' ? (
                                                    <span className="text-[10px] text-green-400 font-bold">SAVED ✅</span>
                                                ) : (
                                                    <span className="text-[10px] text-slate-600 italic">Thinking...</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {activeWork.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-10 text-center text-slate-500 italic">
                                                No active teaching sessions. Start the test to see live desktop simulation.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-4 italic border-l-2 border-slate-700 pl-3">
                            This panel shows a real-time visualization of what teachers see in their SBA Pro Master browser.
                            It maps direct Firestore writes to "human-like" typing and navigation actions.
                        </p>
                    </div>

                    {!isConsoleOpen && (
                        <button
                            onClick={() => setIsConsoleOpen(true)}
                            className="mt-4 py-2 border border-slate-700 border-dashed rounded-xl text-slate-500 flex items-center justify-center gap-2 hover:text-slate-300 hover:border-slate-500 transition-all"
                        >
                            <Terminal className="w-4 h-4" /> View Logs Console
                        </button>
                    )}
                </section>

                {/* Minimal/Collapsible Log Console */}
                {isConsoleOpen && (
                    <section className="lg:col-span-4 flex flex-col h-[600px]">
                        <div className="bg-[#020617] border border-slate-700/50 rounded-2xl flex-1 flex flex-col overflow-hidden shadow-2xl">
                            <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/20">
                                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                                    <Terminal className="w-3.5 h-3.5" /> Engine Output
                                </h2>
                                <button
                                    onClick={() => setIsConsoleOpen(false)}
                                    className="text-slate-600 hover:text-slate-400 transition-all p-1 hover:bg-slate-800 rounded-md"
                                >
                                    <Square className="w-3 h-3 rotate-45" />
                                </button>
                            </div>
                            <div className="flex-1 p-4 overflow-y-auto font-mono text-[11px] space-y-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                                {logs.length === 0 && <p className="text-slate-700 italic">Console ready...</p>}
                                {logs.map((log, i) => {
                                    const isNav = log.includes('Navigating');
                                    const isTyping = log.includes('Typing');
                                    const isSuccess = log.includes('Saved') || log.includes('successfully');
                                    const isError = log.includes('Error');
                                    const isPausedLog = log.includes('Paused');

                                    return (
                                        <div key={i} className="flex gap-2 animate-in fade-in slide-in-from-right-2 duration-300">
                                            <span className="text-slate-700 select-none opacity-50">[{i.toString().padStart(3, '0')}]</span>
                                            <span className={`
                                        ${isError ? 'text-red-500 font-bold' :
                                                    isNav ? 'text-blue-500 italic' :
                                                        isTyping ? 'text-yellow-500/80' :
                                                            isPausedLog ? 'text-orange-500 font-bold' :
                                                                isSuccess ? 'text-green-500' : 'text-slate-500'}
                                    `}>
                                                {log.includes(']') ? log.split(']')[1].trim() : log}
                                            </span>
                                        </div>
                                    );
                                })}
                                <div ref={logEndRef} />
                            </div>
                            <div className="p-2 bg-slate-900/50 text-[9px] text-slate-600 border-t border-slate-800/50 text-center uppercase tracking-widest">
                                Press Escape or Stop to end session
                            </div>
                        </div>
                    </section>
                )}

            </main>
        </div>
    );
};

const StatCard: React.FC<{ label: string; value: number; icon: React.ReactNode; color?: string }> = ({ label, value, icon, color }) => (
    <div className="bg-slate-800/40 border border-slate-700/50 p-5 rounded-2xl backdrop-blur-md flex items-center gap-4">
        <div className="p-3 bg-slate-900/50 rounded-xl">
            {icon}
        </div>
        <div>
            <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">{label}</p>
            <p className={`text-2xl font-bold font-mono ${color || 'text-white'}`}>{value.toLocaleString()}</p>
        </div>
    </div>
);

const InputGroup: React.FC<{ label: string; value: any; onChange: (e: any) => void; type?: string }> = ({ label, value, onChange, type = 'text' }) => (
    <div className="space-y-1.5">
        <label className="text-xs uppercase tracking-wider text-slate-500 font-bold">{label}</label>
        <input
            type={type}
            value={value}
            onChange={onChange}
            className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 ring-cyan-500/50 focus:border-cyan-500 transition-all text-slate-200"
        />
    </div>
);

export default App;
