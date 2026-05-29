import React, { useState, useEffect } from 'react';
import { getSchoolList, SchoolListItem } from '../../services/firebaseService';
import {
    School2,
    MapPinned,
    ArrowUpRight,
    Clock3,
    Landmark,
    Sparkles,
    Search,
    RefreshCw,
    ChevronLeft
} from "lucide-react";

interface SchoolListScreenProps {
    onSelectSchool: (school: SchoolListItem) => void;
    onBack: () => void;
}

const SchoolListScreen: React.FC<SchoolListScreenProps> = ({ onSelectSchool, onBack }) => {
    const [schools, setSchools] = useState<SchoolListItem[]>([]);
    const [filteredSchools, setFilteredSchools] = useState<SchoolListItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadSchools();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery.trim() === '') {
                loadSchools();
            } else if (searchQuery.length >= 2) {
                searchServer(searchQuery);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const searchServer = async (query: string) => {
        try {
            setLoading(true);
            const list = await getSchoolList(query);
            setFilteredSchools(list);
        } catch (err) {
            console.error('Search failed:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadSchools = async (forceRefresh: boolean = false) => {
        try {
            setLoading(true);
            setError(null);

            if (forceRefresh) {
                const { clearAuthCaches } = await import('../../services/firebaseService');
                clearAuthCaches();
            }

            const schoolList = await getSchoolList();

            const lastAccessedStr = localStorage.getItem('sba_last_accessed_school');
            let lastAccessed: SchoolListItem | null = null;
            if (lastAccessedStr) {
                try {
                    lastAccessed = JSON.parse(lastAccessedStr) as SchoolListItem;
                } catch (e) {
                    console.error('[SchoolList] Failed to parse last accessed school:', e);
                }
            }

            if (!forceRefresh && lastAccessed && !schoolList.find(s => s.docId === lastAccessed?.docId)) {
                schoolList.unshift(lastAccessed);
            }

            if (lastAccessed) {
                const targetId = lastAccessed.docId;
                schoolList.sort((a, b) => {
                    const idA = a.docId;
                    const idB = b.docId;
                    if (idA === targetId) return -1;
                    if (idB === targetId) return 1;
                    return (a.displayName || '').localeCompare(b.displayName || '');
                });
            }

            setSchools(schoolList);
            setFilteredSchools(schoolList);
        } catch (err) {
            console.error('Failed to load schools:', err);
            setError('Failed to load schools. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative flex flex-col items-center justify-center min-h-screen bg-gradient-to-tr from-slate-100 via-indigo-100 to-blue-200 px-4 py-8 sm:px-6 lg:px-8 antialiased overflow-hidden">
            
            {/* Ambient Background Glow Elements for added visual depth */}
            <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-72 h-72 sm:w-96 sm:h-96 rounded-full bg-blue-300/30 blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-72 h-72 sm:w-96 sm:h-96 rounded-full bg-indigo-300/30 blur-3xl pointer-events-none" />

            <div className="relative w-full max-w-4xl z-10 transition-all duration-300">
                
                {/* Header Section */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-indigo-600/10 backdrop-blur-md border border-indigo-600/20 text-indigo-950 font-extrabold text-xs tracking-wider uppercase mb-4 shadow-sm">
                        <Sparkles className="h-4 w-4 text-indigo-700 animate-pulse" /> 
                        Portals Gateway
                    </div>
                    <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight mb-3">
                        Select Your School
                    </h1>
                    <p className="text-slate-800 text-sm sm:text-base max-w-lg mx-auto font-medium leading-relaxed">
                        Choose from our network of registered institutions to securely access your portal.
                    </p>
                </div>

                {/* Main Glassmorphic Panel */}
                <div className="bg-white/30 backdrop-blur-2xl rounded-3xl shadow-2xl shadow-slate-900/10 border border-white/50 p-6 sm:p-10">
                    
                    {/* Controls Row */}
                    <div className="mb-6 flex gap-3">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                placeholder="Search institutions by name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-3.5 text-sm sm:text-base bg-white/50 border border-slate-300/50 rounded-2xl focus:border-indigo-600 focus:bg-white/95 focus:outline-none transition-all duration-300 placeholder:text-slate-600 font-semibold text-slate-900 shadow-inner"
                            />
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-700 pointer-events-none" />
                        </div>
                        <button
                            onClick={() => loadSchools(true)}
                            disabled={loading}
                            className="p-3.5 bg-white/50 border border-slate-300/50 hover:border-indigo-400 hover:bg-white/80 active:scale-95 disabled:opacity-50 text-slate-900 rounded-2xl transition-all duration-200 flex items-center justify-center aspect-square shadow-sm"
                            title="Reload school list"
                        >
                            <RefreshCw className={`h-5 w-5 text-slate-800 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    {/* School Grid List */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[460px] overflow-y-auto pr-2 scrollbar-thin">
                        {loading ? (
                            <div className="col-span-1 md:col-span-2 flex flex-col items-center justify-center py-20">
                                <div className="inline-block animate-spin rounded-full h-12 w-12 border-[3.5px] border-indigo-600/20 border-b-indigo-700"></div>
                                <p className="mt-5 text-sm font-black text-indigo-950 uppercase tracking-wider">Syncing database entries...</p>
                            </div>
                        ) : error ? (
                            <div className="col-span-1 md:col-span-2 text-center py-16">
                                <p className="text-base font-black text-rose-800 mb-5">{error}</p>
                                <button
                                    onClick={() => { void loadSchools(); }}
                                    className="bg-indigo-700 hover:bg-indigo-800 active:scale-95 text-white px-6 py-3 text-sm font-bold rounded-xl shadow-lg hover:shadow-indigo-700/20 transition-all duration-200"
                                >
                                    Retry Connection
                                </button>
                            </div>
                        ) : filteredSchools.length === 0 ? (
                            <div className="col-span-1 md:col-span-2 text-center py-20">
                                <p className="text-base font-bold text-slate-800">
                                    {searchQuery ? 'No institutions match your search parameters.' : 'No registered schools available.'}
                                </p>
                            </div>
                        ) : (
                            filteredSchools.map((school) => {
                                const isRecent = school.docId === localStorage.getItem('sba_last_accessed_school_id');

                                return (
                                    <div
                                        key={school.docId}
                                        onClick={async () => {
                                            const { SCHOOL_DATABASE_MAPPING, ACTIVE_DATABASE_INDEX } = await import('../../constants');
                                            let requiredIndex = school._databaseIndex;

                                            if (typeof requiredIndex !== 'number') {
                                                const schoolPrefix = school.docId.split('_')[0].toLowerCase();
                                                requiredIndex = SCHOOL_DATABASE_MAPPING[schoolPrefix];
                                            }

                                            if (typeof requiredIndex === 'number' && requiredIndex !== ACTIVE_DATABASE_INDEX) {
                                                localStorage.removeItem('sba_school_id');
                                                localStorage.removeItem('sba_school_password');
                                                localStorage.removeItem('sba_user_id');
                                                localStorage.removeItem('sba_user_password');

                                                const { clearAuthCaches } = await import('../../services/firebaseService');
                                                clearAuthCaches();

                                                localStorage.setItem('pending_school_selection', JSON.stringify(school));
                                                localStorage.setItem('active_database_index', requiredIndex.toString());
                                                localStorage.setItem('sba_last_accessed_school', JSON.stringify(school));
                                                localStorage.setItem('sba_last_accessed_school_id', school.docId);

                                                window.location.reload();
                                                return;
                                            }

                                            localStorage.setItem('sba_last_accessed_school_id', school.docId);
                                            localStorage.setItem('sba_last_accessed_school', JSON.stringify(school));
                                            onSelectSchool(school);
                                        }}
                                        className={`group relative flex flex-col gap-3 p-3 sm:p-4 rounded-2xl border cursor-pointer transition-all duration-300 shadow-lg hover:-translate-y-0.5 hover:shadow-2xl ${
                                            isRecent 
                                                ? 'border-indigo-600 bg-white/95 ring-1 ring-indigo-600/40' 
                                                : 'border-slate-200 bg-white hover:border-indigo-400 hover:bg-white'
                                        }`}
                                    >
                                        {/* Premium Subtle Internal Hover Glow Mesh */}
                                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-500/0 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                                        <div className="relative z-10 w-full">
                                            <div className="flex items-center justify-between gap-3 w-full">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className={`h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-300 shadow-sm group-hover:scale-105 ${
                                                        isRecent 
                                                            ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white' 
                                                            : 'bg-indigo-50 border border-indigo-100 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-transparent'
                                                    }`}>
                                                        <School2 className="h-5 w-5" />
                                                    </div>

                                                    <div className="min-w-0">
                                                        <h3 className={`text-sm sm:text-base font-semibold leading-tight text-slate-900 ${
                                                            isRecent 
                                                                ? 'text-indigo-950' 
                                                                : 'text-slate-700'
                                                        }`}>
                                                            {school.displayName}
                                                        </h3>
                                                    </div>
                                                </div>

                                                <div className="shrink-0">
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-300/40 bg-white/60 text-slate-950 opacity-0 group-hover:opacity-100 group-hover:border-indigo-300 group-hover:bg-indigo-700 group-hover:text-white transition-all duration-300 shadow-sm">
                                                        <ArrowUpRight className="h-4.5 w-4.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-300" />
                                                    </div>
                                                </div>
                                            </div>

                                            {(school.settings?.district || school.settings?.circuit) && (
                                                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold leading-snug">
                                                    {school.settings?.district && (
                                                        <span className="inline-flex items-center gap-1 rounded-md bg-indigo-950/10 border border-indigo-950/10 px-2 py-1 text-indigo-950">
                                                            <Landmark className="h-3 w-3 text-indigo-800" />
                                                            {school.settings.district}
                                                        </span>
                                                    )}
                                                    {school.settings?.circuit && (
                                                        <span className="inline-flex items-center gap-1 rounded-md bg-sky-950/10 border border-sky-950/10 px-2 py-1 text-sky-950">
                                                            <MapPinned className="h-3 w-3 text-sky-800" />
                                                            {school.settings.circuit}
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            <p className="mt-2 text-xs sm:text-sm text-slate-700 font-semibold leading-snug">
                                                {isRecent ? 'Resume active session' : 'Secure gateway authentication'}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Footer Row */}
                    <div className="mt-8 pt-6 border-t border-slate-300/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <button
                            onClick={onBack}
                            className="inline-flex items-center justify-center gap-1.5 px-5 py-3 bg-white/50 hover:bg-white/80 active:scale-95 text-slate-900 font-black text-sm rounded-xl transition-all duration-200 border border-slate-300/50 shadow-sm"
                        >
                            <ChevronLeft className="h-4 w-4 text-slate-900" /> Back to Authorization
                        </button>

                        {!loading && !error && (
                            <span className="text-xs text-indigo-950 font-extrabold text-center sm:text-right bg-white/45 px-4 py-2 rounded-xl border border-white/30">
                                {searchQuery ? `Discovered ${filteredSchools.length} metrics` : `Showing ${filteredSchools.length} default profiles`}
                            </span>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default SchoolListScreen;