import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    try {
        const serviceAccount = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT
            ? JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT)
            : {};

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.error('Firebase Admin initialization failed:', error);
    }
}

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
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

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

        const db = admin.firestore();

        // 2. Logic to derive Base Name (e.g., "ayirebida" from "ayirebida_2025-2026_First-Term")
        // The Web Approval tool uses school.id.split('_')[0]
        const baseName = schoolId.split('_')[0];

        if (!baseName) {
            return res.status(400).json({ error: 'Invalid school ID format' });
        }

        // 3. Calculate Expiry
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

        // 4. Prepare Subscription Document (Matches Web Approval structure)
        const subscriptionData = {
            maxStudents: parseInt(tier.maxStudents),
            maxClass: parseInt(tier.maxClass),
            expiryDate: admin.firestore.Timestamp.fromDate(expiryDate),
            lastActivated: admin.firestore.Timestamp.now(),
            activationHash: 'ONLINE_PAYMENT', // Placeholder to indicate online activation
            planName: tier.name,
            paymentReference: reference
        };

        // 5. Write to 'subscriptions' collection
        console.log(`[Activation] Writing subscription for ${baseName}`);
        await db.collection('subscriptions').doc(baseName).set(subscriptionData, { merge: true });

        // 6. Batch Update Access for All Variants
        // We need to find all documents in 'schools' that start with baseName + '_'
        // Use a range query on document ID (__name__)
        console.log(`[Activation] Searching for variants of ${baseName}...`);

        // Query for exact match or prefix match
        // Note: In Firestore admin, FieldPath.documentId() refers to the key
        const variantsSnapshot = await db.collection('schools')
            .where(admin.firestore.FieldPath.documentId(), '>=', baseName)
            .where(admin.firestore.FieldPath.documentId(), '<', baseName + '_\uf8ff')
            .get();

        // Also check for the exact baseName itself if it exists as a school doc (unlikely but possible)
        // actually the range query includes baseName itself if it matches.

        console.log(`[Activation] Found ${variantsSnapshot.size} variants.`);

        const batch = db.batch();
        let variantsCount = 0;

        variantsSnapshot.forEach(doc => {
            // Double check prefix to be safe (range query is reliable but good to be sure)
            if (doc.id === baseName || doc.id.startsWith(baseName + '_')) {
                batch.set(doc.ref, { Access: true }, { merge: true });
                variantsCount++;
            }
        });

        if (variantsCount > 0) {
            await batch.commit();
        } else {
            // If no variants found via query, at least update the requested schoolId
            await db.collection('schools').doc(schoolId).set({ Access: true }, { merge: true });
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
