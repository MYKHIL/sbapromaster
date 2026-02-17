import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';

// -----------------------------------------------------------------------------
// FIREBASE ADMIN MANAGEMENT
// -----------------------------------------------------------------------------
const getDbForIndex = (dbIndex: number) => {
    const appName = `db_${dbIndex}`;

    // If already initialized, return it
    const existingApp = admin.apps.find(app => app?.name === appName);
    if (existingApp) return existingApp.firestore();

    const serviceAccountVar = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
    const serviceAccount = serviceAccountVar ? JSON.parse(serviceAccountVar) : null;

    if (!serviceAccount) {
        throw new Error('FIREBASE_ADMIN_SERVICE_ACCOUNT is missing in environment variables');
    }

    // Determine the Project ID for this index from environment variables
    // This allows the API to write to any of the 4+ projects
    const projectId = process.env[`FIREBASE_${dbIndex}_PROJECT_ID`];

    if (!projectId) {
        throw new Error(`Project ID for Database ${dbIndex} not found in environment`);
    }

    // CRITICAL: We use the same service account credentials but override the Project ID
    // This works if the service account has been granted "Owner" or "Cloud Datastore User" 
    // permissions across all projects in the Firebase Organization.
    const app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: projectId
    }, appName);

    return app.firestore();
};

/**
 * Subscription Activation Endpoint
 * 
 * Activates a subscription matching the logic of the manual "Web Approval" tool.
 * 
 * Logic:
 * 1. Verify Payment
 * 2. Calculate Expiry
 * 3. Write to 'subscriptions/{baseName}'
 * 4. Find all school variants (Name_Year_Term) and set Access: true
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
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { reference, schoolId, schoolName, dbIndex, tier } = req.body;

        if (!reference || !schoolId || !tier) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // 1. Verify payment (Skip for FREE tier if reference starts with FREE_)
        if (!reference.startsWith('FREE_')) {
            const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json',
                },
            });

            const paystackData = await paystackResponse.json();

            if (!paystackResponse.ok || paystackData.data.status !== 'success') {
                return res.status(400).json({ error: 'Payment verification failed' });
            }
        }

        const db = getDbForIndex(Number(dbIndex || 1));

        // 2. Derive Base Name (e.g., "ayirebida" from "ayirebida_2025-2026_First-Term")
        const baseName = schoolId.split('_')[0];

        if (!baseName) {
            return res.status(400).json({ error: 'Invalid school ID format' });
        }

        // ---------------------------------------------------------------------
        // 3. TRIAL ELIGIBILITY CHECK
        // ---------------------------------------------------------------------
        const isTrial = reference.startsWith('FREE_');
        const subDocRef = db.collection('subscriptions').doc(baseName);
        const existingSub = await subDocRef.get();

        if (isTrial && existingSub.exists) {
            return res.status(400).json({
                error: 'Trial Unavailable',
                message: 'A trial or subscription has already been activated for this school. Trials are one-time only.'
            });
        }

        // 4. Calculate Expiry
        const now = new Date();
        const expiryDate = new Date();
        const durationStr = (tier.duration || '1 Year').toLowerCase();

        if (durationStr.includes('week')) {
            const weeks = parseInt(durationStr) || 1;
            expiryDate.setDate(now.getDate() + (weeks * 7));
        } else if (durationStr.includes('month')) {
            const months = parseInt(durationStr) || 12;
            expiryDate.setMonth(now.getMonth() + months);
        } else if (durationStr.includes('year')) {
            const years = parseInt(durationStr) || 1;
            expiryDate.setFullYear(now.getFullYear() + years);
        } else {
            // Default to 1 year
            expiryDate.setFullYear(now.getFullYear() + 1);
        }

        // 5. Prepare Subscription Document (Matches Web Approval structure)
        const subscriptionData = {
            maxStudents: parseInt(tier.maxStudents),
            maxClass: parseInt(tier.maxClass),
            expiryDate: admin.firestore.Timestamp.fromDate(expiryDate),
            lastActivated: admin.firestore.Timestamp.now(),
            activationHash: isTrial ? 'TRIAL_ACTIVATION' : 'ONLINE_PAYMENT',
            planName: tier.name,
            paymentReference: reference
        };

        // 6. Write to 'subscriptions' collection
        console.log(`[Activation] Writing subscription for ${baseName} on DB ${dbIndex}`);
        await subDocRef.set(subscriptionData, { merge: true });

        // 7. Batch Update Access for All Variants
        console.log(`[Activation] Searching for variants of ${baseName}...`);

        const variantsSnapshot = await db.collection('schools')
            .where(admin.firestore.FieldPath.documentId(), '>=', baseName)
            .where(admin.firestore.FieldPath.documentId(), '<', baseName + '_\uf8ff')
            .get();

        console.log(`[Activation] Found ${variantsSnapshot.size} variants.`);

        const batch = db.batch();
        let variantsCount = 0;

        variantsSnapshot.forEach(doc => {
            if (doc.id === baseName || doc.id.startsWith(baseName + '_')) {
                batch.set(doc.ref, { Access: true }, { merge: true });
                variantsCount++;
            }
        });

        if (variantsCount > 0) {
            await batch.commit();
        } else {
            // Ensure at least the requested schoolId is updated
            await db.collection('schools').doc(schoolId).set({ Access: true }, { merge: true });
            variantsCount = 1;
        }

        return res.status(200).json({
            success: true,
            message: `Subscription activated for ${baseName} and ${variantsCount} variants.`,
            expiryDate,
            variantsActivated: variantsCount
        });

    } catch (error: any) {
        console.error('Activation error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        });
    }
}

export default allowCors(handler);
