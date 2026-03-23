import type { SchoolSettings, Class, Student } from '../types';
import { generateIndexNumber } from './indexNumberGenerator';

/**
 * Reassigns all index numbers for students, optionally sorting alphabetically first
 * This is useful when the admin wants to reorganize all index numbers
 */
export function reassignAllIndexNumbers(
    students: Student[],
    classes: Class[],
    settings: SchoolSettings,
    sortAlphabetically: boolean = false,
    resetCounters: boolean = true
): { updatedStudents: Student[], updatedClasses: Class[] } {
    // Create a copy of students
    let studentsToProcess = [...students];

    // Sort alphabetically if requested
    if (sortAlphabetically) {
        studentsToProcess.sort((a, b) => a.name.localeCompare(b.name));
    }

    const updatedClasses = [...classes];

    // If using per-class counters, group by class and process separately
    if (settings.indexNumberPerClass) {
        const updatedStudents: Student[] = [];
        const classFlush = new Map<string, number>();

        // Initialize counters for each class
        updatedClasses.forEach((cls, idx) => {
            const startCounter = resetCounters ? 1 : (cls.indexNumberCounter || 1);
            classFlush.set(cls.name, startCounter);
            // Update the class object itself if we reset it
            if (resetCounters) {
                updatedClasses[idx] = { ...cls, indexNumberCounter: startCounter };
            }
        });

        // If sorting, we need to sort within each class
        if (sortAlphabetically) {
            // Group by class
            const byClass = new Map<string, Student[]>();
            studentsToProcess.forEach(student => {
                if (!byClass.has(student.class)) {
                    byClass.set(student.class, []);
                }
                byClass.get(student.class)!.push(student);
            });

            // Process each class group and assign numbers
            updatedClasses.forEach((cls, idx) => {
                const classStudents = byClass.get(cls.name) || [];
                classStudents.sort((a, b) => a.name.localeCompare(b.name));

                let counter = classFlush.get(cls.name) || 1;
                classStudents.forEach(student => {
                    updatedStudents.push({
                        ...student,
                        indexNumber: generateIndexNumber(settings, cls, counter++)
                    });
                });
                // Update final counter in class
                updatedClasses[idx] = { ...cls, indexNumberCounter: counter };
            });
            
            // Collect any students whose class wasn't in the classes list (shouldn't happen with valid data)
            const assignedIds = new Set(updatedStudents.map(s => s.id));
            studentsToProcess.forEach(s => {
                if (!assignedIds.has(s.id)) updatedStudents.push(s);
            });

        } else {
            // Process in current order but with class-specific counters
            studentsToProcess.forEach(student => {
                const classIdx = updatedClasses.findIndex(c => c.name === student.class);
                if (classIdx !== -1) {
                    const cls = updatedClasses[classIdx];
                    const counter = classFlush.get(student.class) || 1;
                    updatedStudents.push({
                        ...student,
                        indexNumber: generateIndexNumber(settings, cls, counter)
                    });
                    const nextCounter = counter + 1;
                    classFlush.set(student.class, nextCounter);
                    updatedClasses[classIdx] = { ...cls, indexNumberCounter: nextCounter };
                } else {
                    updatedStudents.push(student);
                }
            });
        }

        return { updatedStudents, updatedClasses };
    } else {
        // Using global counter - simple sequential assignment
        let counter = resetCounters ? 1 : (settings.indexNumberGlobalCounter || 1);

        const updatedStudents = studentsToProcess.map(student => {
            const cls = updatedClasses.find(c => c.name === student.class);
            return {
                ...student,
                indexNumber: generateIndexNumber(settings, cls, counter++)
            };
        });

        // We don't have a way to return updated global counter easily here as it's in settings
        // but the caller (IndexNumberConfig) manages settings anyway.
        return { updatedStudents, updatedClasses };
    }
}
