import React from 'react';
import { useData } from '../context/DataContext';
import { SyncOverlay as SyncOverlayComponent } from './SyncOverlay';
import { SHOW_SYNC_OVERLAY } from '../constants';

/**
 * Wrapper component that connects SyncOverlay to DataContext
 */
export const SyncOverlayConnected: React.FC = () => {
    const { isSyncing } = useData();
    return <SyncOverlayComponent isVisible={isSyncing && SHOW_SYNC_OVERLAY} />;
};
