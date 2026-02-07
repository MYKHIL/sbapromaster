/**
 * SyncLogger - File-based logging service for tracking sync operations
 * Writes logs to a timestamped file in the project directory
 */

let logFilePath: string = '';
let logBuffer: string[] = [];
let isInitialized = false;

/**
 * Initialize a new log file with header information
 */
export function startNewLog(mode: string): void {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        logFilePath = `SyncLog_${timestamp}.txt`;

        const header = [
            '==========================================',
            `SYNC LOG STARTED AT ${new Date().toISOString()}`,
            `MODE: ${mode}`,
            `USER AGENT: ${navigator.userAgent}`,
            `WINDOW: ${window.location.href}`,
            '==========================================',
            ''
        ];

        logBuffer = header;
        isInitialized = true;

        console.log(`[SyncLogger] Log initialized: ${logFilePath}`);
        console.log(`[SyncLogger] Logs will be saved to browser when you call downloadLog()`);
    } catch (error) {
        console.error('[SyncLogger] Failed to initialize log:', error);
    }
}

/**
 * Append a message to the log
 */
export function log(message: string): void {
    if (!isInitialized) {
        console.warn('[SyncLogger] Logger not initialized. Call startNewLog() first.');
        return;
    }

    const timestamp = new Date().toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
    });

    const entry = `[${timestamp}] ${message}`;
    logBuffer.push(entry);

    // Also log to console for immediate visibility
    console.log(`[SYNC_LOG] ${message}`);
}

/**
 * Log an error with stack trace
 */
export function logError(context: string, error: Error | unknown): void {
    const errorMessage = error instanceof Error
        ? `${error.message}\nStack Trace: ${error.stack}`
        : String(error);

    log(`ERROR in ${context}: ${errorMessage}`);
}

/**
 * Get the current log file path
 */
export function getLogPath(): string {
    return logFilePath;
}

/**
 * Download the log file to the user's downloads folder
 */
export function downloadLog(): void {
    if (!isInitialized || logBuffer.length === 0) {
        console.warn('[SyncLogger] No log data to download');
        return;
    }

    try {
        const content = logBuffer.join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = logFilePath;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log(`[SyncLogger] Log downloaded: ${logFilePath}`);
    } catch (error) {
        console.error('[SyncLogger] Failed to download log:', error);
    }
}

/**
 * Get the current log content as a string
 */
export function getLogContent(): string {
    return logBuffer.join('\n');
}

/**
 * Clear the current log
 */
export function clearLog(): void {
    logBuffer = [];
    logFilePath = '';
    isInitialized = false;
}
