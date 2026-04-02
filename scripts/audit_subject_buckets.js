
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// INSTRUCTIONS:
// 1. Download your service account key from Firebase Console
// 2. Save it as 'serviceAccountKey.json' in this directory
// 3. Run: node audit_subject_buckets.js <schoolId>

if (process.argv.length < 3) {
    console.log('Usage: node audit_subject_buckets.js <schoolId>');
    process.exit(1);
}

const schoolId = process.argv[2];
const serviceAccountPath = './serviceAccountKey.json';

if (!fs.existsSync(serviceAccountPath)) {
    console.error('Error: serviceAccountKey.json not found.');
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function auditBuckets() {
    console.log(`\n🔍 Auditing Score Buckets for School: ${schoolId}\n`);
    
    const bucketsRef = db.collection('schools').doc(schoolId).collection('score_buckets');
    const snapshot = await bucketsRef.get();
    
    if (snapshot.empty) {
        console.log('No score buckets found for this school.');
        return;
    }

    let totalMismatches = 0;
    
    for (const doc of snapshot.docs) {
        const bucketId = doc.id; // e.g., subject_11
        const expectedSubjectId = parseInt(bucketId.replace('subject_', ''));
        const data = doc.data();
        const scoresMap = data.scoresMap || {};
        
        const scoreEntries = Object.entries(scoresMap);
        const mismatches = [];
        
        scoreEntries.forEach(([scoreId, score]) => {
            if (Number(score.subjectId) !== expectedSubjectId) {
                mismatches.push({
                    scoreId,
                    actualSubjectId: score.subjectId,
                    expectedSubjectId
                });
            }
        });

        if (mismatches.length > 0) {
            console.log(`❌ Bucket [${bucketId}] has ${mismatches.length} MISPLACED scores!`);
            mismatches.forEach(m =\u003e {
                console.log(`   - Score ${m.scoreId} belongs to Subject ${m.actualSubjectId} but is in Subject ${m.expectedSubjectId} bucket.`);
            });
            totalMismatches += mismatches.length;
        } else {
            console.log(`✅ Bucket [${bucketId}] is CLEAN (${scoreEntries.length} items).`);
        }
    }

    console.log(`\n-----------------------------------------`);
    if (totalMismatches \u003e 0) {
        console.log(`🔴 TOTAL MISPLACED SCORES FOUND: ${totalMismatches}`);
        console.log(`\nRECOMMENDATION: Run the cleanup script (coming soon) to move these scores to their correct buckets.`);
    } else {
        console.log(`🟢 NO MISPLACED SCORES FOUND. Data integrity looks good!`);
    }
}

auditBuckets().catch(console.error);
