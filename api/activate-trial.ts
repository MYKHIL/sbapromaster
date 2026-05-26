import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';

const isLocal = process.env.NODE_ENV === 'development';
const safeLog = (...args: any[]) => {
    if (isLocal) {
        console.log(...args);
    }
};

/**
 * Free Trial Activation Endpoint
 * 
 * Verifies that a school does not have an existing subscription, then securely
 * activates a 7-day trial and performs administrative database writes.
 * 
 * POST /api/activate-trial
 * Body: { schoolId, schoolName, dbIndex, email, pendingRegistration }
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
    const existingApp = Array.isArray((admin as any).apps)
        ? (admin as any).apps.find((app: any) => app?.name === appName)
        : undefined;
    if (existingApp) {
        return existingApp.firestore();
    }

    const tokenRaw = process.env[`FIREBASE_${dbIndex}_TOKEN`] || '';
    const projectId = process.env[`FIREBASE_${dbIndex}_PROJECT_ID`] || '';

    if (!projectId) {
        throw new Error(`Project ID for database ${dbIndex} is not configured.`);
    }

    let app: admin.app.App;
    let credential: admin.credential.Credential | null = null;
    if (tokenRaw) {
        if (admin.credential && typeof admin.credential.cert === 'function') {
            try {
                const tokenValue = tokenRaw.trim();
                let credentialPayload: any;
                
                // Try to parse as JSON (service account)
                if (tokenValue.startsWith('{')) {
                    credentialPayload = JSON.parse(tokenValue);
                    credential = admin.credential.cert(credentialPayload);
                } else if (admin.credential && typeof admin.credential.refreshToken === 'function') {
                    // Otherwise try as refresh token string
                    credential = admin.credential.refreshToken(tokenValue);
                } else {
                    console.error(`[Firebase Admin] Unsupported token format for database ${dbIndex}.`);
                }
            } catch (error: any) {
                console.error(`[Firebase Admin] Failed to initialize credential for database ${dbIndex}:`, error?.message || error);
                credential = null;
            }
        } else {
            console.error(`[Firebase Admin] admin.credential methods are not available for database ${dbIndex}.`);
        }
    }

    if (!credential) {
        throw new Error(`Unable to initialize Firebase credentials for database ${dbIndex}. Ensure FIREBASE_${dbIndex}_TOKEN is set with a valid service account JSON or refresh token, and FIREBASE_${dbIndex}_PROJECT_ID is configured.`);
    }

    app = admin.initializeApp({
        credential,
        projectId: projectId
    }, appName);

    return app.firestore();
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
        const { schoolId, schoolName, dbIndex, email, pendingRegistration } = req.body;

        if (!schoolId || !schoolName || !dbIndex || !email) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['schoolId', 'schoolName', 'dbIndex', 'email']
            });
        }

        const baseName = schoolId.split('_')[0].toLowerCase();
        
        let db: admin.firestore.Firestore;
        try {
            db = getAdminFirestore(Number(dbIndex));
        } catch (firebaseErr: any) {
            console.error(`[Trial] Firebase initialization failed for dbIndex ${dbIndex}:`, firebaseErr.message);
            return res.status(500).json({
                error: 'Database initialization failed',
                message: firebaseErr.message,
                details: `Failed to initialize Firestore for database ${dbIndex}`
            });
        }

        // 1. Double check existing subscriptions (trials are one-time only)
        const subDocRef = db.collection('subscriptions').doc(baseName);
        const subDoc = await subDocRef.get();

        if (subDoc.exists) {
            return res.status(400).json({
                error: 'Trial Unavailable',
                message: 'A trial or subscription has already been activated for this school.'
            });
        }

        // 2. Set Expiry (7 Days)
        const expiryDate = new Date();
        expiryDate.setUTCDate(expiryDate.getUTCDate() + 7);

        const reference = `FREE_${Date.now()}`;
        const subscriptionData = {
            maxStudents: 10,
            maxClass: 1,
            expiryDate: admin.firestore.Timestamp.fromDate(expiryDate),
            lastActivated: admin.firestore.FieldValue.serverTimestamp(),
            activationHash: process.env.PASSWORD_HASH || 'c93a215026f36ac783bcac8ba5e4bbea1c3cdb6c79d3824f9712143c44dbb0f3',
            planName: 'Trial',
            paymentReference: reference
        };

        // 3. Process setup
        if (pendingRegistration) {
            safeLog(`[Trial] Manifesting new trial school: ${schoolId}`);
            const registrationData = pendingRegistration.registrationData;

            // Step 1: Write Subscription Record
            await subDocRef.set(subscriptionData, { merge: true });

            // Step 2: Write root school record
            const batch1 = db.batch();
            const mainDocRef = db.collection('schools').doc(schoolId);
            const { subjects, assessments, classes, students, scores, ...mainData } = registrationData;

            batch1.set(mainDocRef, {
                ...mainData,
                password: pendingRegistration.password,
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

            safeLog(`[Trial] Manifestation complete for school: ${schoolId}`);

        } else {
            // Existing school trial (unlikely to have trial option if registered already, but handled for completeness)
            safeLog(`[Trial] Activating trial for existing school: ${schoolId}`);
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
        }

        return res.status(200).json({
            success: true,
            message: 'Trial activated successfully',
            expiryDate: expiryDate.toISOString()
        });

    } catch (error: any) {
        console.error('[Trial Error] Full error:', error);
        console.error('[Trial Error] Stack:', error?.stack);
        console.error('[Trial Error] Message:', error?.message);
        console.error('[Trial Error] Code:', error?.code);
        return res.status(500).json({ 
            error: 'Internal server error', 
            message: error.message,
            details: error?.code || 'Unknown error'
        });
    }
}

export default allowCors(handler);
