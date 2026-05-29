import React, { useState, useEffect } from 'react';
import { getSchoolList, SchoolListItem } from '../../services/firebaseService';
import {
    School2,
    ArrowRight,
    Clock3,
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

            // Clear cache if force refresh
            if (forceRefresh) {
                const { clearAuthCaches } = await import('../../services/firebaseService');
                clearAuthCaches();
                0 && console.log('[SchoolList] Cache cleared, fetching fresh data');
            }

            const schoolList = await getSchoolList();

            // 1. GATHER LAST ACCESSED School
            const lastAccessedStr = localStorage.getItem('sba_last_accessed_school');
            let lastAccessed: SchoolListItem | null = null;
            if (lastAccessedStr) {
                try {
                    lastAccessed = JSON.parse(lastAccessedStr) as SchoolListItem;
                } catch (e) {
                    console.error('[SchoolList] Failed to parse last accessed school:', e);
                }
            }

            // 2. INJECT if missing (prevents registration race condition)
            // Skip injection on manual reload click
            if (!forceRefresh && lastAccessed && !schoolList.find(s => s.docId === lastAccessed?.docId)) {
                0 && console.log('[SchoolList] Injecting missing last accessed school into list');
                schoolList.unshift(lastAccessed);
            }

            // 3. SORT: Prioritize recent selection
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
        /* The dynamic flowing background is applied here to the entire screen viewport */
        <div className="flex flex-col items-center justify-center min-h-screen p-3 sm:p-6 antialiased selection:bg-blue-500/10 water-flow-bg">
            
            {/* Direct, high-visibility animation definitions */}
            <style>{`
                @keyframes fluidMovement {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                .water-flow-bg {
                    background: linear-gradient(-45deg, #eff6ff, #dbeafe, #bfdbfe, #e0f2fe, #f0fdf4);
                    background-size: 300% 300%;
                    animation: fluidMovement 10s ease infinite !important;
                }
            `}</style>

            <div className="w-full max-w-xl">
                
                {/* Header */}
                <div className="text-center mb-6 sm:mb-8">
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-1.5 drop-shadow-xs">
                        Select Your School
                    </h1>
                    <p className="text-slate-600 text-sm font-medium">
                        Choose from the list of registered institutions below
                    </p>
                </div>

                {/* Translucent Main Card Wrapper to let the flow shine through */}
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/40 shadow-xl overflow-hidden">
                    
                    {/* Controls Toolbar */}
                    <div className="p-3 sm:p-4 border-b border-slate-200/50 bg-white/40 flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search school name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-sm sm:text-base bg-white/90 border border-slate-200 rounded-xl placeholder-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all duration-200"
                            />
                        </div>
                        <button
                            onClick={() => loadSchools(true)}
                            disabled={loading}
                            className="p-2 sm:px-4 bg-white/90 hover:bg-white disabled:bg-slate-50/50 text-slate-600 hover:text-slate-900 rounded-xl transition-all border border-slate-200 flex items-center justify-center gap-2 text-sm font-medium shadow-2xs active:scale-95"
                            title="Reload school list"
                        >
                            <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Reload</span>
                        </button>
                    </div>

                    {/* School List Viewport */}
                    <div className="divide-y divide-slate-200/40 max-h-[460px] overflow-y-auto">
                        {loading ? (
                            <div className="text-center py-16 px-4">
                                <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-b-blue-600"></div>
                                <p className="mt-3 text-sm font-medium text-slate-500">Loading institutions...</p>
                            </div>
                        ) : error ? (
                            <div className="text-center py-16 px-6">
                                <p className="text-sm font-medium text-red-600 mb-4">{error}</p>
                                <button
                                    onClick={() => { void loadSchools(); }}
                                    className="inline-flex items-center justify-center bg-slate-900 text-white font-medium px-4 py-2 text-sm rounded-xl hover:bg-slate-800 transition-colors shadow-2xs active:scale-95"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : filteredSchools.length === 0 ? (
                            <div className="text-center py-16 px-6">
                                <p className="text-sm font-medium text-slate-500">
                                    {searchQuery ? 'No schools matched your search criteria.' : 'No schools registered yet.'}
                                </p>
                            </div>
                        ) : (
                            filteredSchools.map((school) => {
                                const isRecent = school.docId === localStorage.getItem('sba_last_accessed_school_id');

                                return (
                                    <button
                                        key={school.docId}
                                        onClick={async () => {
                                            // DATABASE SWITCH CHECK
                                            const { SCHOOL_DATABASE_MAPPING, ACTIVE_DATABASE_INDEX } = await import('../../constants');

                                            // Priority 1: Use the index discovered from global search
                                            let requiredIndex = school._databaseIndex;

                                            // Priority 2: Fallback to prefix mapping (e.g. for manually added schools or legacy)
                                            if (typeof requiredIndex !== 'number') {
                                                const schoolPrefix = school.docId.split('_')[0].toLowerCase();
                                                requiredIndex = SCHOOL_DATABASE_MAPPING[schoolPrefix];
                                            }

                                            if (typeof requiredIndex === 'number' && requiredIndex !== ACTIVE_DATABASE_INDEX) {
                                                console.warn(`[SchoolList] Switching to Database Index ${requiredIndex} for ${school.docId}`);

                                                // Clear old session data to prevent conflicts
                                                localStorage.removeItem('sba_school_id');
                                                localStorage.removeItem('sba_school_password');
                                                localStorage.removeItem('sba_user_id');
                                                localStorage.removeItem('sba_user_password');

                                                // Clear auth caches
                                                const { clearAuthCaches } = await import('../../services/firebaseService');
                                                clearAuthCaches();

                                                // Save pending selection (full object) to restore after reload
                                                localStorage.setItem('pending_school_selection', JSON.stringify(school));
                                                localStorage.setItem('active_database_index', requiredIndex.toString());
                                                localStorage.setItem('sba_last_accessed_school', JSON.stringify(school));
                                                localStorage.setItem('sba_last_accessed_school_id', school.docId);

                                                window.location.reload();
                                                return;
                                            }

                                            // Track last accessed for sorting
                                            localStorage.setItem('sba_last_accessed_school_id', school.docId);
                                            localStorage.setItem('sba_last_accessed_school', JSON.stringify(school));

                                            onSelectSchool(school);
                                        }}
                                        className={`w-full text-left p-4 flex items-center justify-between gap-3 transition-all duration-150 group relative ${
                                            isRecent 
                                                ? 'bg-blue-50/50 hover:bg-blue-100/60' 
                                                : 'bg-white/40 hover:bg-blue-50/40'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3 min-w-0 flex-1">
                                            {/* Colored School Icon Box */}
                                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-200 shadow-xs ${
                                                isRecent 
                                                    ? 'bg-blue-600 text-white border-blue-600' 
                                                    : 'bg-blue-50 text-blue-600 border-blue-100 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600'
                                            }`}>
                                                <School2 className="h-5 w-5" />
                                            </div>

                                            {/* School Details */}
                                            <div className="min-w-0 flex-1 flex flex-col gap-1">
                                                <div className="flex items-start justify-between gap-2">
                                                    <h3 className="font-bold text-slate-800 group-hover:text-blue-700 transition-colors text-sm sm:text-base leading-snug break-words pr-2">
                                                        {school.displayName}
                                                    </h3>
                                                    {isRecent && (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 text-white px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase shrink-0 shadow-xs">
                                                            <Clock3 className="h-2.5 w-2.5" />
                                                            Recent
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Meta Info Badges with Custom Emojis */}
                                                {(school.settings?.district || school.settings?.circuit) && (
                                                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                                        {school.settings?.district && (
                                                            <span className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200/60 px-1.5 py-0.5 text-xs font-medium text-slate-700 max-w-full shadow-3xs">
                                                                <span className="text-sm shrink-0">🏛️</span>
                                                                <span className="truncate"><span className="text-slate-400 font-normal">Dist:</span> {school.settings.district}</span>
                                                            </span>
                                                        )}
                                                        {school.settings?.circuit && (
                                                            <span className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200/60 px-1.5 py-0.5 text-xs font-medium text-slate-700 max-w-full shadow-3xs">
                                                                <span className="text-sm shrink-0">📍</span>
                                                                <span className="truncate"><span className="text-slate-400 font-normal">Circ:</span> {school.settings.circuit}</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Interactive Action Prompt Footer Sub-text */}
                                                <div className="flex items-center gap-1 text-[11px] font-medium text-blue-600/70 group-hover:text-blue-600 transition-colors mt-0.5">
                                                    <Sparkles className="h-3 w-3 shrink-0 text-blue-500/80" />
                                                    <span>
                                                        {isRecent ? "Continue session" : "Tap to choose school"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Arrow Display Guard */}
                                        <div className="h-7 w-7 rounded-lg border border-blue-200 bg-blue-50 flex items-center justify-center shrink-0 opacity-0 scale-95 translate-x-2 group-hover:opacity-100 group-hover:scale-100 group-hover:translate-x-0 transition-all duration-200 shadow-xs">
                                            <ArrowRight className="h-3.5 w-3.5 text-blue-600" />
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>

                    {/* Return Action Footer Element */}
                    <div className="p-3 sm:p-4 bg-white/40 border-t border-slate-200/50">
                        <button
                            onClick={onBack}
                            className="w-full bg-white hover:bg-slate-50 text-slate-700 font-semibold py-2 px-4 rounded-xl transition-all border border-slate-200 flex items-center justify-center gap-2 text-sm shadow-2xs active:scale-98"
                        >
                            <ChevronLeft className="h-4 w-4 text-slate-500" />
                            <span>Back</span>
                        </button>
                    </div>
                </div>

                {/* Sub Counter */}
                {!loading && !error && (
                    <div className="text-center mt-3">
                        <p className="text-xs font-medium text-slate-500">
                            {searchQuery ? `Found ${filteredSchools.length} matches` : `Showing ${filteredSchools.length} items`}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SchoolListScreen;