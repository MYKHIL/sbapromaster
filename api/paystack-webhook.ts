import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

const isLocal = process.env.NODE_ENV === 'development';
const safeLog = (...args: any[]) => {
  if (isLocal) {
    console.log(...args);
  }
};

const allowCors = (fn: (req: VercelRequest, res: VercelResponse) => Promise<any>) =>
  async (req: VercelRequest, res: VercelResponse) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    return await fn(req, res);
  };

function getAdminFirestoreForIndex(dbIndex: number) {
  const appName = `db_admin_${dbIndex}`;
  const existingApp = Array.isArray((admin as any).apps)
    ? (admin as any).apps.find((app: any) => app?.name === appName)
    : undefined;
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
    app = admin.initializeApp(
      {
        credential: admin.credential.refreshToken(token),
        projectId,
      },
      appName
    );
  } else {
    const serviceAccountStr = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT || '{}';
    const serviceAccount = JSON.parse(serviceAccountStr);
    if (serviceAccount && serviceAccount.project_id === projectId) {
      app = admin.initializeApp(
        {
          credential: admin.credential.cert(serviceAccount),
          projectId,
        },
        appName
      );
    } else {
      throw new Error(`No credentials configured for database ${dbIndex}. Ensure FIREBASE_${dbIndex}_TOKEN is set.`);
    }
  }

  return app.firestore();
}

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

function addMonthsSafely(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const currentDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const targetYear = result.getUTCFullYear();
  const targetMonth = result.getUTCMonth();
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(currentDay, lastDayOfTargetMonth));
  return result;
}

function addTimeSafely(baseDate: Date, durationStr: string): Date {
  const cleanDuration = durationStr.toLowerCase();
  const amount = parseInt(cleanDuration, 10) || 1;
  const expiryDate = new Date(baseDate.getTime());

  if (cleanDuration.includes('week')) {
    expiryDate.setUTCDate(expiryDate.getUTCDate() + amount * 7);
  } else if (cleanDuration.includes('term')) {
    return addMonthsSafely(expiryDate, amount * 4);
  } else if (cleanDuration.includes('month')) {
    return addMonthsSafely(expiryDate, amount);
  } else if (cleanDuration.includes('year')) {
    return addMonthsSafely(expiryDate, amount * 12);
  }

  return addMonthsSafely(expiryDate, 12);
}

async function updateStudentBucketAdmin(
  db: admin.firestore.Firestore,
  schoolId: string,
  students: any[],
  initialChunkSize: number = 10000
) {
  const writeChunksWithBackoff = async (studentsData: any[], chunkSize: number): Promise<void> => {
    const totalChunks = Math.ceil(studentsData.length / chunkSize);
    const batch = db.batch();
    const manifestRef = db.collection('schools').doc(schoolId).collection('config').doc('student_bucket_manifest');

    batch.set(manifestRef, {
      totalChunks,
      totalStudents: studentsData.length,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      chunkSize,
    });

    for (let i = 0; i < totalChunks; i++) {
      const chunk = studentsData.slice(i * chunkSize, (i + 1) * chunkSize);
      const chunkRef = db.collection('schools').doc(schoolId).collection('config').doc(`student_bucket_${i}`);
      batch.set(chunkRef, { students: chunk });
    }

    try {
      await batch.commit();
    } catch (error: any) {
      const message = String(error?.message || error);
      const isSizeError = message.includes('size') && message.includes('exceeds');
      if (isSizeError && chunkSize > 1) {
        return writeChunksWithBackoff(studentsData, Math.max(1, Math.floor(chunkSize / 2)));
      }
      throw error;
    }
  };

  await writeChunksWithBackoff(students, initialChunkSize);
}

