import React, { useState, useEffect } from 'react';
import { getSchoolList, SchoolListItem } from '../../services/firebaseService';

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
        // Filter schools based on search query
        if (searchQuery.trim() === '') {
            setFilteredSchools(schools);
        } else {
            const query = searchQuery.toLowerCase();
            setFilteredSchools(
                schools.filter(school =>
                    school.displayName.toLowerCase().includes(query)
                )
            );
        }
    }, [searchQuery, schools]);

    const loadSchools = async (forceRefresh: boolean = false) => {
        try {
            setLoading(true);
            setError(null);

            // Clear cache if force refresh
            if (forceRefresh) {
                const { clearAuthCaches } = await import('../../services/firebaseService');
                clearAuthCaches();
                console.log('[SchoolList] Cache cleared, fetching fresh data');
            }

            const schoolList = await getSchoolList();
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
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Select Your School</h1>
                    <p className="text-gray-600">Choose from the list of registered schools</p>
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
                                    onClick={loadSchools}
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
                            filteredSchools.map((school) => (
                                <button
                                    key={school.docId}
                                    onClick={() => onSelectSchool(school)}
                                    className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">
                                                {school.displayName}
                                            </h3>
                                            <p className="text-sm text-gray-500 mt-1">
                                                Click to continue
                                            </p>
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
                            ))
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
                            Showing {filteredSchools.length} of {schools.length} schools
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SchoolListScreen;
