
/**
 * Verification Script for Data Integrity Fixes (JS Version)
 * This script simulates the 'getPendingUploadData' logic with the new Role-Based Guards.
 */

// SIMULATED GET_PENDING_UPLOAD_DATA
function getPendingUploadDataSimulation(
    user,
    originalData,
    currentData,
    dirtyFields
) {
    const isAdmin = user.role === 'Admin';
    const allowedClasses = user.allowedClasses || [];
    const payload = {};
    const deletions = {};

    dirtyFields.forEach(field => {
        // 1. METADATA GUARD
        const isMetadata = ['subjects', 'classes', 'assessments', 'grades'].includes(field);
        if (isMetadata && !isAdmin) {
            console.log(`[SIM] 🛡️ Role-Based Guard: Stripping unauthorized metadata change to '${field}'`);
            return;
        }

        const currentVal = currentData[field];
        const originalVal = originalData[field];

        if (Array.isArray(currentVal) && Array.isArray(originalVal)) {
            // 2. DELETION GUARD
            let deletedIds = originalVal
                .filter((o) => o && o.id && !currentVal.find((c) => c && c.id === o.id))
                .map((o) => String(o.id));

            if (deletedIds.length > 0) {
                // Filter deletions for non-admins
                if (!isAdmin && (field === 'students' || field === 'reportData')) {
                    const originalCount = deletedIds.length;
                    deletedIds = deletedIds.filter(id => {
                        const item = originalVal.find((o) => String(o.id) === id);
                        const itemClass = item?.class || item?.className;
                        return itemClass && allowedClasses.includes(itemClass);
                    });
                    if (deletedIds.length < originalCount) {
                        console.log(`[SIM] 🛡️ Role-Based Guard: Filtered out ${originalCount - deletedIds.length} unauthorized deletions in '${field}'`);
                    }
                }

                // 3. MASS DELETION GUARD
                // Using 20% threshold as in implementation
                const isMassDeletion = deletedIds.length > 5 && (deletedIds.length > originalVal.length * 0.2);
                if (isMassDeletion && !isAdmin) {
                    console.log(`[SIM] 🚫 SAFETY BLOCK: Preventing mass deletion of ${deletedIds.length} ${field}`);
                } else if (deletedIds.length > 0) {
                    deletions[field] = deletedIds;
                }
            }

            // 4. Update Logic
            const updates = currentVal.filter(item => {
                const originalItem = originalVal.find((o) => String(o.id) === String(item.id));
                return !originalItem || JSON.stringify(item) !== JSON.stringify(originalItem);
            });
            if (updates.length > 0) payload[field] = updates;
        }
    });

    if (Object.keys(deletions).length > 0) payload._deletions = deletions;
    return payload;
}

// TEST CASE 1: Admin should be able to do anything
console.log("\n--- TEST CASE 1: Admin Full Access ---");
const original = {
    subjects: [{ id: 1, name: 'Math' }, { id: 2, name: 'Science' }],
    students: [
        { id: 'S1', name: 'Alice', class: '1A' },
        { id: 'S2', name: 'Bob', class: '1A' },
        { id: 'S3', name: 'Charlie', class: '1B' },
        { id: 'S4', name: 'Dave', class: '1A' },
        { id: 'S5', name: 'Eve', class: '1A' },
        { id: 'S6', name: 'Frank', class: '1A' }
    ],
    settings: {}
};

const currentAdmin = {
    ...original,
    subjects: [{ id: 1, name: 'Advanced Math' }], // 1 updated, 1 deleted
    students: [{ id: 'S1', name: 'Alice', class: '1A' }] // 5 deleted
};

const resultAdmin = getPendingUploadDataSimulation(
    { role: 'Admin', allowedClasses: [] },
    original,
    currentAdmin,
    new Set(['subjects', 'students'])
);
// In this case: subjects has an update, students has no updates (only deletions)
console.log("Admin Payload Result (Subjects present):", !!resultAdmin.subjects);
console.log("Admin Deletions Result (Subjects & Students present):", !!(resultAdmin._deletions?.subjects && resultAdmin._deletions?.students));

// TEST CASE 2: Teacher trying to delete subjects
console.log("\n--- TEST CASE 2: Teacher Metadata Block ---");
const currentTeacher = {
    ...original,
    subjects: [{ id: 1, name: 'Math' }] // Science deleted
};
const resultTeacher = getPendingUploadDataSimulation(
    { role: 'Teacher', allowedClasses: ['1A'] },
    original,
    currentTeacher,
    new Set(['subjects'])
);
console.log("Teacher Metadata Payload empty (Blocked):", Object.keys(resultTeacher).length === 0);

// TEST CASE 3: Teacher deleting scoped vs unscoped students
console.log("\n--- TEST CASE 3: Scoped Student Deletion ---");
const cts = {
    ...original,
    students: original.students.filter(s => s.id !== 'S1' && s.id !== 'S3') // S1 (1A) and S3 (1B) deleted
};

const resultTeacherScoped = getPendingUploadDataSimulation(
    { role: 'Teacher', allowedClasses: ['1A'] },
    original,
    cts,
    new Set(['students'])
);
console.log("Teacher Scoped Deletions (Should only contain S1):", resultTeacherScoped._deletions?.students);

// TEST CASE 4: Mass Deletion Safety
console.log("\n--- TEST CASE 4: Mass Deletion Block ---");
const currentTeacherMass = {
    ...original,
    students: [] // All 6 deleted (> 5 and > 20%)
};
const resultTeacherMass = getPendingUploadDataSimulation(
    { role: 'Teacher', allowedClasses: ['1A', '1B'] },
    original,
    currentTeacherMass,
    new Set(['students'])
);
console.log("Teacher Mass Deletions present (Should be false/undefined):", !!resultTeacherMass._deletions?.students);
