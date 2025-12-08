import React from 'react';
import { useData } from '../context/DataContext';
import { SyncOverlay as SyncOverlayComponent } from './SyncOverlay';

/**
 * Wrapper component that connects SyncOverlay to DataContext
 */
export const SyncOverlayConnected: React.FC = () => {
    const { isSyncing } = useData();
    return <SyncOverlayComponent isVisible={isSyncing} />;
};
