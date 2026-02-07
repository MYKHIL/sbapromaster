import React from 'react';
import { User } from '../types';

interface FreshLoginModalProps {
    currentUser: User | null;
}

const FreshLoginModal: React.FC<FreshLoginModalProps> = ({ currentUser }) => {
    // DISABLED: Auto-load on login handles all data fetching
    // Modal is no longer needed - data loads automatically after login
    return null;
};

export default FreshLoginModal;
