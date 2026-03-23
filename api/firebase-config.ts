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
const allowCors = (fn: (req: VercelRequest, res: VercelResponse) => Promise<any>) => async (req: VercelRequest, res: VercelResponse) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    return await fn(req, res);
};

async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Dynamically detect all Firebase configurations from environment variables
        const configs: { [key: number]: any } = {};
        let index = 1;

        // Loop through environment variables to find all FIREBASE_N_* configs
        while (process.env[`FIREBASE_${index}_API_KEY`]) {
            configs[index] = {
                apiKey: process.env[`FIREBASE_${index}_API_KEY`],
                authDomain: process.env[`FIREBASE_${index}_AUTH_DOMAIN`],
                projectId: process.env[`FIREBASE_${index}_PROJECT_ID`],
                storageBucket: process.env[`FIREBASE_${index}_STORAGE_BUCKET`],
                messagingSenderId: process.env[`FIREBASE_${index}_MESSAGING_SENDER_ID`],
                appId: process.env[`FIREBASE_${index}_APP_ID`],
                measurementId: process.env[`FIREBASE_${index}_MEASUREMENT_ID`],
                isReserved: process.env[`FIREBASE_${index}_IS_RESERVED`] === 'true',
                label: process.env[`FIREBASE_${index}_LABEL`] || `Database ${index}`
            };
            index++;
        }

        // Dynamically load school-to-database mapping from environment variable
        let schoolDatabaseMapping: { [key: string]: number } = {};
        try {
            schoolDatabaseMapping = JSON.parse(
                process.env.SCHOOL_DATABASE_MAPPING || '{}'
            );
        } catch (error) {
            console.warn('Failed to parse SCHOOL_DATABASE_MAPPING, using empty mapping:', error);
        }

        return res.status(200).json({
            success: true,
            configs, 
            schoolDatabaseMapping,
            paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY,
            activationHash: process.env.PASSWORD_HASH // Required for client-side activation security rules
        });

    } catch (error: any) {
        console.error('Firebase config error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        });
    }
}

export default allowCors(handler);
