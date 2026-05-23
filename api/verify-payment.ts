import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

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
function getAdminFirestore(dbIndex: number) {
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

    let app: admin.app.App;
    if (token) {
        app = admin.initializeApp({
            credential: admin.credential.refreshToken(token),
            projectId: projectId
        }, appName);
    } else {
        const serviceAccountStr = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT || '{}';
        const serviceAccount = JSON.parse(serviceAccountStr);
        if (serviceAccount && serviceAccount.project_id === projectId) {
            app = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: projectId
            }, appName);
        } else {
            throw new Error(`No credentials configured for database ${dbIndex}. Ensure FIREBASE_${dbIndex}_TOKEN is set.`);
        }
    }

    return app.firestore();
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

        // Check if database activation has been completed by webhook
        let dbActivated = false;
        if (transaction.status === 'success' && metadata && metadata.schoolId && metadata.dbIndex) {
            try {
                const dbIndex = Number(metadata.dbIndex);
                const schoolId = metadata.schoolId;
                const baseName = schoolId.split('_')[0].toLowerCase();
                const db = getAdminFirestore(dbIndex);
                const subDoc = await db.collection('subscriptions').doc(baseName).get();
                if (subDoc.exists && subDoc.data()?.paymentReference === reference) {
                    dbActivated = true;
                }
            } catch (err) {
                console.warn('[Verify Payment] Database activation check failed:', err);
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
