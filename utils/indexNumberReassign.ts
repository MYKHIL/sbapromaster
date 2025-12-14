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
    sortAlphabetically: boolean = false
): Student[] {
    // Create a copy of students
    let studentsToProcess = [...students];

    // Sort alphabetically if requested
    if (sortAlphabetically) {
        studentsToProcess.sort((a, b) => a.name.localeCompare(b.name));
    }

    // If using per-class counters, group by class and process separately
    if (settings.indexNumberPerClass) {
        const updatedStudents: Student[] = [];
        const classCounts = new Map<string, number>();

        // Initialize counters for each class
        classes.forEach(cls => {
            classCounts.set(cls.name, cls.indexNumberCounter || 1);
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

            // Sort each class group and assign numbers
            classes.forEach(cls => {
                const classStudents = byClass.get(cls.name) || [];
                classStudents.sort((a, b) => a.name.localeCompare(b.name));

                let counter = cls.indexNumberCounter || 1;
                classStudents.forEach(student => {
                    updatedStudents.push({
                        ...student,
                        indexNumber: generateIndexNumber(settings, cls, counter++)
                    });
                });
            });
        } else {
            // Process in current order but with class-specific counters
            studentsToProcess.forEach(student => {
                const cls = classes.find(c => c.name === student.class);
                if (cls) {
                    const counter = classCounts.get(student.class) || 1;
                    updatedStudents.push({
                        ...student,
                        indexNumber: generateIndexNumber(settings, cls, counter)
                    });
                    classCounts.set(student.class, counter + 1);
                }
            });
        }

        return updatedStudents;
    } else {
        // Using global counter - simple sequential assignment
        let counter = settings.indexNumberGlobalCounter || 1;

        return studentsToProcess.map(student => {
            const cls = classes.find(c => c.name === student.class);
            return {
                ...student,
                indexNumber: generateIndexNumber(settings, cls, counter++)
            };
        });
    }
}
