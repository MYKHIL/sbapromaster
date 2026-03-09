import axios from 'axios';
import { API_BASE_URL } from '../constants'; // Import API_BASE_URL

// Interfaces for Paystack response types
interface InitializePaymentResponse {
    authorizationUrl: string;
    accessCode: string;
    reference: string;
}

interface VerifyPaymentResponse {
    status: string;
    amount: number;
    currency: string;
    reference: string;
    customer: {
        email: string;
    };
}

interface MetaData {
    [key: string]: any;
}

/**
 * Initializes a Paystack transaction
 * @param email User's email address
 * @param amount Amount in GHS
 * @param metadata Additional data to store with transaction
 */
export const initializePayment = async (
    email: string,
    amount: number,
    metadata: MetaData = {}
): Promise<InitializePaymentResponse> => {
    try {
        const response = await axios.post(`${API_BASE_URL}/initialize-payment`, {
            email,
            amount,
            metadata
        });

        return response.data;
    } catch (error) {
        console.error('Paystack initialization failed:', error);
        throw error;
    }
};

/**
 * Verifies a Paystack transaction
 * @param reference Transaction reference
 */
export const verifyPayment = async (reference: string): Promise<VerifyPaymentResponse> => {
    try {
        const response = await axios.get(`${API_BASE_URL}/verify-payment?reference=${reference}`);
        return response.data;
    } catch (error) {
        console.error('Paystack verification failed:', error);
        throw error;
    }
};

import { activateSchoolSubscriptionLocally } from './firebaseService';

/**
 * Activates subscription after successful payment
 * @param reference Payment reference
 * @param schoolDetails School information
 * @param tier Subscription tier details
 */
export const activateSubscription = async (
    reference: string,
    schoolDetails: { id: string, name: string, dbIndex: number },
    tier: any,
    addRemainingTime: boolean = false,
    registrationData?: { password: string; initialData: any }
): Promise<any> => {
    try {
        return await activateSchoolSubscriptionLocally(reference, schoolDetails, tier, addRemainingTime, registrationData);
    } catch (error) {
        console.error('Subscription activation failed:', error);
        throw error;
    }
};

/**
 * Load Paystack Inline Script dynamically
 */
export const loadPaystackScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
        if ((window as any).PaystackPop) {
            resolve(true);
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://js.paystack.co/v1/inline.js';
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
};
