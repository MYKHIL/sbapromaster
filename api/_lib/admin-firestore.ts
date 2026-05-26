import fs from 'node:fs';
import admin from 'firebase-admin';

/** Firebase CLI OAuth client (pairs with `firebase login` refresh tokens). */
const FIREBASE_CLI_CLIENT_ID =
    '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

function authorizedUserCredential(refreshToken: string): admin.credential.Credential {
    return admin.credential.refreshToken({
        type: 'authorized_user',
        client_id: process.env.FIREBASE_OAUTH_CLIENT_ID || FIREBASE_CLI_CLIENT_ID,
        client_secret: process.env.FIREBASE_OAUTH_CLIENT_SECRET || FIREBASE_CLI_CLIENT_SECRET,
        refresh_token: refreshToken,
    });
}

/**
 * Build an Admin credential from FIREBASE_{n}_TOKEN.
 * Env may hold a raw refresh token (1//...), authorized_user JSON, or a path to that JSON file.
 */
function credentialFromRefreshTokenEnv(token: string): admin.credential.Credential {
    const trimmed = token.trim();

    if (trimmed.startsWith('{')) {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>;
        if (parsed.refresh_token && typeof parsed.refresh_token === 'string') {
            return authorizedUserCredential(parsed.refresh_token);
        }
        return admin.credential.refreshToken(parsed);
    }

    // Only treat as a file path when the file actually exists (never for raw 1// tokens)
    try {
        if (fs.existsSync(trimmed)) {
            return admin.credential.refreshToken(trimmed);
        }
    } catch {
        // fall through to raw token handling
    }

    return authorizedUserCredential(trimmed);
}

/** Initialize (or reuse) Firebase Admin for a database slot and return Firestore. */
export function getAdminFirestore(dbIndex: number): admin.firestore.Firestore {
    const appName = `db_admin_${dbIndex}`;
    const existingApp = admin.apps.find(app => app?.name === appName);
    if (existingApp) {
        return existingApp.firestore();
    }

    const token = process.env[`FIREBASE_${dbIndex}_TOKEN`] || '';
    const projectId = process.env[`FIREBASE_${dbIndex}_PROJECT_ID`] || '';

    if (!projectId) {
        throw new Error(`Project ID for database ${dbIndex} is not configured.`);
    }

    let serviceAccount: { project_id?: string } | null = null;
    try {
        const serviceAccountStr = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT || '{}';
        const parsed = JSON.parse(serviceAccountStr);
        if (parsed?.project_id) {
            serviceAccount = parsed;
        }
    } catch {
        serviceAccount = null;
    }

    let app: admin.app.App;
    // Firestore Admin API requires a service account — user OAuth refresh tokens are not supported.
    if (serviceAccount?.project_id === projectId) {
        app = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
            projectId,
        }, appName);
    } else if (token) {
        app = admin.initializeApp({
            credential: credentialFromRefreshTokenEnv(token),
            projectId,
        }, appName);
    } else {
        throw new Error(
            `No credentials configured for database ${dbIndex}. Set FIREBASE_ADMIN_SERVICE_ACCOUNT (recommended) or FIREBASE_${dbIndex}_TOKEN.`
        );
    }

    return app.firestore();
}
