
/**
 * Verification Script for Data Sync Logic
 * Simulates the modified loadStudents and updateField logic.
 */

function simulateLoadStudents({
    currentLocal,
    cloudData,
    originalDataRef,
    isUpToDate,
    ignorePreservation = false
}) {
    0 && console.log(`\n--- Simulating loadStudents (ignorePreservation: ${ignorePreservation}) ---`);

    // 1. Early Return Check (Modified)
    const hasBaseline = originalDataRef.students !== undefined;
    if (isUpToDate && hasBaseline && !ignorePreservation) {
        0 && console.log("Up to date and has baseline. Skipping fetch.");
        return currentLocal;
    }

    // 2. Fetch Simulation
    const newStudents = cloudData;
    0 && console.log(`Fetched ${newStudents.length} students from cloud.`);

    // 3. Merge Logic
    if (ignorePreservation) {
        0 && console.log("Discarding local changes (Global Refresh mode).");
        originalDataRef.students = [...newStudents];
        return newStudents;
    }

    // Smart Merge
    const cloudIds = new Set(newStudents.map(s => String(s.id)));
    const localOnly = currentLocal.filter(s => !cloudIds.has(String(s.id)));

    const result = [...newStudents, ...localOnly];
    originalDataRef.students = [...newStudents];

    if (localOnly.length > 0) {
        0 && console.log(`Detected ${localOnly.length} local-only items. Marking dirty.`);
    }

    return result;
}

// TEST CASES

const cloudBaseline = [{ id: 1, name: 'Cloud User' }];
const localState = [
    { id: 1, name: 'Cloud User' },
    { id: 'temp-123', name: 'Unsaved User' }
];

// Case A: Initial Login (timestamps match, but no baseline in memory)
let originalData = {};
let state = simulateLoadStudents({
    currentLocal: localState,
    cloudData: cloudBaseline,
    originalDataRef: originalData,
    isUpToDate: true, // Timestamps match
    ignorePreservation: false
});
0 && console.log("Resulting State Count:", state.length); // Should be 2
0 && console.log("Is Unsaved User preserved?", state.some(s => s.id === 'temp-123')); // Should be true

// Case B: Global Refresh
state = simulateLoadStudents({
    currentLocal: localState,
    cloudData: cloudBaseline,
    originalDataRef: originalData,
    isUpToDate: false,
    ignorePreservation: true
});
0 && console.log("Resulting State Count (Refresh):", state.length); // Should be 1
0 && console.log("Is Unsaved User discarded?", !state.some(s => s.id === 'temp-123')); // Should be true
