import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { previewIndexNumber, validateIndexNumberConfig } from '../utils/indexNumberGenerator';
import { reassignAllIndexNumbers } from '../utils/indexNumberReassign';
import ConfirmationModal from './ConfirmationModal';
import type { Class } from '../types';
import { sortClassesByName } from '../utils/classSort';

const IndexNumberConfig: React.FC = () => {
    const { settings, classes, students, scores, reportData, loadImportedData, updateClass } = useData();

    // Local state for configuration
    const [globalPrefix, setGlobalPrefix] = useState(settings.indexNumberGlobalPrefix || '');
    const [globalSuffix, setGlobalSuffix] = useState(settings.indexNumberGlobalSuffix || '');
    const [counterDigits, setCounterDigits] = useState(settings.indexNumberCounterDigits || 3);
    const [perClass, setPerClass] = useState(settings.indexNumberPerClass || false);
    const [autoSort, setAutoSort] = useState(settings.indexNumberAutoSort || false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Modal states
    const [showEnableModal, setShowEnableModal] = useState(false);
    const [showReassignModal, setShowReassignModal] = useState(false);
    const [pendingEnableState, setPendingEnableState] = useState(false);

    // Update local state when settings change
    useEffect(() => {
        setGlobalPrefix(settings.indexNumberGlobalPrefix || '');
        setGlobalSuffix(settings.indexNumberGlobalSuffix || '');
        setCounterDigits(settings.indexNumberCounterDigits || 3);
        setPerClass(settings.indexNumberPerClass || false);
        setAutoSort(settings.indexNumberAutoSort || false);
    }, [settings]);

    const handleToggleAutoAssignClick = () => {
        const newValue = !settings.autoAssignIndexNumbers;

        if (newValue) {
            // Enabling auto-assignment - ask about existing students
            setPendingEnableState(true);
            setShowEnableModal(true);
        } else {
            // Disabling auto-assignment - just do it
            loadImportedData({ settings: { ...settings, autoAssignIndexNumbers: false } }, false);
            setSuccess('Auto-assignment disabled. Click SAVE to persist.');
            setTimeout(() => setSuccess(null), 3000);
        }
    };

    const handleConfirmEnable = (regenerateExisting: boolean) => {
        setShowEnableModal(false);

        if (regenerateExisting && students.length > 0) {
            // Regenerate all index numbers
            regenerateAllIndexNumbers();
        }

        // Enable auto-assignment
        loadImportedData({ settings: { ...settings, autoAssignIndexNumbers: true } }, false);
        setSuccess('Auto-assignment enabled. Click SAVE to persist changes.');
        setTimeout(() => setSuccess(null), 3000);
    };

    const handleCancelEnable = () => {
        setShowEnableModal(false);
        setPendingEnableState(false);
    };

    const regenerateAllIndexNumbers = () => {
        try {
            // Generate new index numbers for all students
            const sortAlphabetically = settings.indexNumberAutoSort || false;
            const updatedStudents = reassignAllIndexNumbers(students, classes, settings, sortAlphabetically);

            // Update scores and report data to match new index numbers
            const updatedScores = scores.map(score => {
                const oldStudent = students.find(s => s.id === score.studentId);
                const newStudent = updatedStudents.find(s => s.id === score.studentId);
                if (oldStudent && newStudent && oldStudent.indexNumber !== newStudent.indexNumber) {
                    // Index number changed - we just update the student reference, score ID stays the same
                    return score; // Score ID is based on studentId-subjectId, not index number
                }
                return score;
            });

            // Update report data
            const updatedReportData = reportData.map(report => {
                const oldStudent = students.find(s => s.id === report.studentId);
                const newStudent = updatedStudents.find(s => s.id === report.studentId);
                if (oldStudent && newStudent && oldStudent.indexNumber !== newStudent.indexNumber) {
                    // Just return as-is, report data keys by studentId not index number
                    return report;
                }
                return report;
            });

            // Update all data at once
            loadImportedData({
                students: updatedStudents,
                scores: updatedScores,
                reportData: updatedReportData,
            }, false);

            setSuccess('All student index numbers have been regenerated. Click SAVE to persist.');
            setTimeout(() => setSuccess(null), 5000);
        } catch (err) {
            setError(`Failed to regenerate index numbers: ${err}`);
        }
    };

    const handleSaveGlobalConfig = () => {
        setError(null);

        // Validate
        const validationError = validateIndexNumberConfig(globalPrefix, globalSuffix, counterDigits);
        if (validationError) {
            setError(validationError);
            return;
        }

        // Update settings
        loadImportedData({
            settings: {
                ...settings,
                indexNumberGlobalPrefix: globalPrefix,
                indexNumberGlobalSuffix: globalSuffix,
                indexNumberCounterDigits: counterDigits,
                indexNumberPerClass: perClass,
                indexNumberAutoSort: autoSort,
            }
        }, false);

        setSuccess('Configuration updated. Click SAVE to persist changes.');
        setTimeout(() => setSuccess(null), 3000);
    };

    const handleReassignAll = () => {
        setShowReassignModal(true);
    };

    const handleConfirmReassign = () => {
        setShowReassignModal(false);
        regenerateAllIndexNumbers();
    };

    const handleUpdateClassConfig = (classId: number, prefix: string, suffix: string) => {
        const classObj = classes.find(c => c.id === classId);
        if (!classObj) return;

        const updatedClass = {
            ...classObj,
            indexNumberPrefix: prefix,
            indexNumberSuffix: suffix,
        };

        updateClass(updatedClass);
        setSuccess('Class configuration updated. Click SAVE to persist changes.');
        setTimeout(() => setSuccess(null), 3000);
    };

    return (
        <div className="bg-white p-8 rounded-xl shadow-md border border-gray-200 space-y-6">
            <h2 className="text-xl font-bold text-gray-700 border-b pb-2">Student Index Number Configuration</h2>
            <p className="text-gray-600">
                Configure automatic assignment of student index numbers with flexible prefix/suffix options.
            </p>

            {/* Error/Success Messages */}
            {error && (
                <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-md">
                    {error}
                </div>
            )}
            {success && (
                <div className="p-3 bg-green-100 border border-green-300 text-green-800 rounded-md">
                    {success}
                </div>
            )}

            {/* Toggle Auto-Assignment */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                    <h3 className="font-semibold text-gray-800">Enable Auto-Assignment</h3>
                    <p className="text-sm text-gray-600 mt-1">
                        When enabled, index numbers will be automatically generated and locked for all students.
                    </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={settings.autoAssignIndexNumbers || false}
                        onChange={handleToggleAutoAssignClick}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>

            {/* Configuration Panel (only shown when enabled) */}
            {settings.autoAssignIndexNumbers && (
                <div className="space-y-6 border-t pt-6">
                    {/* Global Configuration */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-gray-800 text-lg">Global Settings</h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Global Prefix
                                </label>
                                <input
                                    type="text"
                                    value={globalPrefix}
                                    onChange={(e) => setGlobalPrefix(e.target.value)}
                                    placeholder="e.g., 0220009"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                                <p className="mt-1 text-xs text-gray-500">Added to the start of all index numbers</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Counter Digits
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={counterDigits}
                                    onChange={(e) => setCounterDigits(parseInt(e.target.value) || 3)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                                <p className="mt-1 text-xs text-gray-500">Number of digits (with leading zeros)</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Global Suffix
                                </label>
                                <input
                                    type="text"
                                    value={globalSuffix}
                                    onChange={(e) => setGlobalSuffix(e.target.value)}
                                    placeholder="e.g., 25"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                                <p className="mt-1 text-xs text-gray-500">Added to the end of all index numbers</p>
                            </div>
                        </div>

                        {/* Options */}
                        <div className="space-y-3">
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="perClass"
                                    checked={perClass}
                                    onChange={(e) => setPerClass(e.target.checked)}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor="perClass" className="ml-2 block text-sm text-gray-700">
                                    Use per-class counters (each class restarts from 1)
                                </label>
                            </div>

                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="autoSort"
                                    checked={autoSort}
                                    onChange={(e) => setAutoSort(e.target.checked)}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor="autoSort" className="ml-2 block text-sm text-gray-700">
                                    Sort students alphabetically before assigning index numbers
                                </label>
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="bg-blue-50 p-4 rounded-md">
                            <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
                            <p className="text-lg font-mono text-blue-900">
                                {previewIndexNumber(
                                    {
                                        ...settings,
                                        indexNumberGlobalPrefix: globalPrefix,
                                        indexNumberGlobalSuffix: globalSuffix,
                                        indexNumberCounterDigits: counterDigits,
                                    },
                                    undefined
                                )}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                                This is what the next index number will look like (without class-specific prefix/suffix)
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleSaveGlobalConfig}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-colors"
                            >
                                Save Global Configuration
                            </button>

                            {students.length > 0 && (
                                <button
                                    onClick={handleReassignAll}
                                    className="px-6 py-2 bg-orange-600 text-white rounded-lg shadow hover:bg-orange-700 transition-colors"
                                >
                                    Reassign All Index Numbers
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Class-Specific Configuration */}
                    {perClass && (
                        <div className="space-y-4 border-t pt-6">
                            <h3 className="font-semibold text-gray-800 text-lg">Class-Specific Settings</h3>
                            <p className="text-sm text-gray-600">
                                Configure prefix and suffix for each class (added between global prefix/suffix and counter)
                            </p>

                            <div className="space-y-3">
                                {sortClassesByName(classes).map((classObj) => (
                                    <div key={classObj.id} className="p-4 border border-gray-200 rounded-lg">
                                        <h4 className="font-medium text-gray-800 mb-3">{classObj.name}</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Class Prefix
                                                </label>
                                                <input
                                                    type="text"
                                                    value={classObj.indexNumberPrefix || ''}
                                                    onChange={(e) => handleUpdateClassConfig(classObj.id, e.target.value, classObj.indexNumberSuffix || '')}
                                                    placeholder="Optional"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Class Suffix
                                                </label>
                                                <input
                                                    type="text"
                                                    value={classObj.indexNumberSuffix || ''}
                                                    onChange={(e) => handleUpdateClassConfig(classObj.id, classObj.indexNumberPrefix || '', e.target.value)}
                                                    placeholder="Optional"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                                                />
                                            </div>
                                        </div>
                                        <div className="mt-2 bg-gray-50 p-2 rounded">
                                            <p className="text-xs text-gray-600">Preview: </p>
                                            <p className="font-mono text-sm text-gray-900">
                                                {previewIndexNumber(
                                                    {
                                                        ...settings,
                                                        indexNumberGlobalPrefix: globalPrefix,
                                                        indexNumberGlobalSuffix: globalSuffix,
                                                        indexNumberCounterDigits: counterDigits,
                                                    },
                                                    classObj
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Enable Auto-Assignment Confirmation Modal */}
            <ConfirmationModal
                isOpen={showEnableModal}
                onClose={handleCancelEnable}
                onConfirm={() => handleConfirmEnable(true)}
                title="Enable Auto-Assignment"
                message={`You are about to enable automatic index number assignment. ${students.length > 0 ? 'Would you like to regenerate index numbers for all existing students based on the current configuration?' : ''}`}
                confirmText={students.length > 0 ? "Yes, Regenerate All" : "Enable"}
                cancelText="Cancel"
                variant="info"
                additionalAction={students.length > 0 ? () => handleConfirmEnable(false) : undefined}
                additionalActionText={students.length > 0 ? "No, Only New Students" : undefined}
            />

            {/* Reassign All Confirmation Modal */}
            <ConfirmationModal
                isOpen={showReassignModal}
                onClose={() => setShowReassignModal(false)}
                onConfirm={handleConfirmReassign}
                title="Reassign All Index Numbers"
                message={`This will regenerate index numbers for all ${students.length} students based on the current configuration${autoSort ? ' and sort them alphabetically' : ''}. This action cannot be undone. Are you sure?`}
                confirmText="Yes, Reassign All"
                variant="warning"
            />
        </div>
    );
};

export default IndexNumberConfig;
