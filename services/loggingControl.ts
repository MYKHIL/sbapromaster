// Runtime toggle: set this value directly in code to enable/disable all logs.
// You can also call `setLoggingEnabled()` to persist the choice to localStorage.
export let LOGGING_ENABLED: boolean = false;

const STORAGE_KEY = 'sba_logging_enabled';

export const isLoggingEnabled = (): boolean => {
    // Primary source: runtime flag
    if (typeof LOGGING_ENABLED === 'boolean') return LOGGING_ENABLED;

    // Fallback: persisted setting
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        if (v === null) return true; // default enabled
        return v === '1';
    } catch (e) {
        return true;
    }
};

export const setLoggingEnabled = (enabled: boolean) => {
    try {
        LOGGING_ENABLED = enabled;
        localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
    } catch (e) {
        // ignore storage errors but still update runtime flag
        LOGGING_ENABLED = enabled;
    }
};

export default { isLoggingEnabled, setLoggingEnabled, LOGGING_ENABLED };
