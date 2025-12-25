import React, { useState, useEffect } from 'react';
import { getSchoolYearsAndTerms, SchoolPeriod, SchoolListItem } from '../../services/firebaseService';

interface YearTermSelectorProps {
    school: SchoolListItem; // Changed from schoolName to full school object
    onSelectPeriod: (period: SchoolPeriod) => void;
    onBack: () => void;
}

const YearTermSelector: React.FC<YearTermSelectorProps> = ({ school, onSelectPeriod, onBack }) => {
    const [periods, setPeriods] = useState<SchoolPeriod[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadPeriods();
    }, [school.docId]); // Changed dependency to school.docId

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
                console.log('[YearTermSelector] Cache cleared, fetching fresh data');
            }

            // Pass school's database index to ensure correct database is queried
            const periodList = await getSchoolYearsAndTerms(school.displayName, school._databaseIndex);
            setPeriods(periodList);
        } catch (err) {
            console.error('Failed to load periods:', err);
            setError('Failed to load academic periods. Please try again.');
        } finally {
            setLoading(false);
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
                                onClick={loadPeriods}
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
                        <div className="space-y-3">
                            {periods.map((period, index) => (
                                <button
                                    key={period.docId}
                                    onClick={() => onSelectPeriod(period)}
                                    className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 group ${index === 0
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:border-blue-500 hover:bg-blue-50'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">
                                                {period.year}
                                            </h3>
                                            <p className="text-sm text-gray-600 mt-1">{period.term}</p>
                                            {index === 0 && (
                                                <span className="inline-block mt-2 text-xs bg-blue-600 text-white px-2 py-1 rounded-full">
                                                    Most Recent
                                                </span>
                                            )}
                                        </div>
                                        <svg
                                            className="h-6 w-6 text-gray-400 group-hover:text-blue-600 transition-colors"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </button>
                            ))}
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
