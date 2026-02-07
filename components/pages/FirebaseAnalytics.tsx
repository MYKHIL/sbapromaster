import React, { useEffect, useState } from 'react';
import { useFirebaseAnalytics } from '../../context/FirebaseAnalyticsContext';

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

export default FirebaseAnalytics;
