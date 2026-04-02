
import admin from 'firebase-admin';
import fs from 'fs';

// INSTRUCTIONS:
// 1. Ensure 'serviceAccountKey.json' is present.
// 2. Run: node fix_subject_buckets.js <schoolId>

if (process.argv.length < 3) {
    console.log('Usage: node fix_subject_buckets.js <schoolId>');
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

async function fixBuckets() {
    console.log(`\n🛠️  Cleaning up Score Buckets for School: ${schoolId}\n`);
    
    const bucketsRef = db.collection('schools').doc(schoolId).collection('score_buckets');
    const snapshot = await bucketsRef.get();
    
    if (snapshot.empty) {
        console.log('No score buckets found.');
        return;
    }

    const migrationMap = new Map(); // targetBucketId -> { scoreId -> scoreData }
    const itemsToDelete = new Map(); // sourceBucketId -> [scoreIds]

    for (const doc of snapshot.docs) {
        const sourceBucketId = doc.id;
        const expectedSubjectId = parseInt(sourceBucketId.replace('subject_', ''));
        const scoresMap = doc.data().scoresMap || {};
        
        Object.entries(scoresMap).forEach(([scoreId, score]) => {
            const actualSubjectId = Number(score.subjectId);
            if (actualSubjectId !== expectedSubjectId) {
                const targetBucketId = `subject_${actualSubjectId}`;
                
                console.log(`📍 Found misplaced score ${scoreId} (Subject ${actualSubjectId}) in ${sourceBucketId}. Queuing move to ${targetBucketId}...`);
                
                if (!migrationMap.has(targetBucketId)) migrationMap.set(targetBucketId, {});
                migrationMap.get(targetBucketId)[scoreId] = score;

                if (!itemsToDelete.has(sourceBucketId)) itemsToDelete.set(sourceBucketId, []);
                itemsToDelete.get(sourceBucketId).push(scoreId);
            }
        });
    }

    if (migrationMap.size === 0) {
        console.log('\n✅ Everything is already in the correct place. Nothing to fix!');
        return;
    }

    console.log(`\n📤 Starting Data Migration (${migrationMap.size} buckets affected)...`);

    for (const [bucketId, scoresToMove] of migrationMap.entries()) {
        const bucketRef = bucketsRef.doc(bucketId);
        await bucketRef.set({ scoresMap: scoresToMove }, { merge: true });
        console.log(`   ✅ Wrote misplaced scores to ${bucketId}`);
    }

    console.log(`\n🗑️  Cleaning up original buckets...`);
    for (const [bucketId, scoreIds] of itemsToDelete.entries()) {
        const bucketRef = bucketsRef.doc(bucketId);
        const updates = {};
        scoreIds.forEach(id => {
            updates[`scoresMap.${id}`] = admin.firestore.FieldValue.delete();
        });
        await bucketRef.update(updates);
        console.log(`   ✅ Deleted misplaced scores from ${bucketId}`);
    }

    console.log(`\n🎉 Data Cleanup Complete!`);
}

fixBuckets().catch(console.error);
