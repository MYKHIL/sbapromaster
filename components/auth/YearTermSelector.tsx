import React, { useState, useEffect, useMemo } from 'react';
import { getSchoolYearsAndTerms, SchoolPeriod, SchoolListItem } from '../../services/firebaseService';

interface YearTermSelectorProps {
    school: SchoolListItem; // Changed from schoolName to full school object
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

    // Determine "Most Recent" logic whenever periods change
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

    // Keep years collapsed by default; expand only when the user taps/clicks.
    // We intentionally do not auto-expand the most recent year so the list
    // stays compact on load.

    const loadPeriods = async (forceRefresh: boolean = false) => {
        try {
            setLoading(true);
            setError(null);

            // Clear cache if force refresh
            if (forceRefresh) {
                const { sanitizeSchoolName } = await import('../../services/firebaseService');
                const dbSuffix = school._databaseIndex !== undefined ? `_db${school._databaseIndex}` : '';
                const cacheKey = `auth_periods_${sanitizeSchoolName(school.displayName)}${dbSuffix}`;
                localStorage.removeItem(cacheKey);
                0 && console.log('[YearTermSelector] Cache cleared, fetching fresh data');
            }

            // Pass school's database index and all associated prefixes
            const docIdPrefixes = school.allPrefixes && school.allPrefixes.length > 0 
                ? school.allPrefixes 
                : school.docId.split('_')[0];
            const periodList = await getSchoolYearsAndTerms(school.displayName, school._databaseIndex, docIdPrefixes);
            setPeriods(periodList);
        } catch (err) {
            console.error('Failed to load periods:', err);
            setError('Failed to load academic periods. Please try again.');
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
            console.warn('Failed to save MRU preference:', e);
        }

        try {
            await onSelectPeriod(period);
        } finally {
            setSelectedLoadingDocId(null);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
            <div className="w-full max-w-2xl">
                {/* Header */}
                <div className="text-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Select Academic Period</h1>
                    <p className="text-gray-600">{school.displayName}</p>
                </div>

                {/* Main Card */}
                <div className="bg-white rounded-2xl shadow-xl p-6">
                    {/* Reload Button */}
                    <div className="mb-4">
                        <button
                            onClick={() => loadPeriods(true)}
                            disabled={loading}
                            className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-700 rounded-xl transition-colors flex items-center justify-center gap-2 border-2 border-gray-200 font-medium"
                        >
                            <svg
                                className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Reload Periods</span>
                        </button>
                    </div>
                    {loading ? (
                        <div className="text-center py-12">
                            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                            <p className="mt-4 text-gray-600">Loading periods...</p>
                        </div>
                    ) : error ? (
                        <div className="text-center py-12">
                            <p className="text-red-600 mb-4">{error}</p>
                            <button
                                onClick={() => loadPeriods()}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                            >
                                Retry
                            </button>
                        </div>
                    ) : periods.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-600">No academic periods found for this school.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {groupedPeriods.map(([year, yearPeriods]) => {
                                const isExpanded = expandedYear === year;
                                const isLastAccessedYear = year === mostRecentYear;
                                return (
                                    <div key={year} className="rounded-2xl border border-slate-200 bg-slate-50 shadow-sm overflow-hidden transition-all duration-300">
                                        <button
                                            type="button"
                                            onClick={() => setExpandedYear(isExpanded ? null : year)}
                                            className={`w-full text-left px-5 py-4 flex items-center justify-between gap-4 transition-all duration-300 ${isExpanded ? 'bg-indigo-600 text-white shadow-inner' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`rounded-xl p-2 ${isExpanded ? 'bg-white/20' : 'bg-indigo-100 text-indigo-700'}`}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="text-lg font-semibold">{year}</h3>
                                                        {isLastAccessedYear && (
                                                            <span className={`inline-flex items-center text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded-full ${isExpanded ? 'bg-white/20 text-white' : 'bg-blue-600 text-white'}`}>
                                                                Last Accessed
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className={`text-sm mt-1 ${isExpanded ? 'text-indigo-100' : 'text-slate-500'}`}>{yearPeriods.length} term{yearPeriods.length === 1 ? '' : 's'}</p>
                                                </div>
                                            </div>
                                            <svg className={`h-5 w-5 transform transition-transform duration-300 ${isExpanded ? 'rotate-90' : 'rotate-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </button>

                                        <div className={`overflow-hidden transition-all duration-300 ease-out ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                                            <div className="bg-white/80 border-t border-slate-200 px-2 py-2 space-y-2">
                                                {yearPeriods.map(period => {
                                                    const isMostRecentPeriod = period.docId === mostRecentDocId;
                                                    const isSelectedLoading = period.docId === selectedLoadingDocId;
                                                    return (
                                                        <button
                                                            key={period.docId}
                                                            type="button"
                                                            onClick={() => handleSelectPeriod(period)}
                                                            disabled={Boolean(selectedLoadingDocId)}
                                                            className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-200 group flex items-center justify-between gap-4 ${isMostRecentPeriod ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-amber-50/70 border-amber-100 hover:bg-amber-100 hover:border-amber-200'} ${selectedLoadingDocId ? 'opacity-80 cursor-not-allowed' : ''}`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={`rounded-lg p-2 ${isMostRecentPeriod ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422A12.083 12.083 0 0118 20.5c0 .667-.057 1.316-.167 1.942L12 14z" />
                                                                    </svg>
                                                                </div>
                                                                <div>
                                                                    <p className="font-medium text-slate-900 flex items-center gap-2">
                                                                        <span>{period.term}</span>
                                                                        {isSelectedLoading && (
                                                                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600">
                                                                                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                                                    <circle cx="12" cy="12" r="10" strokeWidth="3" opacity="0.2" />
                                                                                    <path d="M22 12a10 10 0 00-10-10" strokeWidth="3" strokeLinecap="round" />
                                                                                </svg>
                                                                                Loading
                                                                            </span>
                                                                        )}
                                                                    </p>
                                                                    {isMostRecentPeriod && (
                                                                        <span className="text-xs text-blue-700">Last accessed term</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <svg className="h-5 w-5 text-slate-400 group-hover:text-slate-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                            </svg>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Back Button */}
                    <div className="mt-6 pt-6 border-t border-gray-200">
                        <button
                            onClick={onBack}
                            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            <span>Back</span>
                        </button>
                    </div>
                </div>

                {/* Period Count */}
                {!loading && !error && periods.length > 0 && (
                    <div className="text-center mt-4">
                        <p className="text-sm text-gray-600">
                            {periods.length} academic {periods.length === 1 ? 'period' : 'periods'} available
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default YearTermSelector;
