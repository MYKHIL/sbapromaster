import React from 'react';

interface NetworkIndicatorProps {
    isOnline: boolean;
    isSyncing: boolean;
    queuedCount: number;
}

export const NetworkIndicator: React.FC<NetworkIndicatorProps> = ({ isOnline, isSyncing, queuedCount }) => {
    const getStatus = () => {
        if (isSyncing) return { icon: '⟳', color: '#6b7280', label: 'Syncing...', text: 'Syncing' };
        if (!isOnline) return { icon: '●', color: '#f59e0b', label: `Offline - ${queuedCount} queued`, text: 'Offline' };
        return { icon: '●', color: '#10b981', label: 'Online & Synced', text: 'Synced' };
    };

    const status = getStatus();

    return (
        <div
            title={status.label}
            style={{
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                marginLeft: '8px',
                cursor: 'help',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span
                    style={{
                        color: status.color,
                        fontSize: '20px',
                        animation: isSyncing ? 'spin 1s linear infinite' : 'none',
                        lineHeight: 1,
                    }}
                >
                    {status.icon}
                </span>
                {queuedCount > 0 && !isOnline && (
                    <span style={{ fontSize: '13px', color: '#f59e0b', fontWeight: 500 }}>
                        {queuedCount}
                    </span>
                )}
            </div>
            <span style={{ fontSize: '9px', color: status.color, fontWeight: 500, opacity: 0.8 }}>
                {status.text}
            </span>
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};
