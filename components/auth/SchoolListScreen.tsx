import React, { useState, useEffect } from 'react';
import { getSchoolList, SchoolListItem } from '../../services/firebaseService';
import {
    School2,
    MapPinned,
    ArrowUpRight,
    Clock3,
    Landmark,
    Sparkles
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
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
            <div className="w-full max-w-2xl">
                {/* Header */}
                <div className="text-center mb-6">
                    <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-2 leading-tight">Select Your School</h1>
                    <p className="text-gray-600 text-sm md:text-base">Choose from the list of registered schools</p>
                </div>

                {/* Main Card */}
                <div className="bg-white rounded-2xl shadow-xl p-6">
                    {/* Search Bar with Reload Button */}
                    <div className="mb-6 flex gap-3">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                placeholder="Search schools..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                            />
                            <svg
                                className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <button
                            onClick={() => loadSchools(true)}
                            disabled={loading}
                            className="px-4 py-3 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-700 rounded-xl transition-colors flex items-center gap-2 border-2 border-gray-200"
                            title="Reload school list"
                        >
                            <svg
                                className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span className="hidden sm:inline">Reload</span>
                        </button>
                    </div>

                    {/* School List */}
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {loading ? (
                            <div className="text-center py-12">
                                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                                <p className="mt-4 text-gray-600">Loading schools...</p>
                            </div>
                        ) : error ? (
                            <div className="text-center py-12">
                                <p className="text-red-600 mb-4">{error}</p>
                                <button
                                    onClick={() => { void loadSchools(); }}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : filteredSchools.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-gray-600">
                                    {searchQuery ? 'No schools found matching your search.' : 'No schools registered yet.'}
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
                                        className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 group ${isRecent ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 hover:border-blue-500 hover:bg-blue-50'}`}
                                        >
                                        <div className="relative overflow-hidden rounded-3xl border border-gray-200/70 bg-white shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 group">

                                            {/* Background Glow */}
                                            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                            {/* Decorative Blur */}
                                            <div className="absolute -top-10 -right-10 h-28 w-28 bg-blue-200/30 blur-3xl rounded-full group-hover:scale-125 transition-transform duration-500" />

                                            <div className="relative flex items-center justify-between p-5">

                                                {/* LEFT SECTION */}
                                                <div className="flex items-start gap-4 min-w-0">

                                                    {/* School Icon */}
                                                    <div className="relative shrink-0">
                                                        <div className="absolute inset-0 rounded-2xl bg-blue-500 blur-md opacity-20 group-hover:opacity-40 transition-opacity" />

                                                        <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200 group-hover:scale-105 transition-transform duration-300">
                                                            <School2 className="h-7 w-7 text-white" />
                                                        </div>
                                                    </div>

                                                    {/* TEXT CONTENT */}
                                                    <div className="min-w-0">

                                                        {/* Name + Badge */}
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <h3 className="text-base md:text-xl font-extrabold tracking-tight text-gray-900 truncate group-hover:text-blue-700 transition-colors leading-snug">
                                                                {school.displayName}
                                                            </h3>

                                                            {isRecent && (
                                                                <div className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-md">
                                                                    <Clock3 className="h-3.5 w-3.5" />
                                                                    Recent
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Location Pills */}
                                                        {(school.settings?.district || school.settings?.circuit) && (
                                                            <div className="flex flex-wrap items-center gap-2 mt-2">

                                                                {school.settings?.district && (
                                                                    <div className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm font-medium text-gray-700">
                                                                        <Landmark className="h-4 w-4 text-blue-500" />
                                                                        {school.settings.district}
                                                                    </div>
                                                                )}

                                                                {school.settings?.circuit && (
                                                                    <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                                                                        <MapPinned className="h-4 w-4" />
                                                                        {school.settings.circuit}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Bottom Action Text */}
                                                        <div className="mt-3 flex items-center gap-2 text-sm md:text-base font-medium text-gray-600 group-hover:text-blue-600 transition-colors">
                                                            <Sparkles className="h-4 w-4" />
                                                            <span className="leading-snug">
                                                                {isRecent
                                                                    ? "Continue your previous session"
                                                                    : "Click / Tap to Login"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* RIGHT ACTION */}
                                                <div className="shrink-0">
                                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm group-hover:border-blue-200 group-hover:bg-blue-50 group-hover:shadow-md transition-all duration-300">
                                                        <ArrowUpRight className="h-5 w-5 text-gray-500 group-hover:text-blue-600 group-hover:scale-110 transition-all duration-300" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>

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

                {/* Results Count */}
                {!loading && !error && (
                    <div className="text-center mt-4">
                        <p className="text-sm text-gray-600">
                            {searchQuery ? `Found ${filteredSchools.length} matches` : `Showing ${filteredSchools.length} recommended schools`}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SchoolListScreen;
