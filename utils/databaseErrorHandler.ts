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

    // Check for Firebase quota exhausted error
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

    // Check for common database error codes
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
        'invalid-argument' // Catch size limit errors
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
    const timestamp = new Date().toISOString();

    const message = `🚨 *SBA Pro Master - Database Error*\n\n` +
        `⏰ Time: ${timestamp}\n` +
        `❌ Error Code: ${errorCode}\n` +
        `📝 Error Message: ${errorMessage}\n\n` +
        `Please help resolve this issue as soon as possible.`;

    // Remove country code prefix if present and format for WhatsApp
    const phoneNumber = DEVELOPER_PHONE.replace(/^0/, '233'); // Assuming Ghana country code

    return `${WHATSAPP_BASE_URL}${phoneNumber}?text=${encodeURIComponent(message)}`;
};

/**
 * Maps technical error codes to user-friendly messages
 */
const getFriendlyErrorMessage = (code: string, message: string): string => {
    const lcCode = code.toLowerCase();
    const lcMessage = message.toLowerCase();

    if (lcCode.includes('resource-exhausted') || lcMessage.includes('quota')) {
        return "The system is currently busy (Daily Quota Reached). Please try again later or contact support.";
    }
    if (lcCode.includes('permission-denied')) {
        return "You don't have permission to perform this action.";
    }
    if (lcCode.includes('unavailable') || lcCode.includes('network')) {
        return "Network connection issue. Please check your internet.";
    }
    if (lcCode.includes('invalid-argument') || lcMessage.includes('size')) {
        return "Data too large to save (Limit Exceeded). Please reach out to support.";
    }
    if (lcCode.includes('not-found')) {
        return "The requested data could not be found.";
    }

    return "An unexpected system error occurred.";
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
    // Format as XXX XXX XXXX for better readability
    return phone.replace(/(\d{4})(\d{3})(\d{4})/, '$1 $2 $3');
};

export { DEVELOPER_PHONE };
