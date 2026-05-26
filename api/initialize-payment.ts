import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'crypto';
import * as admin from 'firebase-admin';

/**
 * Paystack Payment Initialization Endpoint
 * 
 * Securely computes payment amount based on tier, duration, and environment variables,
 * initializes a transaction with Paystack, and stores any pending registration data.
 * 
 * POST /api/initialize-payment
 * Body: { email, tierName, durationValue, durationUnit, schoolId, schoolName, dbIndex, pendingRegistration }
 */
const allowCors = (fn: (req: VercelRequest, res: VercelResponse) => Promise<any>) => async (req: VercelRequest, res: VercelResponse) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    return await fn(req, res);
};

// Dynamically initialize Firestore admin for a specific database index using process.env
// Returns null if credentials are not available (graceful degradation)
function getAdminFirestore(dbIndex: number): admin.firestore.Firestore | null {
    const appName = `db_admin_${dbIndex}`;
    const existingApp = Array.isArray((admin as any).apps)
        ? (admin as any).apps.find((app: any) => app?.name === appName)
        : undefined;
    if (existingApp) {
        return existingApp.firestore();
    }

    const tokenRaw = process.env[`FIREBASE_${dbIndex}_TOKEN`] || '';
    const projectId = process.env[`FIREBASE_${dbIndex}_PROJECT_ID`] || '';

    if (!projectId || !tokenRaw) {
        // No credentials available - gracefully return null instead of throwing
        return null;
    }

    try {
        if (!admin.credential || typeof admin.credential.cert !== 'function') {
            console.warn(`[Firebase Admin] admin.credential.cert not available for database ${dbIndex}.`);
            return null;
        }

        const tokenValue = tokenRaw.trim();
        let credentialPayload: any;
        let credential: admin.credential.Credential;
        
        // Try to parse as JSON (service account)
        if (tokenValue.startsWith('{')) {
            credentialPayload = JSON.parse(tokenValue);
            credential = admin.credential.cert(credentialPayload);
        } else if (admin.credential && typeof admin.credential.refreshToken === 'function') {
            // Otherwise try as refresh token string
            credential = admin.credential.refreshToken(tokenValue);
        } else {
            console.warn(`[Firebase Admin] Unsupported token format for database ${dbIndex}.`);
            return null;
        }

        const app = admin.initializeApp({
            credential,
            projectId: projectId
        }, appName);

        return app.firestore();
    } catch (error: any) {
        console.warn(`[Firebase Admin] Failed to initialize Firestore for database ${dbIndex}:`, error?.message || error);
        return null;
    }
}

// Map the tier display name to the environment variable key suffix
function getTierKeySuffix(tierName: string): string {
    const name = tierName.toLowerCase();
    if (name.includes('trial')) return 'TRIAL';
    if (name.includes('basic')) return 'BASIC';
    if (name.includes('standard')) return 'STANDARD';
    if (name.includes('premium')) return 'PREMIUM';
    if (name.includes('professional')) return 'PROFESSIONAL';
    if (name.includes('enterprise')) return 'ENTERPRISE';
    if (name.includes('custom')) return 'CUSTOM';
    return name.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
}

const isLocal = process.env.NODE_ENV === 'development';
const safeLog = (...args: any[]) => {
    if (isLocal) {
        console.log(...args);
    }
};

