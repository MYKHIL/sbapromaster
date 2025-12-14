import type { SchoolSettings, Class, Student } from '../types';

/**
 * Extracts the counter value from an existing index number
 * Example: "022000900125" with prefix "0220009" and suffix "25" => 1
 */
export function extractCounterFromIndexNumber(
    indexNumber: string,
    settings: SchoolSettings,
    classObj?: Class
): number | null {
    const globalPrefix = settings.indexNumberGlobalPrefix || '';
    const globalSuffix = settings.indexNumberGlobalSuffix || '';
    const classPrefix = classObj?.indexNumberPrefix || '';
    const classSuffix = classObj?.indexNumberSuffix || '';

    // Remove global prefix
    let remaining = indexNumber;
    if (globalPrefix && remaining.startsWith(globalPrefix)) {
        remaining = remaining.substring(globalPrefix.length);
    }

    // Remove class prefix
    if (classPrefix && remaining.startsWith(classPrefix)) {
        remaining = remaining.substring(classPrefix.length);
    }

    // Remove class suffix from end
    if (classSuffix && remaining.endsWith(classSuffix)) {
        remaining = remaining.substring(0, remaining.length - classSuffix.length);
    }

    // Remove global suffix from end
    if (globalSuffix && remaining.endsWith(globalSuffix)) {
        remaining = remaining.substring(0, remaining.length - globalSuffix.length);
    }

    // What's left should be the counter
    const counterValue = parseInt(remaining, 10);

    if (isNaN(counterValue)) {
        return null; // Could not parse
    }

    return counterValue;
}

/**
 * Finds the next available counter for a student based on existing students
 */
export function getNextAvailableCounter(
    students: Student[],
    settings: SchoolSettings,
    classObj?: Class
): number {
    // Filter students based on mode
    let relevantStudents = students;

    if (settings.indexNumberPerClass && classObj) {
        // Only look at students in the same class
        relevantStudents = students.filter(s => s.class === classObj.name);
    }

    // Extract all counter values from existing index numbers
    const existingCounters: number[] = [];

    for (const student of relevantStudents) {
        const counter = extractCounterFromIndexNumber(student.indexNumber, settings, classObj);
        if (counter !== null) {
            existingCounters.push(counter);
        }
    }

    // Find the maximum counter
    let maxCounter = 0;
    if (existingCounters.length > 0) {
        maxCounter = Math.max(...existingCounters);
    }

    // Get the configured counter (for reference)
    const configuredCounter = settings.indexNumberPerClass
        ? (classObj?.indexNumberCounter || 1)
        : (settings.indexNumberGlobalCounter || 1);

    // Return the higher of: (max existing counter + 1) or configured counter
    return Math.max(maxCounter + 1, configuredCounter);
}
