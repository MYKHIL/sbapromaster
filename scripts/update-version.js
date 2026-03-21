import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

// Load environment variables from .env if it exists (for local testing)
dotenv.config();

const PROJECT_ROOT = process.cwd();
const DATA_CONTEXT_PATH = path.join(PROJECT_ROOT, 'context', 'DataContext.tsx');

async function updateVersion() {
    console.log('🚀 Starting Multi-Database Version Update...');

    // 1. Calculate Version (Git Commit Count)
    let commitCount = 0;
    try {
        commitCount = parseInt(execSync('git rev-list --count HEAD').toString().trim(), 10);
    } catch (e) {
        console.warn('⚠️ Could not get git commit count, using timestamp instead.');
        commitCount = Math.floor(Date.now() / 1000);
    }
    const newVersion = `1.0.${commitCount}`;
    console.log(`📦 New Version: ${newVersion}`);

    // 2. Update DataContext.tsx for initial load consistency
    if (fs.existsSync(DATA_CONTEXT_PATH)) {
        let content = fs.readFileSync(DATA_CONTEXT_PATH, 'utf8');
        const pattern = /(const LATEST_VERSION = ")([^"]+)(";)/;
        if (pattern.test(content)) {
            content = content.replace(pattern, `$1${newVersion}$3`);
            fs.writeFileSync(DATA_CONTEXT_PATH, content);
            console.log('✅ Updated LATEST_VERSION in DataContext.tsx');
        } else {
            console.warn('⚠️ LATEST_VERSION constant not found in DataContext.tsx');
        }
    }

    // 3. Dynamic Firebase Discovery
    const firebaseConfigs = [];
    const envKeys = Object.keys(process.env);
    
    // Find all indices X where FIREBASE_X_API_KEY exists
    const indices = new Set();
    envKeys.forEach(key => {
        const match = key.match(/^FIREBASE_(\d+)_API_KEY$/);
        if (match) indices.add(match[1]);
    });

    console.log(`🔍 Found ${indices.size} Firebase configurations to update.`);

    for (const index of indices) {
        const config = {
            apiKey: process.env[`FIREBASE_${index}_API_KEY`],
            authDomain: process.env[`FIREBASE_${index}_AUTH_DOMAIN`],
            projectId: process.env[`FIREBASE_${index}_PROJECT_ID`],
            storageBucket: process.env[`FIREBASE_${index}_STORAGE_BUCKET`],
            messagingSenderId: process.env[`FIREBASE_${index}_MESSAGING_SENDER_ID`],
            appId: process.env[`FIREBASE_${index}_APP_ID`],
            measurementId: process.env[`FIREBASE_${index}_MEASUREMENT_ID`],
        };

        if (!config.apiKey || !config.projectId) {
            console.warn(`⚠️ Skipping Firebase config ${index} due to missing required fields.`);
            continue;
        }

        const appName = `temp-update-${index}-${Date.now()}`;
        let app;
        try {
            app = initializeApp(config, appName);
            const db = getFirestore(app);
            const deployDocRef = doc(db, 'system', 'deployment');

            await setDoc(deployDocRef, {
                version: newVersion,
                updatedAt: serverTimestamp(),
                deployedBy: 'Vercel Build Script',
                deploymentSecret: process.env.PASSWORD_HASH || ''
            }, { merge: true });

            console.log(`✅ Broadcasted to database ${index} (${config.projectId})`);
        } catch (error) {
            console.error(`❌ Failed to update database ${index} (${config.projectId}):`, error.message);
        } finally {
            if (app) await deleteApp(app).catch(() => {});
        }
    }

    console.log('✨ All databases processed.');
}

updateVersion().catch(err => {
    console.error('💥 Critical error in update-version script:', err);
    process.exit(1);
});
