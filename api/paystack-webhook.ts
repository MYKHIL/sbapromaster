import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import crypto from 'crypto';
import { getAdminFirestore } from './_lib/admin-firestore';

const isLocal = process.env.NODE_ENV === 'development';
const safeLog = (...args: any[]) => {
    if (isLocal) {
        console.log(...args);
    }
};

/**
 * Paystack Webhook Handler
 * 
 * Verifies Paystack notifications and runs administrative database writes
 * to activate or renew subscriptions.
 * 
 * POST /api/paystack-webhook
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

// Safe UTC Date month-addition helper to prevent month-end wrapping/skipping bugs
function addMonthsSafely(date: Date, months: number): Date {
    const result = new Date(date.getTime());
    const currentDay = result.getUTCDate();
    
    // Set to day 1 to bypass end-of-month rollover overflow
    result.setUTCDate(1);
    result.setUTCMonth(result.getUTCMonth() + months);
    
    // Determine the last day of the new target month
    const targetYear = result.getUTCFullYear();
    const targetMonth = result.getUTCMonth();
    const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    
    // Clamp day to maximum of the target month
    result.setUTCDate(Math.min(currentDay, lastDayOfTargetMonth));
    return result;
}

// Time addition orchestrator
function addTimeSafely(baseDate: Date, durationStr: string): Date {
    const cleanDuration = durationStr.toLowerCase();
    const amount = parseInt(cleanDuration) || 1;
    const expiryDate = new Date(baseDate.getTime());
    
    if (cleanDuration.includes('week')) {
        expiryDate.setUTCDate(expiryDate.getUTCDate() + (amount * 7));
    } else if (cleanDuration.includes('term')) {
        return addMonthsSafely(expiryDate, amount * 4);
    } else if (cleanDuration.includes('month')) {
        return addMonthsSafely(expiryDate, amount);
    } else if (cleanDuration.includes('year')) {
        return addMonthsSafely(expiryDate, amount * 12);
    } else {
        return addMonthsSafely(expiryDate, 12);
    }
    return expiryDate;
}

// Manifest student chunks to avoid Firestore document limits (admin-version of client method)
async function updateStudentBucketAdmin(db: admin.firestore.Firestore, schoolId: string, students: any[], initialChunkSize: number = 10000) {
    const writeChunksWithBackoff = async (
        studentsData: any[],
        chunkSize: number,
        attempt: number = 1
    ): Promise<void> => {
        const totalChunks = Math.ceil(studentsData.length / chunkSize);
        const batch = db.batch();
        
        const manifestRef = db.collection("schools").doc(schoolId).collection("config").doc("student_bucket_manifest");
        batch.set(manifestRef, {
            totalChunks,
            totalStudents: studentsData.length,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            chunkSize
        });
        
        for (let i = 0; i < totalChunks; i++) {
            const chunk = studentsData.slice(i * chunkSize, (i + 1) * chunkSize);
            const chunkRef = db.collection("schools").doc(schoolId).collection("config").doc(`student_bucket_${i}`);
            batch.set(chunkRef, { students: chunk });
        }
        
        try {
            await batch.commit();
        } catch (error: any) {
            const isSizeError = error?.message?.includes('size') && error?.message?.includes('exceeds the maximum allowed size');
            if (isSizeError && chunkSize > 1) {
                const newChunkSize = Math.max(1, Math.floor(chunkSize / 2));
                return writeChunksWithBackoff(studentsData, newChunkSize, attempt + 1);
            } else if (chunkSize === 1) {
                throw new Error('Individual student record exceeds 1MB.');
            } else {
                throw error;
            }
        }
    };
    
    await writeChunksWithBackoff(students, initialChunkSize);
}

async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const secretKey = (process.env.PAYSTACK_SECRET_KEY || '').trim();
        const signature = req.headers['x-paystack-signature'];

        if (!secretKey) {
            console.error('[Webhook] Paystack Secret Key not configured');
            return res.status(500).json({ error: 'Paystack Secret Key not configured on server' });
        }

        // 1. Verify Event Origin
        // Standard signature verification
        let isValidEvent = false;
        if (signature) {
            const hash = crypto.createHmac('sha512', secretKey)
                .update(typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
                .digest('hex');
            
            if (hash === signature) {
                isValidEvent = true;
            }
        }

        const body = req.body;
        const reference = body.data?.reference;

        if (!reference) {
            return res.status(400).json({ error: 'Missing transaction reference in payload' });
        }

        // Force secondary verification by fetching directly from Paystack API to ensure absolute safety
        safeLog(`[Webhook] Fetching verification for reference: ${reference}`);
        const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${secretKey}`,
                'Content-Type': 'application/json',
            },
        });

        const verifyData = await verifyResponse.json();

        if (!verifyResponse.ok || verifyData.data?.status !== 'success') {
            console.error(`[Webhook] Secondary Paystack verification failed for: ${reference}`, verifyData);
            return res.status(400).json({ error: 'Payment verification failed' });
        }

        safeLog(`[Webhook] Payment verified successfully via Paystack API.`);

        const transaction = verifyData.data;
        const metadata = transaction.metadata;

        if (!metadata || !metadata.schoolId || !metadata.dbIndex || !metadata.tierName) {
            console.error('[Webhook] Critical metadata missing from transaction:', transaction.id);
            return res.status(400).json({ error: 'Missing metadata in Paystack transaction record' });
        }

        const { schoolId, schoolName, dbIndex, tierName, durationValue, durationUnit } = metadata;
        const baseName = schoolId.split('_')[0].toLowerCase();

        // Get student & class limits for the active tier
        const tierKeySuffix = getTierKeySuffix(tierName);
        const maxStudents = parseInt(process.env[`VITE_TIER_STUDENTS_${tierKeySuffix}`] || '500') || 500;
        const maxClass = parseInt(process.env[`VITE_TIER_CLASSES_${tierKeySuffix}`] || '20') || 20;

        // Initialize Firestore
        const db = getAdminFirestore(Number(dbIndex));

        // 2. Calculate New Expiry Date
        const subDocRef = db.collection('subscriptions').doc(baseName);
        const subDoc = await subDocRef.get();
        const now = new Date();
        let baseDate = new Date();

        if (subDoc.exists) {
            const subData = subDoc.data();
            if (subData?.expiryDate) {
                const existingExpiry = subData.expiryDate.toDate();
                // Cumulative activation if unexpired
                if (existingExpiry > now) {
                    baseDate = new Date(existingExpiry.getTime());
                }
            }
        }

        const customDurationStr = `${durationValue} ${durationUnit}${durationValue > 1 ? 's' : ''}`;
        const expiryDate = addTimeSafely(baseDate, customDurationStr);

        const subscriptionData = {
            maxStudents,
            maxClass,
            expiryDate: admin.firestore.Timestamp.fromDate(expiryDate),
            lastActivated: admin.firestore.FieldValue.serverTimestamp(),
            activationHash: process.env.PASSWORD_HASH || 'c93a215026f36ac783bcac8ba5e4bbea1c3cdb6c79d3824f9712143c44dbb0f3',
            planName: tierName,
            paymentReference: reference
        };

        // 3. Check for Deferral / Pending Registration (New School setup)
        const pendingRegRef = db.collection('pending_registrations').doc(reference);
        const pendingRegDoc = await pendingRegRef.get();

        if (pendingRegDoc.exists) {
            safeLog(`[Webhook] Found pending registration for school: ${schoolId}. Processing full manifestation...`);
            const pendingData = pendingRegDoc.data()!;
            const registrationData = pendingData.registrationData;

            // Step 1: Write Subscription Record
            await subDocRef.set(subscriptionData, { merge: true });

            // Step 2: Write root school record
            const batch1 = db.batch();
            const mainDocRef = db.collection('schools').doc(schoolId);
            const { subjects, assessments, classes, students, scores, ...mainData } = registrationData;

            batch1.set(mainDocRef, {
                ...mainData,
                password: pendingData.password,
                Access: true,
                activationHash: process.env.PASSWORD_HASH || 'c93a215026f36ac783bcac8ba5e4bbea1c3cdb6c79d3824f9712143c44dbb0f3'
            }, { merge: true });

            // Update Access on all variants
            const schoolsRefList = db.collection('schools');
            const qVariants = schoolsRefList
                .where(admin.firestore.FieldPath.documentId(), '>=', baseName)
                .where(admin.firestore.FieldPath.documentId(), '<=', baseName + '\uf8ff');
            const variantSnapshot = await qVariants.get();
            
            variantSnapshot.forEach(d => {
                if (d.id === baseName || d.id.startsWith(baseName + '_')) {
                    batch1.set(d.ref, {
                        Access: true,
                        activationHash: process.env.PASSWORD_HASH || 'c93a215026f36ac783bcac8ba5e4bbea1c3cdb6c79d3824f9712143c44dbb0f3'
                    }, { merge: true });
                }
            });

            await batch1.commit();

            // Step 3: Initialize subcollections and configurations
            const batch2 = db.batch();
            ['subjects', 'assessments', 'classes', 'grades'].forEach(col => {
                const data = (registrationData as any)[col];
                if (data && Array.isArray(data)) {
                    data.forEach((item: any) => {
                        if (item.id) {
                            const ref = db.collection('schools').doc(schoolId).collection(col).doc(String(item.id));
                            batch2.set(ref, item, { merge: true });
                        }
                    });
                }
            });

            // Metadata bundle
            const bundleRef = db.collection('schools').doc(schoolId).collection('config').doc('metadata_bundle');
            batch2.set(bundleRef, {
                subjects: registrationData.subjects || [],
                assessments: registrationData.assessments || [],
                classes: registrationData.classes || [],
                grades: registrationData.grades || [],
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            await batch2.commit();

            // Step 4: Chunked student manifestation
            if (registrationData.students && registrationData.students.length > 0) {
                await updateStudentBucketAdmin(db, schoolId, registrationData.students);
            }

            // Cleanup pending registration
            await pendingRegRef.delete();
            safeLog(`[Webhook] Manifestation complete for school: ${schoolId}. Cleaned pending_registrations.`);

        } else {
            // Existing school renewal or upgrade
            safeLog(`[Webhook] No pending registration found. Performing standard renewal/upgrade for school: ${schoolId}`);
            
            const batch = db.batch();
            batch.set(subDocRef, subscriptionData, { merge: true });

            const schoolsRefList = db.collection('schools');
            const qVariants = schoolsRefList
                .where(admin.firestore.FieldPath.documentId(), '>=', baseName)
                .where(admin.firestore.FieldPath.documentId(), '<=', baseName + '\uf8ff');
            const variantSnapshot = await qVariants.get();
            let variantsCount = 0;

            variantSnapshot.forEach(d => {
                if (d.id === baseName || d.id.startsWith(baseName + '_')) {
                    batch.set(d.ref, {
                        Access: true,
                        activationHash: process.env.PASSWORD_HASH || 'c93a215026f36ac783bcac8ba5e4bbea1c3cdb6c79d3824f9712143c44dbb0f3'
                    }, { merge: true });
                    variantsCount++;
                }
            });

            if (variantsCount === 0) {
                batch.set(db.collection('schools').doc(schoolId), {
                    Access: true,
                    activationHash: process.env.PASSWORD_HASH || 'c93a215026f36ac783bcac8ba5e4bbea1c3cdb6c79d3824f9712143c44dbb0f3'
                }, { merge: true });
            }

            await batch.commit();
            safeLog(`[Webhook] Subscription successfully activated/renewed for ${schoolId}.`);
        }

        return res.status(200).json({ success: true, message: 'Webhook processed successfully' });

    } catch (error: any) {
        console.error('[Webhook Error]:', error);
        return res.status(500).json({ error: 'Internal server error', message: error.message });
    }
}

export default allowCors(handler);
