import type { Class } from '../types';

/**
 * Sorts classes in ascending order by name
 * Uses natural sort to handle numbers correctly (e.g., "Class 2" before "Class 10")
 */
export function sortClassesByName(classes: Class[]): Class[] {
    return [...classes].sort((a, b) => {
        return a.name.localeCompare(b.name, undefined, {
            numeric: true,
            sensitivity: 'base'
        });
    });
}

/**
 * Extracts numeric value from class name for custom sorting
 * E.g., "JHS 1" => 1, "Primary 6" => 6
 */
export function extractClassLevel(className: string): number {
    const match = className.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
}
