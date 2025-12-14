import type { SchoolSettings, Class } from '../types';

/**
 * Generates an index number based on prefix/suffix configuration
 * Structure: globalPrefix + classPrefix + counter + classSuffix + globalSuffix
 * Example: "0220009" + "" + "001" + "" + "25" => "022000900125"
 */
export function generateIndexNumber(
    settings: SchoolSettings,
    classObj?: Class,
    counter?: number
): string {
    const globalPrefix = settings.indexNumberGlobalPrefix || '';
    const globalSuffix = settings.indexNumberGlobalSuffix || '';
    const classPrefix = classObj?.indexNumberPrefix || '';
    const classSuffix = classObj?.indexNumberSuffix || '';
    const digits = settings.indexNumberCounterDigits || 3;

    // Use provided counter or get from appropriate source
    const counterValue = counter ||
        (settings.indexNumberPerClass ? (classObj?.indexNumberCounter || 1) : (settings.indexNumberGlobalCounter || 1));

    // Pad counter with leading zeros
    const paddedCounter = counterValue.toString().padStart(digits, '0');

    // Build the index number
    return `${globalPrefix}${classPrefix}${paddedCounter}${classSuffix}${globalSuffix}`;
}

/**
 * Preview what the next index number will look like
 */
export function previewIndexNumber(
    settings: SchoolSettings,
    classObj?: Class
): string {
    return generateIndexNumber(settings, classObj);
}

/**
 * Validates index number configuration
 * Returns an error message if invalid, or null if valid
 */
export function validateIndexNumberConfig(
    globalPrefix: string,
    globalSuffix: string,
    digits: number
): string | null {
    if (digits < 1 || digits > 10) {
        return 'Counter digits must be between 1 and 10';
    }

    // Check for invalid characters that might cause issues
    const invalidChars = /[<>:"\/\\|?*]/g;
    if (invalidChars.test(globalPrefix)) {
        return 'Global prefix contains invalid characters: < > : " / \\ | ? *';
    }

    if (invalidChars.test(globalSuffix)) {
        return 'Global suffix contains invalid characters: < > : " / \\ | ? *';
    }

    return null; // Valid
}

// Legacy function for backward compatibility - kept for transition
export function validateIndexNumberPattern(pattern: string): string | null {
    if (!pattern || pattern.trim() === '') {
        return 'Pattern cannot be empty';
    }
    return null; // Valid
}
