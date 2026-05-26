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
    dbActivated?: boolean; // Indicates if the backend webhook has completed the database updates
}

/**
 * Initializes a Paystack transaction securely by passing raw configurations to the server
 */
export const initializePayment = async (
    email: string,
    tierName: string,
    durationValue: number,
    durationUnit: string,
    schoolId: string,
    schoolName: string,
    dbIndex: number,
    pendingRegistration?: any
): Promise<InitializePaymentResponse> => {
    try {
        const response = await axios.post(`${API_BASE_URL}/initialize-payment`, {
            email,
            tierName,
            durationValue,
            durationUnit,
            schoolId,
            schoolName,
            dbIndex,
            pendingRegistration
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

/**
 * Activates a trial subscription via Firestore client SDK (same path as paid renewals).
 * Avoids firebase-admin, which requires a service account for Firestore — not user refresh tokens.
 */
export const activateSubscription = async (
    reference: string,
    schoolDetails: { id: string, name: string, dbIndex: number },
    tier: any,
    addRemainingTime: boolean = false,
    registrationData?: { password: string; initialData: any }
): Promise<any> => {
    try {
        const { activateSchoolSubscriptionLocally } = await import('./firebaseService');
        const result = await activateSchoolSubscriptionLocally(
            reference,
            schoolDetails,
            tier,
            addRemainingTime,
            registrationData
        );
        return {
            success: true,
            message: 'Trial activated successfully',
            expiryDate: result.expiryDate?.toISOString?.() ?? result.expiryDate,
        };
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
