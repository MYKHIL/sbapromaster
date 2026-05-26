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
 * Activates a 7-day trial for a school in a specific database.
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

// Initialize Firestore using public Firebase configuration for a specific database
async function getFirestoreDb(dbIndex: number): Promise<admin.firestore.Firestore> {
    const appName = `db_firestore_${dbIndex}`;
    
    // Check if app already initialized
    const existingApp = Array.isArray((admin as any).apps)
        ? (admin as any).apps.find((app: any) => app?.name === appName)
        : undefined;
    
    if (existingApp) {
        return existingApp.firestore();
    }

    // Get configuration from environment variables
    const apiKey = process.env[`FIREBASE_${dbIndex}_API_KEY`];
    const authDomain = process.env[`FIREBASE_${dbIndex}_AUTH_DOMAIN`];
    const projectId = process.env[`FIREBASE_${dbIndex}_PROJECT_ID`];
    const storageBucket = process.env[`FIREBASE_${dbIndex}_STORAGE_BUCKET`];
    const messagingSenderId = process.env[`FIREBASE_${dbIndex}_MESSAGING_SENDER_ID`];
    const appId = process.env[`FIREBASE_${dbIndex}_APP_ID`];

    if (!projectId || !apiKey || !authDomain || !storageBucket || !messagingSenderId || !appId) {
        throw new Error(`Incomplete Firebase configuration for database ${dbIndex}. Ensure all FIREBASE_${dbIndex}_* values are set.`);
    }

    // Choose credentials in order of availability.
    // Public config is used to identify the project, but server access still requires credentials.
    let credential: admin.credential.Credential | null = null;

    try {
        credential = admin.credential.applicationDefault();
    } catch (error: any) {
        // Not available in this environment.
    }

    // If ADC is unavailable, fallback to service account from env.
    if (!credential) {
        const serviceAccountRaw = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
        if (serviceAccountRaw) {
            try {
                const serviceAccount = JSON.parse(serviceAccountRaw);
                credential = admin.credential.cert(serviceAccount);
            } catch (parseError: any) {
                throw new Error(`Failed to parse FIREBASE_ADMIN_SERVICE_ACCOUNT: ${parseError.message}`);
            }
        }
    }

    // If a database-specific token is present, use it as an additional fallback.
    if (!credential) {
        const tokenRaw = process.env[`FIREBASE_${dbIndex}_TOKEN`];
        if (tokenRaw) {
            try {
                const tokenValue = tokenRaw.trim();
                if (tokenValue.startsWith('{')) {
                    const tokenPayload = JSON.parse(tokenValue);
                    credential = admin.credential.cert(tokenPayload);
                } else if (admin.credential && typeof admin.credential.refreshToken === 'function') {
                    credential = admin.credential.refreshToken(tokenValue);
                }
            } catch (tokenErr: any) {
                throw new Error(`Failed to parse FIREBASE_${dbIndex}_TOKEN: ${tokenErr.message}`);
            }
        }
    }

    if (!credential) {
        throw new Error(`Unable to initialize Firebase credentials for database ${dbIndex}. Ensure application default credentials are available or FIREBASE_ADMIN_SERVICE_ACCOUNT is configured.`);
    }

    const app = admin.initializeApp({
        credential,
        projectId
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
        
        // Get Firestore instance for this specific database
        let db: admin.firestore.Firestore;
        try {
            db = await getFirestoreDb(Number(dbIndex));
        } catch (firebaseErr: any) {
            console.error(`[Trial] Failed to initialize database ${dbIndex}:`, firebaseErr.message);
            return res.status(500).json({
                error: 'Database initialization failed',
                message: firebaseErr.message,
                details: `Failed to initialize Firestore using public configuration for database ${dbIndex}`
            });
        }

        // Check if subscription already exists
        const subDocRef = db.collection('subscriptions').doc(baseName);
        const subDoc = await subDocRef.get();

        if (subDoc.exists) {
            return res.status(400).json({
                error: 'Trial activation failed',
                message: 'A trial or subscription has already been activated for this school.'
            });
        }

        // Create subscription record for trial
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

        // Write subscription (reuse subDocRef from earlier check)
        await subDocRef.set(subscriptionData, { merge: true });

        // If there's pending registration data, write school data
        if (pendingRegistration && pendingRegistration.registrationData) {
            const registrationData = pendingRegistration.registrationData;
            const { subjects, assessments, classes, students, scores, ...mainData } = registrationData;

            // Write main school record
            const mainDocRef = db.collection('schools').doc(schoolId);
            await mainDocRef.set({
                ...mainData,
                password: pendingRegistration.password,
                Access: true,
                activationHash: process.env.PASSWORD_HASH || 'c93a215026f36ac783bcac8ba5e4bbea1c3cdb6c79d3824f9712143c44dbb0f3'
            }, { merge: true });

            // Write subcollections
            const batch = db.batch();
            ['subjects', 'assessments', 'classes', 'grades'].forEach(col => {
                const data = (registrationData as any)[col];
                if (data && Array.isArray(data)) {
                    data.forEach((item: any) => {
                        if (item.id) {
                            const ref = db.collection('schools').doc(schoolId).collection(col).doc(String(item.id));
                            batch.set(ref, item, { merge: true });
                        }
                    });
                }
            });

            // Write metadata bundle
            const bundleRef = db.collection('schools').doc(schoolId).collection('config').doc('metadata_bundle');
            batch.set(bundleRef, {
                subjects: registrationData.subjects || [],
                assessments: registrationData.assessments || [],
                classes: registrationData.classes || [],
                grades: registrationData.grades || [],
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            await batch.commit();

            // Write student data if present
            if (registrationData.students && registrationData.students.length > 0) {
                try {
                    await updateStudentBucketAdmin(db, schoolId, registrationData.students);
                } catch (studentErr: any) {
                    console.warn('[Trial] Student manifestation warning:', studentErr.message);
                    // Don't fail the entire trial activation for student write issues
                }
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Trial activated successfully',
            expiryDate: expiryDate.toISOString(),
            dbIndex,
            schoolId,
            schoolName
        });

    } catch (error: any) {
        console.error('[Trial Error]:', error);
        console.error('[Trial Error] Stack:', error?.stack);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}

export default allowCors(handler);
