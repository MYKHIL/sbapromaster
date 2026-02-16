import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Firebase Configuration Endpoint
 * 
 * Returns Firebase configuration for client-side initialization
 * Note: API keys in Firebase config are public-safe (they're meant to be exposed)
 * Security is handled by Firestore security rules
 * 
 * GET /api/firebase-config
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS Config
    res.setHeader('Access-Control-Allow-Origin', '*'); // Since no creds are actually used/needed, * is fine.
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const configs = {
            1: {
                apiKey: process.env.FIREBASE_1_API_KEY,
                authDomain: process.env.FIREBASE_1_AUTH_DOMAIN,
                projectId: process.env.FIREBASE_1_PROJECT_ID,
                storageBucket: process.env.FIREBASE_1_STORAGE_BUCKET,
                messagingSenderId: process.env.FIREBASE_1_MESSAGING_SENDER_ID,
                appId: process.env.FIREBASE_1_APP_ID,
                measurementId: process.env.FIREBASE_1_MEASUREMENT_ID,
                isReserved: false,
                label: 'Primary'
            },
            2: {
                apiKey: process.env.FIREBASE_2_API_KEY,
                authDomain: process.env.FIREBASE_2_AUTH_DOMAIN,
                projectId: process.env.FIREBASE_2_PROJECT_ID,
                storageBucket: process.env.FIREBASE_2_STORAGE_BUCKET,
                messagingSenderId: process.env.FIREBASE_2_MESSAGING_SENDER_ID,
                appId: process.env.FIREBASE_2_APP_ID,
                measurementId: process.env.FIREBASE_2_MEASUREMENT_ID,
                isReserved: true,
                label: 'Reserved/Darko'
            },
            3: {
                apiKey: process.env.FIREBASE_3_API_KEY,
                authDomain: process.env.FIREBASE_3_AUTH_DOMAIN,
                projectId: process.env.FIREBASE_3_PROJECT_ID,
                storageBucket: process.env.FIREBASE_3_STORAGE_BUCKET,
                messagingSenderId: process.env.FIREBASE_3_MESSAGING_SENDER_ID,
                appId: process.env.FIREBASE_3_APP_ID,
                measurementId: process.env.FIREBASE_3_MEASUREMENT_ID,
                isReserved: false,
                label: 'Public 2'
            }
        };

        return res.status(200).json({
            success: true,
            configs,
            schoolDatabaseMapping: {
                'ayirebida': 2
            }
        });

    } catch (error: any) {
        console.error('Firebase config error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        });
    }
}
