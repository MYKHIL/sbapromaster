import React from 'react';

interface NetworkIndicatorProps {
    isOnline: boolean;
    isSyncing: boolean;
    queuedCount: number;
}

export const NetworkIndicator: React.FC<NetworkIndicatorProps> = ({ isOnline, isSyncing, queuedCount }) => {
    const getStatus = () => {
        if (isSyncing) return { icon: '⟳', color: '#6b7280', label: 'Syncing...' };
        if (!isOnline) return { icon: '●', color: '#f59e0b', label: `Offline - ${queuedCount} queued` };
        return { icon: '●', color: '#10b981', label: 'Online & Synced' };
    };

    const status = getStatus();

    return (
        <div
            title={status.label}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                marginLeft: '8px',
                fontSize: '12px',
                cursor: 'help',
            }}
        >
            <span
                style={{
                    color: status.color,
                    fontSize: '10px',
                    animation: isSyncing ? 'spin 1s linear infinite' : 'none',
                }}
            >
                {status.icon}
            </span>
            {queuedCount > 0 && !isOnline && (
                <span style={{ fontSize: '10px', color: '#f59e0b', fontWeight: 500 }}>
                    {queuedCount}
                </span>
            )}
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};