async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const {
            email,
            tierName,
            durationValue,
            durationUnit,
            schoolId,
            schoolName,
            dbIndex,
            pendingRegistration
        } = req.body;

        const secretKey = (process.env.PAYSTACK_SECRET_KEY || '').trim();

        // Validate inputs
        if (!email || !tierName || !durationValue || !durationUnit || !schoolId || !schoolName) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['email', 'tierName', 'durationValue', 'durationUnit', 'schoolId', 'schoolName']
            });
        }

        if (!secretKey) {
            console.error('[Paystack API] Error: PAYSTACK_SECRET_KEY is missing');
            return res.status(500).json({ error: 'Paystack Secret Key not configured on server' });
        }

        // Get tier pricing environment variable
        const tierKeySuffix = getTierKeySuffix(tierName);
        const basePriceStr = process.env[`VITE_TIER_PRICE_${tierKeySuffix}`] || '';
        let basePrice = parseFloat(basePriceStr.replace(/[^0-9.]/g, ''));

        if (isNaN(basePrice) || basePrice <= 0) {
            return res.status(400).json({
                error: 'Invalid tier or tier does not require payment',
                tier: tierName
            });
        }

        // Move calculation to the server:
        // Compute total months: Term = 4 months, Year = 12 months * value
        const totalMonths = durationUnit === 'Year' ? durationValue * 12 : durationValue * 4;
        const secureAmount = (basePrice / 12) * totalMonths;
        const amountInPesewas = Math.round(secureAmount * 100);
        const MIN_PAYSTACK_AMOUNT = 100; // 1.00 GHS in pesewas

        if (amountInPesewas < MIN_PAYSTACK_AMOUNT) {
            return res.status(400).json({
                error: 'Invalid payment amount',
                message: `Paystack transactions must be at least GH₵ ${(MIN_PAYSTACK_AMOUNT / 100).toFixed(2)}. Current amount is GH₵ ${ (amountInPesewas / 100).toFixed(2) }.`
            });
        }

        const targetDbIndex = (() => {
            const explicitIndex = Number(dbIndex);
            return explicitIndex && !Number.isNaN(explicitIndex) ? explicitIndex : 1;
        })();

        // Initialize payment with Paystack
        const MAX_PAYSTACK_INIT_RETRIES = 3;
        let paystackReference = `SBA_${randomUUID()}`;
        let initResponse: Response | null = null;
        let initData: any = null;

        for (let attempt = 1; attempt <= MAX_PAYSTACK_INIT_RETRIES; attempt++) {
            safeLog(`[Paystack API] Attempt ${attempt} initializing transaction with reference:`, paystackReference);

            initResponse = await fetch('https://api.paystack.co/transaction/initialize', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${secretKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    amount: amountInPesewas,
                    currency: 'GHS',
                    reference: paystackReference,
                    metadata: {
                        schoolId,
                        schoolName,
                        dbIndex: Number(targetDbIndex),
                        tierName,
                        durationValue,
                        durationUnit,
                        email
                    }
                }),
            });

            initData = await initResponse.json();
            const errorMessage = String(initData?.message || initData?.data?.message || '');
            const isDuplicateReference = /duplicate transaction reference/i.test(errorMessage);

            if (initResponse.ok && initData?.status !== false) {
                break;
            }

            if (isDuplicateReference && attempt < MAX_PAYSTACK_INIT_RETRIES) {
                safeLog('[Paystack API] Duplicate reference detected, retrying with a new reference...');
                paystackReference = `SBA_${randomUUID()}`;
                continue;
            }

            console.error('Paystack initialization error:', initData);
            const statusCode = initResponse.status || 500;
            return res.status(statusCode).json({
                error: 'Payment initialization failed',
                message: initData?.message || errorMessage || 'Unknown error',
                details: initData?.data?.message || initData?.message || 'Unknown error',
            });
        }

        const reference = initData?.data?.reference || paystackReference;

        // If there's a pending registration for a new school, attempt to store it securely
        // If database credentials aren't available, warn and continue (pending registration will be stored on webhook)
        if (pendingRegistration) {
            try {
                const db = getAdminFirestore(Number(targetDbIndex));
                if (db) {
                    await db.collection('pending_registrations').doc(reference).set({
                        schoolId,
                        schoolName,
                        dbIndex: Number(targetDbIndex),
                        password: pendingRegistration.password,
                        registrationData: pendingRegistration.registrationData,
                        createdAt: new Date().toISOString()
                    });
                    safeLog(`[Paystack API] Pending registration saved successfully.`);
                } else {
                    console.warn(`[Paystack API] Firestore credentials not available for database ${targetDbIndex}. Pending registration will be processed on webhook completion.`);
                }
            } catch (firestoreError: any) {
                console.error('[Paystack API] Failed to save pending registration:', firestoreError);
                // Don't fail the payment init; webhook will handle it
                console.warn('[Paystack API] Continuing without persisting pending registration—will be handled on webhook.');
            }
        }

        // Return authorization URL and reference
        return res.status(200).json({
            success: true,
            authorizationUrl: initData.data.authorization_url,
            accessCode: initData.data.access_code,
            reference: reference,
        });

    } catch (error: any) {
        console.error('Initialize payment error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        });
    }
}

export default allowCors(handler);
