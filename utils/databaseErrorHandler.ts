/**
 * Database Error Handler Utility
 * Handles database errors with user-friendly messages and WhatsApp support integration
 */

export interface DatabaseError {
    code: string;
    message: string;
    friendlyMessage: string;
    fullError: any;
}

const DEVELOPER_PHONE = '0542410613';
const WHATSAPP_BASE_URL = 'https://wa.me/';

/**
 * Checks if an error is a database quota exhausted error
 */
export const isQuotaExhaustedError = (error: any): boolean => {
    if (!error) return false;

    const errorMessage = error.message || error.toString() || '';
    const errorCode = error.code || '';

    return (
        errorCode === 'resource-exhausted' ||
        errorCode === 'RESOURCE_EXHAUSTED' ||
        errorMessage.includes('RESOURCE_EXHAUSTED') ||
        errorMessage.includes('quota exceeded') ||
        errorMessage.includes('quota exhausted')
    );
};

/**
 * Checks if an error is a database-related error
 */
export const isDatabaseError = (error: any): boolean => {
    if (!error) return false;

    const errorMessage = error.message || error.toString() || '';
    const errorCode = error.code || '';

    const databaseErrorCodes = [
        'resource-exhausted',
        'RESOURCE_EXHAUSTED',
        'permission-denied',
        'unavailable',
        'deadline-exceeded',
        'not-found',
        'already-exists',
        'failed-precondition',
        'aborted',
        'out-of-range',
        'unimplemented',
        'internal',
        'data-loss',
        'invalid-argument'
    ];

    return databaseErrorCodes.some(code =>
        errorCode.includes(code) || errorMessage.includes(code)
    );
};

/**
 * Creates a WhatsApp URL with the error message
 */
export const createWhatsAppErrorLink = (error: any): string => {
    const errorMessage = error.message || error.toString() || 'Unknown error';
    const errorCode = error.code || 'NO_CODE';
    const timestamp = new Date().toLocaleString();

    const message = `🚨 *SBA Pro Master - Database Error*\n\n` +
        `⏰ Time: ${timestamp}\n` +
        `❌ Error Code: ${errorCode}\n` +
        `📝 Error Message: ${errorMessage}\n\n` +
        `Please help resolve this issue as soon as possible.`;

    const phoneNumber = DEVELOPER_PHONE.replace(/^0/, '233');

    return `${WHATSAPP_BASE_URL}${phoneNumber}?text=${encodeURIComponent(message)}`;
};

/**
 * Formats a Date object into a professional, human-friendly string
 */
const formatHumanFriendlyTime = (targetDate: Date): string => {
    const now = new Date();
    const diffMs = targetDate.getTime() - now.getTime();

    // Safety check for past dates
    if (diffMs <= 0) return "a few moments";

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    // 1. Very soon (less than 1 hour)
    if (diffHours < 1) {
        const mins = diffMinutes > 0 ? diffMinutes : 1;
        return `approximately ${mins} minute${mins === 1 ? '' : 's'}`;
    }

    // 2. A few hours away (less than 6 hours)
    if (diffHours < 6) {
        return `approximately ${diffHours} hour${diffHours === 1 ? '' : 's'}`;
    }

    // 3. Specific time today/tomorrow in user's local time
    const timeString = targetDate.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

    const isSameDay = now.getDate() === targetDate.getDate() &&
        now.getMonth() === targetDate.getMonth() &&
        now.getFullYear() === targetDate.getFullYear();

    return isSameDay ? `today at ${timeString}` : `tomorrow at ${timeString}`;
};

/**
 * Calculates the next quota reset Date object
 * Firebase resets at Midnight Pacific Time (PT)
 */
export const getNextQuotaResetDate = (): Date => {
    try {
        const now = new Date();

        // Check if Midnight PT is 07:00 or 08:00 UTC (Daylight vs Standard)
        const testDate = new Date();
        testDate.setUTCHours(8, 0, 0, 0);
        const ptHourString = testDate.toLocaleString('en-US', {
            timeZone: 'America/Los_Angeles',
            hour: 'numeric',
            hour12: false
        });

        // Robust parsing: Handle "0", "00", "24" variations across browsers
        const ptHour = parseInt(ptHourString, 10);

        // 8 AM UTC is Midnight (0) PST (Standard) or 1 AM PDT (Daylight)
        // If hour is 0 (or 24), we are in Standard time (Offset -8)
        const isStandardTime = !isNaN(ptHour) && (ptHour === 0 || ptHour === 24);
        const resetHourUTC = isStandardTime ? 8 : 7;

        const nextReset = new Date();
        // Add 20 minutes safety buffer
        nextReset.setUTCHours(resetHourUTC, 30, 0, 0);

        // If current time passed reset time, it happens the next day
        if (now > nextReset) {
            nextReset.setUTCDate(nextReset.getUTCDate() + 1);
        }

        return nextReset;
    } catch (e) {
        // Fallback: 24 hours from now if calc fails
        const fallback = new Date();
        fallback.setHours(fallback.getHours() + 24);
        return fallback;
    }
};

/**
 * Gets a static human-friendly string for the reset time
 */
const getNextQuotaResetInfo = (): string => {
    const resetDate = getNextQuotaResetDate();
    return formatHumanFriendlyTime(resetDate);
};

/**
 * Maps technical error codes to user-friendly messages
 */
const getFriendlyErrorMessage = (code: string, message: string): string => {
    const lcCode = code.toLowerCase();
    const lcMessage = message.toLowerCase();

    if (lcCode.includes('resource-exhausted') || lcMessage.includes('quota')) {
        const timeRemaining = getNextQuotaResetInfo();
        return `The system has reached its daily data limit. Service will be restored in approximately <strong>${timeRemaining}</strong>. Please try again then or contact support.`;
    }

    if (lcCode.includes('permission-denied')) {
        return "Access denied. You don't have permission to perform this action.";
    }

    if (lcCode.includes('unavailable') || lcCode.includes('network')) {
        return "Connection lost. Please check your internet and try again.";
    }

    if (lcCode.includes('invalid-argument') || lcMessage.includes('size')) {
        return "The data is too large to process. Please optimize your records or contact support.";
    }

    if (lcCode.includes('not-found')) {
        return "We couldn't find the record you were looking for.";
    }

    return "An unexpected system error occurred. Please try again or contact support if the issue persists.";
};

/**
 * Gets user-friendly error information
 */
export const getDatabaseErrorInfo = (error: any): DatabaseError => {
    const errorMessage = error.message || error.toString() || 'Unknown error';
    const errorCode = error.code || 'UNKNOWN';
    const friendlyMessage = getFriendlyErrorMessage(errorCode, errorMessage);

    return {
        code: errorCode,
        message: errorMessage,
        friendlyMessage,
        fullError: error
    };
};

/**
 * Formats phone number for display
 */
export const formatPhoneNumber = (phone: string): string => {
    return phone.replace(/(\d{4})(\d{3})(\d{4})/, '$1 $2 $3');
};

export { DEVELOPER_PHONE };