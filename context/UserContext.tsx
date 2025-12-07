import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import type { User, DeviceCredential } from '../types';
import {
    generateDeviceId,
    hashPassword,
    verifyPassword,
    saveDeviceCredential as saveDeviceCredentialLocal,
    getDeviceCredential as getDeviceCredentialLocal,
    clearDeviceCredential as clearDeviceCredentialLocal
} from '../services/authService';
import { getUserById, updateUsers, updateDeviceCredentials } from '../services/firebaseService';

interface UserContextType {
    currentUser: User | null;
    deviceId: string;
    isAuthenticated: boolean;
    users: User[];
    setUsers: (users: User[]) => void;
    login: (userId: number, password: string) => Promise<boolean>;
    logout: () => void;
    setPassword: (userId: number, password: string) => Promise<void>;
    checkAutoLogin: (schoolId: string, users: User[]) => Promise<User | null>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [deviceId] = useState<string>(generateDeviceId());
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [users, setUsers] = useState<User[]>([]);

    /**
     * Check for auto-login using device credentials
     */
    const checkAutoLogin = async (schoolId: string, availableUsers: User[]): Promise<User | null> => {
        const credential = getDeviceCredentialLocal(schoolId);

        if (!credential) {
            return null;
        }

        // Find the user
        const user = availableUsers.find(u => u.id === credential.userId);

        if (user) {
            setCurrentUser(user);
            setIsAuthenticated(true);
            return user;
        }

        return null;
    };

    /**
     * Login with user ID and password
     */
    const login = async (userId: number, password: string): Promise<boolean> => {
        const user = users.find(u => u.id === userId);

        if (!user) {
            return false;
        }

        // Check if password is set (first time user)
        if (!user.passwordHash) {
            return false;
        }

        // Verify password
        const isValid = await verifyPassword(password, user.passwordHash);

        if (isValid) {
            setCurrentUser(user);
            setIsAuthenticated(true);
            return true;
        }

        return false;
    };

    /**
     * Set password for a user (first time or reset)
     */
    const setPassword = async (userId: number, password: string): Promise<void> => {
        const passwordHash = await hashPassword(password);

        // Update user in the list
        const updatedUsers = users.map(u =>
            u.id === userId ? { ...u, passwordHash } : u
        );

        setUsers(updatedUsers);

        // Set as current user
        const user = updatedUsers.find(u => u.id === userId);
        if (user) {
            setCurrentUser(user);
            setIsAuthenticated(true);
        }
    };

    /**
     * Logout current user
     */
    const logout = () => {
        setCurrentUser(null);
        setIsAuthenticated(false);
    };

    const value: UserContextType = {
        currentUser,
        deviceId,
        isAuthenticated,
        users,
        setUsers,
        login,
        logout,
        setPassword,
        checkAutoLogin,
    };

    return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};
