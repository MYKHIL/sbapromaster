import React, { useEffect, useState } from 'react';
import { useFirebaseAnalytics } from '../../context/FirebaseAnalyticsContext';
import { useData } from '../../context/DataContext';

const FirebaseAnalytics: React.FC = () => {
    const {
        operations,
        clearHistory,
        getTotalReads,
        getTotalWrites,
        getStorageUsage
    } = useFirebaseAnalytics();

    const [storageUsage, setStorageUsage] = useState({ used: 0, total: 0 });

    useEffect(() => {
        const updateStorage = () => {
            setStorageUsage(getStorageUsage());
        };
        updateStorage();
        const interval = setInterval(updateStorage, 2000);
        return () => clearInterval(interval);
    }, []);

    const totalReads = getTotalReads();
    const totalWrites = getTotalWrites();
    const storagePercent = (storageUsage.used / storageUsage.total) * 100;

    // Group operations by type for breakdown
    const readsByOperation = operations
        .filter(op => op.type === 'read')
        .reduce((acc, op) => {
            acc[op.operation] = (acc[op.operation] || 0) + (op.docCount || 1);
            return acc;
        }, {} as Record<string, number>);

    const writesByOperation = operations
        .filter(op => op.type === 'write')
        .reduce((acc, op) => {
            acc[op.operation] = (acc[op.operation] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

    // Estimate cost (Firebase pricing: $0.06 per 100,000 reads, $0.18 per 100,000 writes)
    const estimatedCost = (totalReads * 0.06 / 100000) + (totalWrites * 0.18 / 100000);

    // Recent operations (last 20)
    const recentOps = operations.slice(-20).reverse();

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">📊 Firebase Analytics</h1>
                <p className="text-gray-600">Real-time monitoring of Firestore operations</p>
                <div className="mt-2 bg-purple-50 border-2 border-purple-200 rounded-lg p-3">
                    <p className="text-sm text-purple-800 font-mono">
                        🐛 <strong>DEBUG MODE</strong> - This page tracks all live Firebase reads/writes across the app
                    </p>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-blue-200">
                    <div className="text-sm text-gray-600 mb-1">Total Reads</div>
                    <div className="text-4xl font-bold text-blue-600">{totalReads}</div>
                    <div className="text-xs text-gray-500 mt-2">Documents read from Firestore</div>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-green-200">
                    <div className="text-sm text-gray-600 mb-1">Total Writes</div>
                    <div className="text-4xl font-bold text-green-600">{totalWrites}</div>
                    <div className="text-xs text-gray-500 mt-2">Documents written to Firestore</div>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-orange-200">
                    <div className="text-sm text-gray-600 mb-1">Estimated Cost</div>
                    <div className="text-4xl font-bold text-orange-600">${estimatedCost.toFixed(4)}</div>
                    <div className="text-xs text-gray-500 mt-2">Based on Firebase pricing</div>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-purple-200">
                    <div className="text-sm text-gray-600 mb-1">Operations</div>
                    <div className="text-4xl font-bold text-purple-600">{operations.length}</div>
                    <div className="text-xs text-gray-500 mt-2">Total tracked operations</div>
                </div>
            </div>

            {/* Storage Usage */}
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">💾 LocalStorage Usage</h2>
                <div className="mb-2 flex justify-between text-sm">
                    <span className="text-gray-600">
                        {(storageUsage.used / 1024).toFixed(2)} KB / {(storageUsage.total / 1024).toFixed(2)} KB
                    </span>
                    <span className="font-mono text-gray-700">{storagePercent.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div
                        className={`h-full transition-all duration-500 ${storagePercent > 90 ? 'bg-red-500' :
                            storagePercent > 70 ? 'bg-orange-500' :
                                'bg-green-500'
                            }`}
                        style={{ width: `${Math.min(storagePercent, 100)}%` }}
                    />
                </div>
                {storagePercent > 90 && (
                    <p className="text-sm text-red-600 mt-2">⚠️ Storage nearly full! Consider clearing old data.</p>
                )}
            </div>

            {/* Operation Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-white rounded-xl shadow-lg p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">📖 Reads Breakdown</h2>
                    {Object.keys(readsByOperation).length === 0 ? (
                        <p className="text-gray-500 italic">No read operations yet</p>
                    ) : (
                        <div className="space-y-2">
                            {Object.entries(readsByOperation).map(([operation, count]) => (
                                <div key={operation} className="flex justify-between items-center">
                                    <span className="text-sm font-mono text-gray-700">{operation}</span>
                                    <span className="text-sm font-bold text-blue-600">{count}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">✍️ Writes Breakdown</h2>
                    {Object.keys(writesByOperation).length === 0 ? (
                        <p className="text-gray-500 italic">No write operations yet</p>
                    ) : (
                        <div className="space-y-2">
                            {Object.entries(writesByOperation).map(([operation, count]) => (
                                <div key={operation} className="flex justify-between items-center">
                                    <span className="text-sm font-mono text-gray-700">{operation}</span>
                                    <span className="text-sm font-bold text-green-600">{count}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Database Maintenance Controls */}
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl shadow-lg p-6 mb-6 border-2 border-yellow-300">
                <h2 className="text-xl font-bold text-gray-900 mb-4">🛠️ Database Maintenance</h2>
                <p className="text-sm text-gray-700 mb-4">
                    Developer-only tools for database optimization and cleanup. Use with caution.
                </p>

                <DatabaseMaintenancePanel />
            </div>

            {/* Recent Operations */}
            <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-900">📜 Recent Operations</h2>
                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                if (confirm('⚠️ This will clear ALL localStorage data and reload the page. Continue?')) {
                                    localStorage.clear();
                                    window.location.reload();
                                }
                            }}
                            className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition-colors"
                        >
                            Clear LocalStorage
                        </button>
                        <button
                            onClick={clearHistory}
                            className="px-4 py-2 bg-red-500 text-white text-sm font-semibold rounded-lg hover:bg-red-600 transition-colors"
                        >
                            Clear History
                        </button>
                    </div>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {recentOps.length === 0 ? (
                        <p className="text-gray-500 italic">No operations tracked yet. Navigate through the app to see operations appear here.</p>
                    ) : (
                        recentOps.map((op) => {
                            const time = new Date(op.timestamp).toLocaleTimeString();
                            return (
                                <div
                                    key={op.id}
                                    className={`p-3 rounded-lg border-2 ${op.type === 'read' ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'
                                        }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-lg ${op.type === 'read' ? 'text-blue-600' : 'text-green-600'}`}>
                                                    {op.type === 'read' ? '📖' : '✍️'}
                                                </span>
                                                <span className="font-mono text-sm font-bold text-gray-800">{op.operation}</span>
                                                {op.collection && (
                                                    <span className="text-xs bg-gray-200 px-2 py-1 rounded font-mono">{op.collection}</span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-700">{op.description}</p>
                                            {op.type === 'read' && op.docCount && op.docCount > 1 && (
                                                <p className="text-xs text-gray-600 mt-1">📄 {op.docCount} documents</p>
                                            )}
                                        </div>
                                        <span className="text-xs text-gray-500 font-mono ml-4">{time}</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Optimization Tips */}
            <div className="mt-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl shadow-lg p-6 border-2 border-indigo-200">
                <h2 className="text-xl font-bold text-gray-900 mb-4">💡 Optimization Tips</h2>
                <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start gap-2">
                        <span className="text-green-600 font-bold">✓</span>
                        <span><strong>Caching:</strong> This app uses caching to avoid redundant reads. Navigate between pages to see the cache in action!</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-green-600 font-bold">✓</span>
                        <span><strong>Batch Writes:</strong> Multiple changes are batched into single write operations where possible.</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-orange-600 font-bold">!</span>
                        <span><strong>Global Refresh:</strong> Manual refresh fetches all data. Use sparingly to minimize reads.</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-blue-600 font-bold">i</span>
                        <span><strong>Subcollections:</strong> Large collections (students, scores) are stored separately to reduce main document reads.</span>
                    </li>
                </ul>
            </div>
        </div>
    );
};

// Database Maintenance Panel Component
const DatabaseMaintenancePanel: React.FC = () => {
    const { schoolId } = useData();
    const [clearBuckets, setClearBuckets] = useState(false);
    const [repairImages, setRepairImages] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);

    const handleExecute = async () => {
        if (!schoolId) {
            alert('⚠️ No school loaded. Please log in first.');
            return;
        }

        if (!clearBuckets && !repairImages) {
            alert('⚠️ Please select at least one operation.');
            return;
        }

        const confirmMessage = [
            'Are you sure you want to run the following operations?',
            clearBuckets ? '• Clear all student buckets' : '',
            repairImages ? '• Repair and migrate all images to ImgBB' : '',
            '',
            'This may take several minutes for large databases.'
        ].filter(Boolean).join('\n');

        if (!confirm(confirmMessage)) return;

        setIsExecuting(true);
        setLogs([]);

        try {
            // Dynamic imports
            const { repairDatabaseImages } = await import('../../services/firebaseService');
            const { db } = await import('../../services/firebaseService');
            const { doc, writeBatch } = await import('firebase/firestore');

            // 1. Repair Images (MUST run first to ensure images are migrated before bucket rebuild)
            if (repairImages) {
                setLogs(prev => [...prev, '[Image Repair] 🔧 Starting comprehensive image repair...']);

                // Hijack console.log temporarily to capture logs
                const originalLog = console.log;
                console.log = (...args: any[]) => {
                    const message = args.join(' ');
                    if (message.includes('[Image Repair]')) {
                        setLogs(prev => [...prev, message]);
                    }
                    originalLog(...args);
                };

                await repairDatabaseImages(schoolId);

                // Restore console.log
                console.log = originalLog;

                setLogs(prev => [...prev, '[Image Repair] ✅ Image repair complete!']);
            }

            // 2. Clear Buckets (Runs AFTER image repair if both are selected)
            if (clearBuckets) {
                setLogs(prev => [...prev, '[Bucket Cleanup] 🧹 Starting bucket cleanup...']);

                const batch = writeBatch(db);
                let deletedCount = 0;

                // Delete manifest
                const manifestRef = doc(db, "schools", schoolId, "config", "student_bucket_manifest");
                batch.delete(manifestRef);
                deletedCount++;

                // Delete all possible chunk documents
                for (let i = 0; i < 1000; i++) {
                    const chunkRef = doc(db, "schools", schoolId, "config", `student_bucket_${i}`);
                    batch.delete(chunkRef);
                    deletedCount++;
                }

                // Delete legacy single bucket
                const legacyBucketRef = doc(db, "schools", schoolId, "config", "student_bucket");
                batch.delete(legacyBucketRef);
                deletedCount++;

                await batch.commit();
                setLogs(prev => [...prev, `[Bucket Cleanup] ✅ Deleted up to ${deletedCount} bucket documents.`]);

                // Rebuild buckets immediately after clearing
                setLogs(prev => [...prev, '[Bucket Cleanup] 🔄 Rebuilding student buckets...']);
                const { fetchSubcollection, updateStudentBucket } = await import('../../services/firebaseService');
                const students = await fetchSubcollection<any>(schoolId, 'students');
                if (students && students.length > 0) {
                    await updateStudentBucket(schoolId, students, 10000);
                    setLogs(prev => [...prev, `[Bucket Cleanup] ✅ Rebuilt ${students.length} students into buckets.`]);
                } else {
                    setLogs(prev => [...prev, '[Bucket Cleanup] ℹ️ No students found to rebuild.']);
                }
            }

            // 3. Final Image Verification (Check for any missed base64 images and upload to ImgBB)
            setLogs(prev => [...prev, '[Final Verification] 🔍 Scanning for any remaining base64 images...']);

            try {
                const { fetchSubcollection, updateStudent } = await import('../../services/firebaseService');
                const { uploadToImgBB } = await import('../../utils/imageUtils');

                // Fetch all students from subcollection
                const students = await fetchSubcollection<any>(schoolId, 'students');

                if (!students || students.length === 0) {
                    setLogs(prev => [...prev, '[Final Verification] ℹ️ No students found.']);
                } else {
                    let scannedCount = 0;
                    let uploadedCount = 0;
                    let failedCount = 0;

                    for (const student of students) {
                        scannedCount++;

                        // Check if picture exists and is base64 (not ImgBB URL)
                        // Expanded logic to catch raw base64 or long strings not starting with http
                        const isBase64 = student.picture && typeof student.picture === 'string' && (
                            student.picture.startsWith('data:image') ||
                            (student.picture.length > 500 && !student.picture.startsWith('http'))
                        );

                        if (isBase64 && !student.picture.includes('imgbb.com')) {

                            setLogs(prev => [...prev, `[Final Verification] 📤 Uploading image for: ${student.name || student.indexNumber}`]);

                            try {
                                const imgbbUrl = await uploadToImgBB(student.picture);

                                if (imgbbUrl) {
                                    // Update student with new URL
                                    const updatedStudent = { ...student, picture: imgbbUrl };
                                    await updateStudent(schoolId, updatedStudent);
                                    uploadedCount++;
                                    setLogs(prev => [...prev, `[Final Verification] ✅ Uploaded: ${student.name || student.indexNumber}`]);
                                } else {
                                    failedCount++;
                                    setLogs(prev => [...prev, `[Final Verification] ⚠️ Failed to upload: ${student.name || student.indexNumber}`]);
                                }
                            } catch (uploadError) {
                                failedCount++;
                                setLogs(prev => [...prev, `[Final Verification] ❌ Error uploading ${student.name || student.indexNumber}: ${uploadError}`]);
                            }
                        }
                    }

                    setLogs(prev => [...prev, `[Final Verification] 📊 Scanned: ${scannedCount} | Uploaded: ${uploadedCount} | Failed: ${failedCount}`]);

                    if (uploadedCount > 0) {
                        setLogs(prev => [...prev, '[Final Verification] 🔄 Rebuilding buckets with updated images...']);
                        const { updateStudentBucket } = await import('../../services/firebaseService');
                        const refreshedStudents = await fetchSubcollection<any>(schoolId, 'students');
                        if (refreshedStudents && refreshedStudents.length > 0) {
                            await updateStudentBucket(schoolId, refreshedStudents, 300);
                            setLogs(prev => [...prev, '[Final Verification] ✅ Buckets updated with new ImgBB URLs.']);
                        }
                    } else {
                        setLogs(prev => [...prev, '[Final Verification] ✅ All images are already on ImgBB.']);
                    }
                }
            } catch (verifyError) {
                setLogs(prev => [...prev, `[Final Verification] ⚠️ Verification error: ${verifyError}`]);
            }

            setLogs(prev => [...prev, '✅ All operations completed successfully!']);
            alert('✅ Database maintenance complete! Check the logs for details.');

        } catch (error) {
            console.error('[Maintenance] Error:', error);
            setLogs(prev => [...prev, `❌ Error: ${error}`]);
            alert(`❌ Maintenance failed: ${error}`);
        } finally {
            setIsExecuting(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 bg-white rounded-lg border-2 border-gray-200 hover:border-orange-300 transition-colors cursor-pointer">
                    <input
                        type="checkbox"
                        checked={clearBuckets}
                        onChange={(e) => setClearBuckets(e.target.checked)}
                        disabled={isExecuting}
                        className="w-5 h-5 text-orange-600"
                    />
                    <div>
                        <div className="font-semibold text-gray-900">Clear Student Buckets</div>
                        <div className="text-sm text-gray-600">Deletes all student bucket documents to rebuild from scratch</div>
                    </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-white rounded-lg border-2 border-gray-200 hover:border-blue-300 transition-colors cursor-pointer">
                    <input
                        type="checkbox"
                        checked={repairImages}
                        onChange={(e) => setRepairImages(e.target.checked)}
                        disabled={isExecuting}
                        className="w-5 h-5 text-blue-600"
                    />
                    <div>
                        <div className="font-semibold text-gray-900">Repair & Migrate Images</div>
                        <div className="text-sm text-gray-600">Uploads all base64 images to ImgBB and replaces with URLs</div>
                    </div>
                </label>
            </div>

            <button
                onClick={handleExecute}
                disabled={isExecuting || (!clearBuckets && !repairImages)}
                className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-lg hover:from-orange-600 hover:to-red-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg"
            >
                {isExecuting ? '⏳ Executing...' : '🚀 Execute Selected Operations'}
            </button>

            {logs.length > 0 && (
                <div className="bg-gray-900 text-green-400 font-mono text-xs p-4 rounded-lg max-h-64 overflow-y-auto">
                    {logs.map((log, i) => (
                        <div key={i} className="mb-1">{log}</div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default FirebaseAnalytics;
