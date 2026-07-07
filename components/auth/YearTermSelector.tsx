import React, { useState, useEffect, useMemo } from 'react';
import { getSchoolYearsAndTerms, SchoolPeriod, SchoolListItem } from '../../services/firebaseService';

interface YearTermSelectorProps {
    school: SchoolListItem;
    onSelectPeriod: (period: SchoolPeriod) => Promise<void> | void;
    onBack: () => void;
}

const YearTermSelector: React.FC<YearTermSelectorProps> = ({ school, onSelectPeriod, onBack }) => {
    const [periods, setPeriods] = useState<SchoolPeriod[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedLoadingDocId, setSelectedLoadingDocId] = useState<string | null>(null);
    const hasFetchedRef = React.useRef(false);

    const [mostRecentDocId, setMostRecentDocId] = useState<string | null>(null);
    const [expandedYear, setExpandedYear] = useState<string | null>(null);

    const getTermRank = (term: string): number => {
        const normalized = term.toLowerCase();
        if (normalized.includes('first')) return 1;
        if (normalized.includes('second')) return 2;
        if (normalized.includes('third')) return 3;
        const numericMatch = normalized.match(/\d+/);
        return numericMatch ? Number(numericMatch[0]) : 0;
    };

    const sortedPeriods = useMemo(() => {
        return [...periods].sort((a, b) => {
            const yearCompare = b.year.localeCompare(a.year, undefined, { numeric: true });
            if (yearCompare !== 0) return yearCompare;
            return getTermRank(a.term) - getTermRank(b.term);
        });
    }, [periods]);

    const groupedPeriods = useMemo(() => {
        const groups = new Map<string, SchoolPeriod[]>();
        sortedPeriods.forEach(period => {
            if (!groups.has(period.year)) {
                groups.set(period.year, []);
            }
            groups.get(period.year)!.push(period);
        });
        return Array.from(groups.entries());
    }, [sortedPeriods]);

    const mostRecentYear = useMemo(() => {
        if (!mostRecentDocId) return null;
        return periods.find(p => p.docId === mostRecentDocId)?.year || null;
    }, [periods, mostRecentDocId]);

    useEffect(() => {
        if (hasFetchedRef.current) return;
        loadPeriods();
        hasFetchedRef.current = true;
    }, [school.docId]);

    useEffect(() => {
        if (periods.length === 0) {
            setMostRecentDocId(null);
            return;
        }

        try {
            const storageKey = `last_accessed_period_${school.docId}`;
            const lastId = localStorage.getItem(storageKey);

            if (lastId && periods.some(p => p.docId === lastId)) {
                setMostRecentDocId(lastId);
                return;
            }

            const latest = [...periods].sort((a, b) => {
                const yearCompare = b.year.localeCompare(a.year, undefined, { numeric: true });
                if (yearCompare !== 0) return yearCompare;
                return getTermRank(b.term) - getTermRank(a.term);
            })[0];

            if (latest) {
                setMostRecentDocId(latest.docId);
            }
        } catch (e) {
            console.error('Error calculating most recent period details:', e);
        }
    }, [periods, school.docId]);

    const loadPeriods = async (forceRefresh: boolean = false) => {
        try {
            setLoading(true);
            setError(null);

            if (forceRefresh) {
                const { sanitizeSchoolName } = await import('../../services/firebaseService');
                const dbSuffix = school._databaseIndex !== undefined ? `_db${school._databaseIndex}` : '';
                const cacheKey = `auth_periods_${sanitizeSchoolName(school.displayName)}${dbSuffix}`;
                localStorage.removeItem(cacheKey);
                0 && console.log('[YearTermSelector] Cache cleared, fetching fresh data');
            }

            const docIdPrefixes = school.allPrefixes && school.allPrefixes.length > 0 
                ? school.allPrefixes 
                : school.docId.split('_')[0];
            const periodList = await getSchoolYearsAndTerms(school.displayName, school._databaseIndex, docIdPrefixes);
            setPeriods(periodList);
        } catch (err) {
            console.error('Failed to load periods:', err);
            setError('Failed to load school years and terms. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectPeriod = async (period: SchoolPeriod) => {
        setSelectedLoadingDocId(period.docId);
        try {
            const storageKey = `last_accessed_period_${school.docId}`;
            localStorage.setItem(storageKey, period.docId);
        } catch (e) {
            console.warn('Failed to save user preference:', e);
        }

        try {
            await onSelectPeriod(period);
        } finally {
            setSelectedLoadingDocId(null);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-50 via-slate-50 to-emerald-50/40 p-6 selection:bg-indigo-100">
            <div className="w-full max-w-xl transition-all duration-300">
                
                {/* Header Section */}
                <div className="text-center mb-8 space-y-2">
                    <span className="inline-flex items-center px-3 py-3 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100/80 shadow-sm tracking-wide uppercase">
                        Academic Portal
                    </span>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                        Select Academic Period
                    </h1>
                    <p className="text-sm font-medium text-slate-500 max-w-md mx-auto truncate">
                        {school.displayName}
                    </p>
                </div>

                {/* Main Interaction Card */}
                <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-xl shadow-slate-200/50 p-6 space-y-6">
                    
                    {/* Actions Menu */}
                    <div className="flex gap-3">
                        <button
                            onClick={onBack}
                            className="flex items-center justify-center p-3 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all duration-200 border border-slate-200/80 shadow-sm active:scale-95"
                            title="Go Back"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        
                        <button
                            onClick={() => loadPeriods(true)}
                            disabled={loading}
                            className="flex-1 px-4 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-md shadow-slate-900/10 active:scale-[0.99]"
                        >
                            <svg
                                className={`h-4 w-4 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span className="text-sm tracking-wide">Refresh Data</span>
                        </button>
                    </div>

                    {/* Dynamic Content Frame */}
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 space-y-4">
                            <div className="relative flex items-center justify-center">
                                <div className="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-indigo-400 opacity-25"></div>
                                <div className="relative animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-indigo-600"></div>
                            </div>
                            <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase animate-pulse">Loading list...</p>
                        </div>
                    ) : error ? (
                        <div className="text-center py-10 bg-rose-50/50 rounded-xl border border-rose-100 p-4 space-y-4">
                            <p className="text-sm font-medium text-rose-600">{error}</p>
                            <button
                                onClick={() => loadPeriods()}
                                className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-xs font-semibold rounded-lg shadow-sm transition-colors"
                            >
                                Try Again
                            </button>
                        </div>
                    ) : periods.length === 0 ? (
                        <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                            <p className="text-sm text-slate-400 font-medium">No school years found for this school.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {groupedPeriods.map(([year, yearPeriods]) => {
                                const isExpanded = expandedYear === year;
                                const isLastAccessedYear = year === mostRecentYear;
                                return (
                                    <div key={year} className="group/card rounded-xl overflow-hidden transition-all duration-300">
                                        
                                        {/* Academic Year Header (Main Accordion Button) */}
                                        <button
                                            type="button"
                                            onClick={() => setExpandedYear(isExpanded ? null : year)}
                                            className={`w-full text-left px-5 py-4 flex items-center justify-between gap-4 transition-all duration-300 rounded-xl border ${
                                                isExpanded 
                                                    ? 'bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-900/20' 
                                                    : 'bg-slate-50 border-slate-200/70 text-slate-800 hover:bg-slate-100 hover:border-slate-300'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3.5">
                                                <div className={`rounded-xl p-2.5 transition-all duration-300 ${isExpanded ? 'bg-white/10 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                </div>
                                                <div className="space-y-0.5">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="text-base font-bold tracking-tight">{year}</h3>
                                                        {isLastAccessedYear && (
                                                            <span className={`inline-flex items-center text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded ${isExpanded ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'}`}>
                                                                Last Accessed
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className={`text-xs font-medium ${isExpanded ? 'text-slate-400' : 'text-slate-400'}`}>{yearPeriods.length} Term{yearPeriods.length === 1 ? '' : 's'} Available</p>
                                                </div>
                                            </div>
                                            <div className={`rounded-lg p-1 transition-all duration-200 ${isExpanded ? 'text-white rotate-90' : 'text-slate-400'}`}>
                                                <svg className="h-4 w-4 transform transition-transform duration-300 ease-in-out" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </div>
                                        </button>

                                        {/* Smooth Animation Drawer with Indented Layout */}
                                        <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}`}>
                                            <div className="overflow-hidden">
                                                {/* Left Indentation layout with branching guide-lines */}
                                                <div className="pl-9 ml-6 border-l-2 border-slate-200/70 py-1 space-y-2.5 relative">
                                                    {yearPeriods.map(period => {
                                                        const isMostRecentPeriod = period.docId === mostRecentDocId;
                                                        const isSelectedLoading = period.docId === selectedLoadingDocId;
                                                        return (
                                                            <button
                                                                key={period.docId}
                                                                type="button"
                                                                onClick={() => handleSelectPeriod(period)}
                                                                disabled={Boolean(selectedLoadingDocId)}
                                                                className={`w-full text-left px-4 py-3 rounded-xl border relative transition-all duration-200 flex items-center justify-between gap-4 group/btn hover:-translate-y-0.5 ${
                                                                    isMostRecentPeriod 
                                                                        ? 'bg-indigo-50/60 border-indigo-200 shadow-sm' 
                                                                        : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm'
                                                                } ${selectedLoadingDocId ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                            >
                                                                {/* Visual branching line connecting the term item to the main track */}
                                                                <span className="absolute -left-[26px] top-1/2 -translate-y-1/2 w-4 h-0.5 bg-slate-200/70 group-hover/btn:bg-indigo-300 transition-colors"></span>

                                                                <div className="flex items-center gap-3">
                                                                    <div className={`rounded-lg p-2 transition-colors duration-200 ${isMostRecentPeriod ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400 group-hover/btn:bg-indigo-50 group-hover/btn:text-indigo-600'}`}>
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422A12.083 12.083 0 0118 20.5c0 .667-.057 1.316-.167 1.942L12 14z" />
                                                                        </svg>
                                                                    </div>
                                                                    <div className="space-y-0.5">
                                                                        <div className="font-semibold text-sm text-slate-600 group-hover/btn:text-indigo-950 flex items-center gap-2">
                                                                            <span>{period.term}</span>
                                                                            {isSelectedLoading && (
                                                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded animate-pulse">
                                                                                    Opening...
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        {isMostRecentPeriod && (
                                                                            <span className="text-[11px] font-medium text-indigo-600/80 block">Last Selected</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <svg className="h-3.5 w-3.5 text-slate-300 group-hover/btn:text-indigo-500 group-hover/btn:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                                                </svg>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Simplified Counter Metadata Footer */}
                {!loading && !error && periods.length > 0 && (
                    <div className="text-center mt-5">
                        <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                            {periods.length} Academic Period{periods.length === 1 ? '' : 's'} available
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default YearTermSelector;