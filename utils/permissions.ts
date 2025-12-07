
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
