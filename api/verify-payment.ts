import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminFirestore } from './_lib/admin-firestore';

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

            // 2. Fallback to Admin SDK if REST check didn't succeed
            if (!dbActivated) {
                try {
                    const db = getAdminFirestore(dbIndex);
                    const subDoc = await db.collection('subscriptions').doc(baseName).get();
                    if (subDoc.exists && subDoc.data()?.paymentReference === reference) {
                        dbActivated = true;
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
