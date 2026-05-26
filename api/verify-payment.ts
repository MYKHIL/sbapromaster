import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';

/**
 * Paystack Payment Verification Endpoint
 * 
 * Verifies a Paystack payment transaction and checks if the corresponding database
 * activation has completed.
 * 
 * GET /api/verify-payment?reference=xxx
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

async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { reference } = req.query;

        if (!reference || typeof reference !== 'string') {
            return res.status(400).json({
                error: 'Missing or invalid payment reference'
            });
        }

        // Verify payment with Paystack
        const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Paystack verification error:', data);
            return res.status(response.status).json({
                error: 'Payment verification failed',
                details: data.message || 'Unknown error',
            });
        }

        const transaction = data.data;
        const metadata = transaction.metadata;

        // Check if database activation has been completed
        let dbActivated = false;
        if (transaction.status === 'success' && metadata && metadata.schoolId && metadata.dbIndex) {
            const dbIndex = Number(metadata.dbIndex);
            const schoolId = metadata.schoolId;
            const baseName = schoolId.split('_')[0].toLowerCase();
            
            // 1. First try checking using the Firestore REST API (no credentials required, fast)
            try {
                const projectId = process.env[`FIREBASE_${dbIndex}_PROJECT_ID`] || '';
                if (projectId) {
                    const restUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/subscriptions/${baseName}`;
                    const docRes = await fetch(restUrl);
                    if (docRes.ok) {
                        const docData = await docRes.json();
                        const payRef = docData.fields?.paymentReference?.stringValue;
                        if (payRef === reference) {
                            dbActivated = true;
                            console.log(`[Verify Payment] Activation verified successfully via Firestore REST API for ${baseName}`);
                        }
                    }
                }
            } catch (restErr) {
                console.warn('[Verify Payment] Firestore REST API check failed:', restErr);
            }

            // 2. Fallback to Admin SDK if REST check didn't succeed and credentials are available
            if (!dbActivated) {
                try {
                    const db = getAdminFirestore(dbIndex);
                    if (db) {
                        const subDoc = await db.collection('subscriptions').doc(baseName).get();
                        if (subDoc.exists && subDoc.data()?.paymentReference === reference) {
                            dbActivated = true;
                        }
                    } else {
                        console.warn('[Verify Payment] Firestore credentials not available for database activation check fallback.');
                    }
                } catch (err) {
                    console.warn('[Verify Payment] Admin SDK database activation check failed:', err);
                }
            }
        }

        // Return payment details
        return res.status(200).json({
            success: true,
            status: transaction.status,
            amount: transaction.amount / 100, // Convert from pesewas
            currency: transaction.currency,
            reference: transaction.reference,
            paidAt: transaction.paid_at,
            metadata: metadata,
            dbActivated,
            customer: {
                email: transaction.customer.email,
            },
        });

    } catch (error: any) {
        console.error('Verify payment error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        });
    }
}

export default allowCors(handler);
