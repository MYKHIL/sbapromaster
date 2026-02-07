// Global Firebase Analytics Tracking
// This file provides global functions that can be called from anywhere to track Firebase operations

type ReadTrackingFunction = (operation: string, collection?: string, docCount?: number, description?: string) => void;
type WriteTrackingFunction = (operation: string, collection?: string, description?: string) => void;

let trackReadFn: ReadTrackingFunction | null = null;
let trackWriteFn: WriteTrackingFunction | null = null;

export const registerTracking = (
    trackRead: ReadTrackingFunction,
    trackWrite: WriteTrackingFunction
) => {
    trackReadFn = trackRead;
    trackWriteFn = trackWrite;
};

export const trackFirebaseRead = (operation: string, collection?: string, docCount: number = 1, description?: string) => {
    if (trackReadFn) {
        trackReadFn(operation, collection, docCount, description);
    }
};

export const trackFirebaseWrite = (operation: string, collection?: string, description?: string) => {
    if (trackWriteFn) {
        trackWriteFn(operation, collection, description);
    }
};
