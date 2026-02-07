
import { User, UserRole, Class, Subject } from '../types';

/**
 * Returns the list of classes available to the user.
 * Admin: All classes.
 * Teacher: Only classes in allowedClasses.
 * Guest: Only classes in allowedClasses (read-only usually).
 */
export const getAvailableClasses = (user: User | null, allClasses: Class[]): Class[] => {
    if (!user) return [];
    if (user.role === 'Admin') return allClasses;
    return allClasses.filter(c => user.allowedClasses.includes(c.name));
};

/**
 * Returns the list of subjects available to the user.
 * Admin: All subjects.
 * Teacher: Only subjects in allowedSubjects.
 * Guest: Only subjects in allowedSubjects.
 */
export const getAvailableSubjects = (user: User | null, allSubjects: Subject[]): Subject[] => {
    if (!user) return [];
    if (user.role === 'Admin') return allSubjects;
    return allSubjects.filter(s => user.allowedSubjects.includes(s.subject));
};

/**
 * Returns subjects available to a user for a specific class.
 * Uses classSubjects mapping if available, falls back to allowedSubjects.
 * Admin: All subjects.
 * Teacher/Guest: Only subjects mapped to the class in classSubjects, or allowedSubjects if no mapping exists.
 */
export const getSubjectsForUserAndClass = (
    user: User | null,
    className: string,
    allSubjects: Subject[]
): Subject[] => {
    if (!user) return [];
    if (user.role === 'Admin') return allSubjects;

    // Check if user has class-subject mapping for this specific class
    const classSubjects = user.classSubjects?.[className];

    if (classSubjects && classSubjects.length > 0) {
        // Use specific mapping for this class
        return allSubjects.filter(s => classSubjects.includes(s.subject));
    }

    // Fallback to global allowedSubjects (backward compatibility)
    return allSubjects.filter(s => user.allowedSubjects.includes(s.subject));
};

/**
 * Checks if a user has permission to manage (Add/Edit/Delete) students in a specific class.
 * Admin: Always true.
 * Teacher: True if class is in allowedClasses.
 * Guest: False.
 */
export const canManageStudentsInClass = (user: User | null, className: string): boolean => {
    if (!user) return false;
    if (user.role === 'Admin') return true;
    if (user.role === 'Teacher') {
        return user.allowedClasses.includes(className);
    }
    return false;
};

/**
 * Checks if a user has permission to manage global settings (Subjects, Grading, etc.).
 * Admin: True.
 * Others: False.
 */
export const canManageGlobalSettings = (user: User | null): boolean => {
    if (!user) return false;
    return user.role === 'Admin';
};
