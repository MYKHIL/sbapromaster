import { Grade, Subject } from '../types';

/**
 * Creates a mapping from grade names to numeric values (1 = best).
 * Higher scores (minScore/maxScore) are mapped to lower numeric values.
 */
export const getNumericGradeMap = (grades: Grade[]): Map<string, number> => {
    // Sort grades by maxScore descending (e.g., 80-100 is first, then 70-79...)
    const sortedGrades = [...grades].sort((a, b) => b.maxScore - a.maxScore);
    const map = new Map<string, number>();
    sortedGrades.forEach((grade, index) => {
        map.set(grade.name, index + 1);
    });
    return map;
};

/**
 * Calculates the aggregate score based on the rule:
 * Sum of ALL Core subjects + Sum of 2 BEST Electives.
 * 
 * If a student is missing a Core subject that is active in the class, a penalty (worst grade) is applied.
 * If a student has fewer than 2 Electives, penalties are applied for the missing ones.
 */
export const calculateAggregateScore = (
    studentGrades: Map<string, string>, // subjectName -> gradeName
    classActiveSubjects: Subject[],
    numericGradeMap: Map<string, number>,
    leastGradeValue: number
): number => {
    // 1. Identify valid Core and Elective subjects for this class
    const coreSubjects = classActiveSubjects.filter(s => s.type === 'Core');
    const electiveSubjects = classActiveSubjects.filter(s => s.type === 'Elective');

    // 2. Sum ALL Core subjects
    let coreSum = 0;
    coreSubjects.forEach(subject => {
        const gradeName = studentGrades.get(subject.subject);
        const numericValue = gradeName ? numericGradeMap.get(gradeName) : undefined;
        
        // Use penalty if grade is missing or not map-able
        coreSum += (numericValue !== undefined) ? numericValue : leastGradeValue;
    });

    // 3. Find Best Electives (up to 2, or fewer if the class offers fewer)
    const electiveValues: number[] = [];
    electiveSubjects.forEach(subject => {
        const gradeName = studentGrades.get(subject.subject);
        const numericValue = gradeName ? numericGradeMap.get(gradeName) : undefined;
        
        if (numericValue !== undefined) {
            electiveValues.push(numericValue);
        }
    });

    // Sort: lower numeric value = better grade
    const sortedElectives = electiveValues.sort((a, b) => a - b);
    
    // Dynamic target: either 2 or the number of electives offered by the class
    const electiveTarget = Math.min(2, electiveSubjects.length);
    const bestElectives = sortedElectives.slice(0, electiveTarget);

    let electiveSum = bestElectives.reduce((sum, val) => sum + val, 0);

    // 4. Fill in penalties if fewer than the target number of electives were found
    if (bestElectives.length < electiveTarget) {
        electiveSum += (electiveTarget - bestElectives.length) * leastGradeValue;
    }

    return coreSum + electiveSum;
};
