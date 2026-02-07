import type { User, UserRole, DeviceCredential } from '../types';

/**
 * Generate a unique device fingerprint based on browser characteristics
 */
export function generateDeviceId(): string {
    const navigator = window.navigator;
    const screen = window.screen;

    const fingerprint = [
        navigator.userAgent,
        navigator.language,
        screen.colorDepth,
        screen.width,
        screen.height,
        new Date().getTimezoneOffset(),
        !!window.sessionStorage,
        !!window.localStorage,
    ].join('|');

    // Simple hash function to create a shorter ID
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
        const char = fingerprint.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return `device_${Math.abs(hash).toString(36)}`;
}

/**
 * Simple password hashing using SHA-256
 * Note: For production, consider using bcrypt or similar
 */
export async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    const passwordHash = await hashPassword(password);
    return passwordHash === hash;
}

/**
 * Check if a user has permission to access a resource
 */
export function checkPermission(
    user: User,
    resource: { type: 'class' | 'subject'; name: string }
): boolean {
    if (user.role === 'Admin') {
        return true; // Admins have access to everything
    }

    if (resource.type === 'class') {
        return user.allowedClasses.includes(resource.name);
    } else {
        return user.allowedSubjects.includes(resource.name);
    }
}

/**
 * Check if user has write permission (vs read-only)
 */
export function hasWritePermission(user: User): boolean {
    return user.role === 'Admin' || user.role === 'Teacher';
}

/**
 * Store device credential in localStorage
 */
export function saveDeviceCredential(schoolId: string, userId: number): void {
    const deviceId = generateDeviceId();
    const credential: DeviceCredential = {
        deviceId,
        userId,
        lastLogin: new Date().toISOString(),
    };

    // Store credentials keyed by schoolId to support multiple schools
    const key = `device_credential_${schoolId}`;
    localStorage.setItem(key, JSON.stringify(credential));
}

/**
 * Retrieve device credential from localStorage
 */
export function getDeviceCredential(schoolId: string): DeviceCredential | null {
    const key = `device_credential_${schoolId}`;
    const stored = localStorage.getItem(key);

    if (!stored) return null;

    try {
        const credential = JSON.parse(stored) as DeviceCredential;
        const currentDeviceId = generateDeviceId();

        // Verify the device ID matches
        if (credential.deviceId === currentDeviceId) {
            return credential;
        }

        return null;
    } catch (e) {
        console.error('Failed to parse device credential:', e);
        return null;
    }
}

/**
 * Clear device credential from localStorage
 */
export function clearDeviceCredential(schoolId: string): void {
    const key = `device_credential_${schoolId}`;
    localStorage.removeItem(key);
}

/**
 * Filter classes based on user permissions
 */
export function filterAllowedClasses(allClasses: string[], user: User): string[] {
    if (user.role === 'Admin') {
        return allClasses;
    }
    return allClasses.filter(className => user.allowedClasses.includes(className));
}

/**
 * Filter subjects based on user permissions
 */
export function filterAllowedSubjects(allSubjects: string[], user: User): string[] {
    if (user.role === 'Admin') {
        return allSubjects;
    }
    return allSubjects.filter(subjectName => user.allowedSubjects.includes(subjectName));
}