async function logManualReconciliation(
  reference: string,
  schoolId: string,
  payload: any,
  error: any,
  dbIndex?: number
) {
  try {
    const adminDb = getAdminFirestoreForIndex(dbIndex || 1);
    await adminDb.collection('manual_reconciliation').doc(reference).set(
      {
        reference,
        schoolId,
        payload,
        error: String(error?.message || error),
        dbIndex: dbIndex || null,
        recordedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (logError: any) {
    console.error('[Webhook] Failed to persist manual reconciliation record.', logError);
  }
}

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const secretKey = (process.env.PAYSTACK_SECRET_KEY || '').trim();
    const signature = req.headers['x-paystack-signature'];

    if (!secretKey) {
      console.error('[Webhook] PAYSTACK_SECRET_KEY not configured');
      return res.status(500).json({ error: 'Paystack Secret Key not configured on server' });
    }

    if (!signature) {
      console.warn('[Webhook] Missing Paystack signature header');
      return res.status(401).json({ error: 'Missing Paystack signature' });
    }

    const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const expectedHash = crypto.createHmac('sha512', secretKey).update(payload).digest('hex');
    if (expectedHash !== signature) {
      console.warn('[Webhook] Paystack signature mismatch');
      return res.status(401).json({ error: 'Invalid Paystack signature' });
    }

    const body = req.body;
    const eventType = body.event;
    const eventData = body.data;
    const reference = eventData?.reference;

    if (eventType !== 'charge.success') {
      return res.status(200).json({ success: true, message: 'Event type ignored' });
    }

    if (!reference) {
      return res.status(400).json({ error: 'Missing transaction reference in payload' });
    }

    safeLog('[Webhook] Verifying Paystack transaction for reference', reference);
    const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
    });
    const verifyData = await verifyResponse.json();

    if (!verifyResponse.ok || verifyData.data?.status !== 'success') {
      console.error('[Webhook] Secondary Paystack verification failed', verifyData);
      return res.status(400).json({ error: 'Payment verification failed' });
    }

    const transaction = verifyData.data;
    const metadata = transaction.metadata || eventData?.metadata || {};
    const schoolId = String(metadata.schoolId || '').trim();
    const tierName = String(metadata.tierName || '').trim();

    if (!schoolId || !tierName) {
      console.error('[Webhook] Missing required metadata on transaction', reference);
      return res.status(400).json({ error: 'Missing metadata in Paystack transaction' });
    }

    const schoolName = String(metadata.schoolName || '');
    const durationValue = Number(metadata.durationValue) || 1;
    const durationUnit = String(metadata.durationUnit || 'year');
    const requestedDbIndex = Number(metadata.dbIndex) || undefined;
    const baseName = schoolId.split('_')[0].toLowerCase();

    const tierKeySuffix = getTierKeySuffix(tierName);
    const maxStudents = parseInt(process.env[`VITE_TIER_STUDENTS_${tierKeySuffix}`] || '500', 10) || 500;
    const maxClass = parseInt(process.env[`VITE_TIER_CLASSES_${tierKeySuffix}`] || '20', 10) || 20;

    const dbIndex = requestedDbIndex && !Number.isNaN(requestedDbIndex) ? requestedDbIndex : 1;
    const db = getAdminFirestoreForIndex(dbIndex);

    const subDocRef = db.collection('subscriptions').doc(baseName);
    const existingSub = await subDocRef.get();
    const now = new Date();
    let baseDate = new Date(now.getTime());

    if (existingSub.exists) {
      const existingData = existingSub.data();
      if (existingData?.expiryDate) {
        const existingExpiry = existingData.expiryDate.toDate();
        if (existingExpiry > now) {
          baseDate = new Date(existingExpiry.getTime());
        }
      }
    }

    const durationLabel = `${durationValue} ${durationUnit}${durationValue > 1 ? 's' : ''}`;
    const expiryDate = addTimeSafely(baseDate, durationLabel);

    const subscriptionData = {
      planName: tierName,
      maxStudents,
      maxClass,
      expiryDate: admin.firestore.Timestamp.fromDate(expiryDate),
      lastActivated: admin.firestore.FieldValue.serverTimestamp(),
      paymentReference: reference,
      dbIndex,
      schoolName,
      rawPaystackTransaction: {
        id: transaction.id,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        paidAt: transaction.paid_at,
      },
    };

    const pendingRegRef = db.collection('pending_registrations').doc(reference);
    const pendingRegDoc = await pendingRegRef.get();
    const isNewSchool = pendingRegDoc.exists;

    try {
      if (isNewSchool) {
        safeLog('[Webhook] Applying new school activation for', schoolId, 'on db', dbIndex);
        const pendingData = pendingRegDoc.data() || {};
        const registrationData = pendingData.registrationData || {};

        await subDocRef.set(subscriptionData, { merge: true });

        const schoolRef = db.collection('schools').doc(schoolId);
        const batch = db.batch();
        batch.set(
          schoolRef,
          {
            ...registrationData,
            schoolName,
            Access: true,
          },
          { merge: true }
        );

        batch.set(
          db.collection('meta').doc('database_info'),
          {
            tenantCount: admin.firestore.FieldValue.increment(1),
            lastAssignedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        await batch.commit();

        const batch2 = db.batch();
        ['subjects', 'assessments', 'classes', 'grades'].forEach((collectionName) => {
          const list = (registrationData as any)[collectionName];
          if (Array.isArray(list)) {
            list.forEach((item: any) => {
              if (item && item.id != null) {
                batch2.set(schoolRef.collection(collectionName).doc(String(item.id)), item, { merge: true });
              }
            });
          }
        });

        batch2.set(
          schoolRef.collection('config').doc('metadata_bundle'),
          {
            subjects: registrationData.subjects || [],
            assessments: registrationData.assessments || [],
            classes: registrationData.classes || [],
            grades: registrationData.grades || [],
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        await batch2.commit();

        if (Array.isArray(registrationData.students) && registrationData.students.length > 0) {
          await updateStudentBucketAdmin(db, schoolId, registrationData.students);
        }

        await pendingRegRef.delete();

        return res.status(200).json({ success: true, message: 'School activated successfully.' });
      }

      safeLog('[Webhook] Updating subscription for existing school', schoolId, 'on db', dbIndex);
      const batch = db.batch();
      batch.set(subDocRef, subscriptionData, { merge: true });

      const schoolsRef = db.collection('schools');
      const qVariants = schoolsRef
        .where(admin.firestore.FieldPath.documentId(), '>=', baseName)
        .where(admin.firestore.FieldPath.documentId(), '<=', `${baseName}    `);
      const variantSnapshot = await qVariants.get();
      let variantCount = 0;

      variantSnapshot.forEach((doc) => {
        if (doc.id === baseName || doc.id.startsWith(`${baseName}_`)) {
          batch.set(doc.ref, { Access: true }, { merge: true });
          variantCount += 1;
        }
      });

      if (variantCount === 0) {
        batch.set(db.collection('schools').doc(schoolId), { Access: true }, { merge: true });
      }

      await batch.commit();
      return res.status(200).json({ success: true, message: 'Subscription renewed successfully.' });
    } catch (dbError: any) {
      console.error('[Webhook] Firestore update failed after payment succeeded', dbError);
      await logManualReconciliation(reference, schoolId, { metadata, transaction }, dbError, dbIndex);
      return res.status(500).json({ error: 'Payment received but database update failed. Manual reconciliation logged.' });
    }
  } catch (error: any) {
    console.error('[Webhook Error]:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

export default allowCors(handler);
