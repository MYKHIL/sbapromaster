import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminFirestore } from './_lib/admin-firestore';

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
        if (!email || !tierName || !durationValue || !durationUnit || !schoolId || !schoolName || !dbIndex) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['email', 'tierName', 'durationValue', 'durationUnit', 'schoolId', 'schoolName', 'dbIndex']
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

        // Initialize payment with Paystack
        const response = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${secretKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email,
                amount: amountInPesewas,
                currency: 'GHS',
                metadata: {
                    schoolId,
                    schoolName,
                    dbIndex: Number(dbIndex),
                    tierName,
                    durationValue,
                    durationUnit,
                    email
                }
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Paystack initialization error:', data);
            return res.status(response.status).json({
                error: 'Payment initialization failed',
                message: data.message || 'Unknown error',
                details: data.data?.message || data.message || 'Unknown error',
            });
        }

        const reference = data.data.reference;

        // Optional: stash pending registration for webhook-based activation (requires service account).
        // Client-side activation after payment works without this write.
        if (pendingRegistration) {
            try {
                const db = getAdminFirestore(Number(dbIndex));
                await db.collection('pending_registrations').doc(reference).set({
                    schoolId,
                    schoolName,
                    dbIndex: Number(dbIndex),
                    password: pendingRegistration.password,
                    registrationData: pendingRegistration.registrationData,
                    createdAt: new Date().toISOString()
                });
                safeLog(`[Paystack API] Pending registration saved successfully.`);
            } catch (firestoreError: any) {
                console.warn('[Paystack API] Pending registration not saved server-side (client will activate after payment):', firestoreError.message);
            }
        }

        // Return authorization URL and reference
        return res.status(200).json({
            success: true,
            authorizationUrl: data.data.authorization_url,
            accessCode: data.data.access_code,
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
