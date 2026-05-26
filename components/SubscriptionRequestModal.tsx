import React, { useState, useEffect, useRef } from 'react';
import { SUBSCRIPTION_TIERS, ADMIN_EMAIL, PAYSTACK_PUBLIC_KEY } from '../constants';
import { AppDataType, getSchoolList, SchoolListItem, activateSchoolSubscriptionLocally } from '../services/firebaseService';
import { initializePayment, loadPaystackScript, activateSubscription, verifyPayment } from '../services/paystackService';
import MessageBox from './MessageBox';

interface SubscriptionRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (data: AppDataType, docId: string, password: string, subscription: any) => void;
    initialSchoolName?: string;
    pendingRegistration?: { docId: string; password: string; registrationData: AppDataType; targetIndex: number } | null;
}

const SubscriptionRequestModal: React.FC<SubscriptionRequestModalProps> = ({ isOpen, onClose, onSuccess, initialSchoolName, pendingRegistration }) => {
    const [selectedTier, setSelectedTier] = useState(SUBSCRIPTION_TIERS[2].name);
    const [selectedSchool, setSelectedSchool] = useState<SchoolListItem | null>(null);
    const [searchTerm, setSearchTerm] = useState(initialSchoolName || '');
    const [allSchools, setAllSchools] = useState<SchoolListItem[]>([]);
    const [filteredSchools, setFilteredSchools] = useState<SchoolListItem[]>([]);
    const [isLoadingSchools, setIsLoadingSchools] = useState(false);
    const [showSchoolDropdown, setShowSchoolDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Payment State
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [paymentEmail, setPaymentEmail] = useState('');

    // Duration State
    const [durationValue, setDurationValue] = useState(1);
    const [durationUnit, setDurationUnit] = useState<'Term' | 'Year'>('Year');

    // MessageBox State
    const [messageBox, setMessageBox] = useState<{
        isOpen: boolean;
        title: string;
        message: string | React.ReactNode;
        confirmText?: string;
        cancelText?: string;
        onConfirm: () => void;
        onCancel?: () => void;
        variant?: 'info' | 'success' | 'warning' | 'danger';
        hideCancel?: boolean;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { }
    });

    const showMsg = (config: Omit<typeof messageBox, 'isOpen' | 'onConfirm' | 'onCancel'>) => {
        return new Promise<boolean>((resolve) => {
            setMessageBox({
                ...config,
                isOpen: true,
                onConfirm: () => {
                    setMessageBox(prev => ({ ...prev, isOpen: false }));
                    resolve(true);
                },
                onCancel: () => {
                    setMessageBox(prev => ({ ...prev, isOpen: false }));
                    resolve(false);
                }
            });
        });
    };

    const loadSchools = async () => {
        setIsLoadingSchools(true);
        try {
            const list = await getSchoolList(undefined, true); // Include locked schools for activation

            // Ensure uniqueness by displayName as requested
            const uniqueSchools: SchoolListItem[] = [];
            const seenNames = new Set<string>();

            list.forEach(school => {
                if (!seenNames.has(school.displayName)) {
                    seenNames.add(school.displayName);
                    uniqueSchools.push(school);
                }
            });

            setAllSchools(uniqueSchools);

            if (initialSchoolName) {
                const lowerInitial = initialSchoolName.toLowerCase();
                const found = uniqueSchools.find(s =>
                    s.displayName.toLowerCase() === lowerInitial ||
                    s.docId.split('_')[0].toLowerCase() === lowerInitial
                );
                if (found) {
                    setSelectedSchool(found);
                    setSearchTerm(found.displayName);
                }
            }
        } catch (error) {
            console.error('[Subscription] Failed to load schools:', error);
        } finally {
            setIsLoadingSchools(false);
        }
    };

    useEffect(() => {
        if (!isOpen) return;

        if (pendingRegistration) {
            // Pre-select the pending registration school
            const virtualSchool: SchoolListItem = {
                docId: pendingRegistration.docId,
                displayName: pendingRegistration.registrationData.settings?.schoolName || pendingRegistration.docId,
                _databaseIndex: pendingRegistration.targetIndex,
                access: false
            };
            setSelectedSchool(virtualSchool);
            setSearchTerm(virtualSchool.displayName);
        } else {
            loadSchools();
        }

        loadPaystackScript(); // Preload script
    }, [isOpen, initialSchoolName, pendingRegistration]);

    // 2. Filter Schools for Combobox
    useEffect(() => {
        if (!searchTerm) {
            setFilteredSchools(allSchools);
            return;
        }

        const lowerTerm = searchTerm.toLowerCase();

        // 1. Filter dropdown options
        const filtered = allSchools.filter(s =>
            s.displayName.toLowerCase().includes(lowerTerm) ||
            s.docId.toLowerCase().includes(lowerTerm)
        );
        setFilteredSchools(filtered);

        // 2. Auto-select if exact match found (UX improvement)
        const exactMatch = allSchools.find(
            s => s.displayName.toLowerCase() === lowerTerm
        );

        if (exactMatch) {
            // Found exact match, select it if not already selected
            if (!selectedSchool || selectedSchool.docId !== exactMatch.docId) {
                setSelectedSchool(exactMatch);
            }
        }
        // Note: We don't deselect here because onChange handles deselection on mismatch

    }, [searchTerm, allSchools, selectedSchool]);

    // Handle clicks outside dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowSchoolDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const hasMissingPrices = SUBSCRIPTION_TIERS.some(tier => tier.price === undefined || tier.price === null || String(tier.price).trim() === '');

    if (!isOpen) return null;

    if (hasMissingPrices) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[60] p-4">
                <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center">
                    <div className="text-red-500 mb-4">
                        <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Configuration Error</h3>
                    <p className="text-gray-600 mb-6">Subscription tier pricing could not be fetched from the server. Please contact support.</p>
                    <button
                        onClick={onClose}
                        className="w-full bg-indigo-600 text-white font-semibold py-3 px-6 rounded-xl hover:bg-indigo-700 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    // --- Derived pricing values ---
    const currentTier = SUBSCRIPTION_TIERS.find(t => t.name === selectedTier) || SUBSCRIPTION_TIERS[1];
    const basePrice = parseFloat(currentTier.price.replace(/[^0-9.]/g, ''));
    const totalMonths = durationUnit === 'Year' ? durationValue * 12 : durationValue * 4;
    // All paid tiers use per-year pricing (12 months base)
    const calculatedAmount = isNaN(basePrice) ? 0 : (basePrice / 12) * totalMonths;
    const customDurationStr = `${durationValue} ${durationUnit}${durationValue > 1 ? 's' : ''}`;

    const handlePayment = async () => {
        if (!selectedSchool || !paymentEmail) {
            await showMsg({
                title: 'Error',
                message: 'Please fill in all fields',
                confirmText: 'OK',
                variant: 'danger',
                hideCancel: true
            });
            return;
        }

        if (isNaN(basePrice) || basePrice <= 0) {
            // Free tier or Request Quote
            if (currentTier.price.toLowerCase().includes('free')) {
                // Handle free tier activation directly
                activateFreeTier();
                return;
            }
            if (currentTier.price.toLowerCase().includes('quote')) {
                window.location.href = `mailto:${ADMIN_EMAIL}?subject=Enterprise Quote Request&body=Requesting quote for ${selectedSchool.displayName}`;
                return;
            }
        }

        const amountInPesewas = Math.round(calculatedAmount * 100);
        const MIN_PAYSTACK_AMOUNT = 100; // 1.00 GHS in pesewas
        if (amountInPesewas > 0 && amountInPesewas < MIN_PAYSTACK_AMOUNT) {
            await showMsg({
                title: 'Error',
                message: `Paystack transactions must be at least GH₵ ${(MIN_PAYSTACK_AMOUNT / 100).toFixed(2)}. Current amount is GH₵ ${calculatedAmount.toFixed(2)}.`,
                confirmText: 'OK',
                variant: 'danger',
                hideCancel: true
            });
            return;
        }

        setIsProcessingPayment(true);

        // Define checkPaymentAndDbStatus helper to poll verification endpoint
        const checkPaymentAndDbStatus = async (ref: string) => {
            const maxAttempts = 40; // up to 40 seconds
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                try {
                    const verifyRes = await verifyPayment(ref);
                    if (verifyRes.status === 'success' && verifyRes.dbActivated) {
                        return true;
                    }
                } catch (pollErr) {
                    console.warn('[Polling] Verification check failed:', pollErr);
                }
                await new Promise(r => setTimeout(r, 1000));
            }
            throw new Error('Payment was received, but database activation is taking longer than expected. Please check your dashboard in a moment.');
        };

        try {
            // 1. Initialize Transaction with raw parameters
            0 && console.log('[Paystack] Initializing with raw configurations:', { email: paymentEmail, tierName: currentTier.name });
            const initResponse = await initializePayment(
                paymentEmail,
                currentTier.name,
                durationValue,
                durationUnit,
                selectedSchool.docId,
                selectedSchool.displayName,
                selectedSchool._databaseIndex || 1,
                pendingRegistration ? {
                    password: pendingRegistration.password,
                    registrationData: pendingRegistration.registrationData
                } : undefined
            );

            // Use the key from the environment (Vite prefetched) or the one loaded dynamically from API
            const publicKey = (import.meta as any).env?.VITE_PAYSTACK_PUBLIC_KEY || PAYSTACK_PUBLIC_KEY;

            const isLocalHost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
            if (isLocalHost) {
                console.log(`[Paystack DEBUG] Initialization success: { reference: ${initResponse.reference}, Full Public Key: "${publicKey}" }`);
                
                const simulateSuccess = await showMsg({
                    title: "Local Development Mode",
                    message: "Would you like to simulate a successful payment and activate the subscription locally?",
                    confirmText: "Simulate Success",
                    cancelText: "Use Real Paystack",
                    variant: "info"
                });

                if (simulateSuccess) {
                    try {
                        const mockRef = initResponse.reference || 'MOCK_' + Date.now();
                        await activateSchoolSubscriptionLocally(
                            mockRef,
                            {
                                id: selectedSchool.docId,
                                name: selectedSchool.displayName,
                                dbIndex: selectedSchool._databaseIndex || 1
                            },
                            {
                                name: currentTier.name,
                                maxStudents: currentTier.maxStudents,
                                maxClass: currentTier.maxClass,
                                duration: customDurationStr
                            },
                            true, // addRemainingTime
                            pendingRegistration ? {
                                password: pendingRegistration.password,
                                initialData: pendingRegistration.registrationData
                            } : undefined
                        );

                        await showMsg({
                            title: "Mock Activation Successful",
                            message: `Success! [Mock] ${currentTier.name} activated for ${selectedSchool.displayName} for ${customDurationStr}.`,
                            confirmText: "Excellent",
                            hideCancel: true,
                            variant: "success"
                        });

                        // Re-fetch schools
                        await loadSchools();

                        // If we registered a new school, we might need a reload for DB switch
                        const { ACTIVE_DATABASE_INDEX } = await import('../constants');
                        if (pendingRegistration && pendingRegistration.targetIndex !== ACTIVE_DATABASE_INDEX) {
                            localStorage.setItem('active_database_index', pendingRegistration.targetIndex.toString());
                            localStorage.setItem('sba_school_id', pendingRegistration.docId);
                            localStorage.setItem('sba_school_password', pendingRegistration.password);
                            window.location.reload();
                            return;
                        }

                        if (onSuccess) {
                            onSuccess(
                                pendingRegistration ? pendingRegistration.registrationData : (null as any),
                                selectedSchool.docId,
                                pendingRegistration ? pendingRegistration.password : '',
                                { success: true }
                            );
                        } else {
                            onClose();
                        }
                    } catch (err: any) {
                        console.error("Local mock activation failed:", err);
                        await showMsg({
                            title: 'Error',
                            message: err.message || 'Local mock activation failed.',
                            confirmText: 'OK',
                            variant: 'danger',
                            hideCancel: true
                        });
                    } finally {
                        setIsProcessingPayment(false);
                    }
                    return;
                }
            }

            // 2. Open Paystack Popup
            const PaystackPop = (window as any).PaystackPop;

            if (!PaystackPop) {
                await showMsg({
                    title: 'Error',
                    message: 'Paystack SDK not loaded. Please refresh.',
                    confirmText: 'OK',
                    variant: 'danger',
                    hideCancel: true
                });
                setIsProcessingPayment(false);
                return;
            }

            // Use .setup() legacy method which is standard for v1/inline.js
            const handler = PaystackPop.setup({
                key: publicKey, // Paystack Public Key
                email: paymentEmail,
                amount: Math.round(calculatedAmount * 100), // in kobo/pesewas
                ref: initResponse.reference,
                currency: 'GHS',
                metadata: {
                    custom_fields: [
                        {
                            display_name: "School",
                            variable_name: "school",
                            value: selectedSchool.displayName
                        },
                        {
                            display_name: "Duration",
                            variable_name: "duration",
                            value: customDurationStr
                        }
                    ]
                },
                callback: (response: any) => {
                    const handleSuccess = async () => {
                        try {
                            console.log('[Paystack] Activating school subscription in database...');
                            await activateSchoolSubscriptionLocally(
                                response.reference,
                                {
                                    id: selectedSchool.docId,
                                    name: selectedSchool.displayName,
                                    dbIndex: selectedSchool._databaseIndex || 1
                                },
                                {
                                    name: currentTier.name,
                                    maxStudents: currentTier.maxStudents,
                                    maxClass: currentTier.maxClass,
                                    duration: customDurationStr
                                },
                                true, // addRemainingTime
                                pendingRegistration ? {
                                    password: pendingRegistration.password,
                                    initialData: pendingRegistration.registrationData
                                } : undefined
                            );
                            console.log('[Paystack] Database activation completed successfully.');

                            // For production, also verify via the backend (will return instantly because we just activated it)
                            if (!isLocalHost) {
                                try {
                                    await checkPaymentAndDbStatus(response.reference);
                                } catch (pollErr) {
                                    console.warn('[Paystack Callback] Webhook verification timed out, but database was successfully activated client-side:', pollErr);
                                }
                            }

                            await showMsg({
                                title: "Activation Successful",
                                message: `Success! ${currentTier.name} activated for ${selectedSchool.displayName} for ${customDurationStr}.`,
                                confirmText: "Excellent",
                                hideCancel: true,
                                variant: "success"
                            });

                            // If we registered a new school, we might need a reload for DB switch
                            const { ACTIVE_DATABASE_INDEX } = await import('../constants');
                            if (pendingRegistration && pendingRegistration.targetIndex !== ACTIVE_DATABASE_INDEX) {
                                localStorage.setItem('active_database_index', pendingRegistration.targetIndex.toString());
                                localStorage.setItem('sba_school_id', pendingRegistration.docId);
                                localStorage.setItem('sba_school_password', pendingRegistration.password);
                                window.location.reload();
                                return;
                            }

                            if (onSuccess) {
                                onSuccess(
                                    pendingRegistration ? pendingRegistration.registrationData : (null as any),
                                    selectedSchool.docId,
                                    pendingRegistration ? pendingRegistration.password : '',
                                    { success: true }
                                );
                            } else {
                                onClose();
                            }
                        } catch (err: any) {
                            console.error(err);
                            const userFriendlyMsg = err.message || "Payment successful but activation timed out. Please contact support.";

                            await showMsg({
                                title: "Activation Pending",
                                message: userFriendlyMsg,
                                confirmText: "Understood",
                                hideCancel: true,
                                variant: "warning"
                            });
                            await showMsg({
                                title: 'Warning',
                                message: userFriendlyMsg,
                                confirmText: 'OK',
                                variant: 'warning',
                                hideCancel: true
                            });
                        }
                    };
                    handleSuccess();
                },
                onClose: () => {
                    setIsProcessingPayment(false);
                }
            });

            handler.openIframe();

        } catch (error: any) {
            console.error(error);
            const errMsg = error.response?.data?.details || error.response?.data?.message || error.message || "Payment initialization failed.";
            await showMsg({
                title: 'Error',
                message: errMsg,
                confirmText: 'OK',
                variant: 'danger',
                hideCancel: true
            });
            setIsProcessingPayment(false);
        }
    };

    const activateFreeTier = async () => {
        if (!selectedSchool) {
            await showMsg({
                title: 'Error',
                message: 'Please select a school first.',
                confirmText: 'OK',
                variant: 'danger',
                hideCancel: true
            });
            return;
        }

        const confirmTrial = await showMsg({
            title: "Activate Trial?",
            message: `Activate 1-week FREE Trial for ${selectedSchool.displayName}?\n\nNote: Trials are one-time only and cannot be reactivated once used or expired.`,
            confirmText: "Activate Now",
            variant: "warning"
        });

        if (!confirmTrial) return;

        setIsProcessingPayment(true);

        try {
            const trialTier = {
                name: "Trial",
                maxStudents: "10",
                maxClass: "1",
                duration: "1 Week"
            };

            // 1. ACTIVATE SUBSCRIPTION (Atomic creation if pendingRegistration exists)
            await activateSubscription(
                `FREE_${Date.now()}`,
                {
                    id: selectedSchool.docId,
                    name: selectedSchool.displayName,
                    dbIndex: selectedSchool._databaseIndex || 1
                },
                trialTier,
                false,
                pendingRegistration ? {
                    password: pendingRegistration.password,
                    initialData: pendingRegistration.registrationData
                } : undefined
            );

            // Re-fetch schools to show updated access
            await loadSchools();
            await showMsg({
                title: "Trial Activated",
                message: "Your 7-day free trial is now active! You have full access to all features.",
                confirmText: "Get Started",
                hideCancel: true,
                variant: "success"
            });

            // If we registered a new school, we might need a reload for DB switch
            const { ACTIVE_DATABASE_INDEX } = await import('../constants');
            if (pendingRegistration && pendingRegistration.targetIndex !== ACTIVE_DATABASE_INDEX) {
                localStorage.setItem('active_database_index', pendingRegistration.targetIndex.toString());
                localStorage.setItem('sba_school_id', pendingRegistration.docId);
                localStorage.setItem('sba_school_password', pendingRegistration.password);
                window.location.reload();
                return;
            }

            if (onSuccess) {
                onSuccess(
                    pendingRegistration ? pendingRegistration.registrationData : (null as any),
                    selectedSchool.docId,
                    pendingRegistration ? pendingRegistration.password : '',
                    null
                );
            } else {
                onClose();
            }
        } catch (error: any) {
            console.error("Trial activation failed:", error);
            const userFriendlyMsg = error.message?.includes('permission') || error.message?.includes('auth')
                ? "Trial activation failed due to a connection issue. Please try again later."
                : (error.message || "Failed to activate trial. Please contact support.");

            await showMsg({
                title: "Activation Failed",
                message: userFriendlyMsg,
                confirmText: "Understood",
                hideCancel: true,
                variant: "danger"
            });
        } finally {
            setIsProcessingPayment(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[60] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-indigo-600 p-6 text-white relative flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-white hover:text-indigo-200 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <h2 className="text-2xl font-bold">Secure Payment &amp; Activation</h2>
                    <p className="text-indigo-100 mt-1">Select your plan and activate instantly</p>
                </div>

                <div className="p-6 space-y-5 overflow-y-auto">
                    {/* 1. School Selection (Combobox) */}
                    <div className="space-y-2 relative" ref={dropdownRef}>
                        <label className="block text-sm font-semibold text-gray-700">Select Your School</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setShowSchoolDropdown(true);
                                    if (selectedSchool && e.target.value !== selectedSchool.displayName) {
                                        setSelectedSchool(null);
                                    }
                                }}
                                onFocus={() => setShowSchoolDropdown(true)}
                                placeholder="Search school to activate..."
                                readOnly={!!pendingRegistration}
                                className={`w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none ${pendingRegistration ? 'bg-indigo-50 border-indigo-200 cursor-default' : 'bg-gray-50'}`}
                            />
                            <div className="absolute right-3 top-3 flex items-center gap-2">
                                {isLoadingSchools && (
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                                )}
                                {!pendingRegistration && (
                                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-gray-400 transition-transform ${showSchoolDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                )}
                                {pendingRegistration && (
                                    <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded-full">NEW</span>
                                )}
                            </div>

                            {showSchoolDropdown && (
                                <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
                                    {filteredSchools.length > 0 ? (
                                        filteredSchools.map((school) => (
                                            <button
                                                key={school.docId}
                                                onClick={() => {
                                                    setSelectedSchool(school);
                                                    setSearchTerm(school.displayName);
                                                    setShowSchoolDropdown(false);
                                                }}
                                                className="w-full text-left px-4 py-3 hover:bg-indigo-50 border-b border-gray-100 last:border-0 transition-colors"
                                            >
                                                <p className="font-medium text-gray-800">{school.displayName}</p>
                                                <p className="text-xs text-gray-500">{school.docId}</p>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-4 py-3 text-gray-500 text-sm italic">
                                            No schools found.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        {selectedSchool && (
                            <div className="flex items-center gap-2 text-green-600 text-sm mt-1 animate-fadeIn">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.707-9.293a1 1 0 0 0-1.414-1.414L9 10.586 7.707 9.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span>Ready for activation</span>
                            </div>
                        )}
                    </div>

                    {/* 2. Billing Email + Duration — same row */}
                    <div className="flex gap-3 items-end">
                        {/* Email */}
                        <div className="flex-1 space-y-1.5">
                            <label className="block text-sm font-bold text-gray-800 flex items-center gap-1.5">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                Billing Email <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="email"
                                required
                                placeholder="Email for receipt..."
                                className="w-full px-4 py-3 bg-indigo-50/30 border-2 border-indigo-100/50 rounded-xl focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all text-[15px] font-medium text-indigo-900 placeholder:text-gray-400"
                                value={paymentEmail}
                                onChange={(e) => setPaymentEmail(e.target.value)}
                            />
                        </div>

                        {/* Duration — hidden for free/quote tiers */}
                        {!isNaN(basePrice) && basePrice > 0 && (
                            <div className="space-y-1.5">
                                <label className="block text-sm font-bold text-gray-800 text-center sm:text-left">Duration</label>
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="number"
                                        min="1"
                                        max={durationUnit === 'Term' ? 12 : 10}
                                        value={durationValue}
                                        onChange={(e) => setDurationValue(Math.max(1, parseInt(e.target.value) || 1))}
                                        className="w-14 px-2 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all text-center font-bold text-indigo-900 text-[15px]"
                                    />
                                    <div className="flex bg-gray-100 p-1 rounded-xl">
                                        <button
                                            onClick={() => setDurationUnit('Term')}
                                            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${durationUnit === 'Term' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            Term
                                        </button>
                                        <button
                                            onClick={() => setDurationUnit('Year')}
                                            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${durationUnit === 'Year' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            Year
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 3. Tier Selection */}
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700">Select Subscription Tier</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                            {SUBSCRIPTION_TIERS.map((tier) => (
                                <button
                                    key={tier.name}
                                    onClick={() => setSelectedTier(tier.name)}
                                    className={`p-3 rounded-xl border-2 text-left transition-all ${selectedTier === tier.name
                                        ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-200'
                                        : 'border-gray-100 bg-gray-50 hover:border-indigo-200'
                                        }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <p className="font-bold text-gray-900 text-sm">{tier.name}</p>
                                        <p className="text-indigo-600 font-bold text-xs text-right">
                                            {(() => {
                                                const priceValue = parseFloat(tier.price.replace(/[^0-9.]/g, ''));
                                                if (isNaN(priceValue) || priceValue === 0) return tier.price;

                                                if (durationUnit === 'Term') {
                                                    const termPrice = priceValue / 3;
                                                    return (
                                                        <>
                                                            GHS {termPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                                            <span className="text-gray-400 font-normal ml-0.5">/term</span>
                                                        </>
                                                    );
                                                }

                                                return (
                                                    <>
                                                        {tier.price}
                                                        <span className="text-gray-400 font-normal ml-0.5">/yr</span>
                                                    </>
                                                );
                                            })()}
                                            {(isNaN(parseFloat(tier.price.replace(/[^0-9.]/g, ''))) || parseFloat(tier.price.replace(/[^0-9.]/g, '')) === 0) && (
                                                <span className="text-gray-400 font-normal text-[10px]"> &bull; {tier.duration}</span>
                                            )}
                                        </p>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        {tier.maxStudents} students &bull; {tier.maxClass} classes
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 4. Total Cost Summary */}
                    {!isNaN(basePrice) && basePrice > 0 && (
                        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl border border-indigo-100">
                            <div>
                                <p className="text-xs text-indigo-500 font-medium">Total to pay</p>
                                <p className="text-xs text-indigo-400">{customDurationStr} &bull; {currentTier.name}</p>
                                <p className="text-[10px] text-indigo-300 mt-0.5">Cumulative if unexpired time remains</p>
                            </div>
                            <p className="text-2xl font-black text-indigo-900">
                                GHS {calculatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>
                    )}

                </div>


                {/* Footer Actions */}
                <div className="p-6 bg-gray-50 flex flex-col gap-3 flex-shrink-0 border-t border-gray-100">
                    {(!selectedSchool && searchTerm) && (
                        <p className="text-sm text-red-500 text-center">
                            Please select a school from the dropdown list above.
                        </p>
                    )}
                    <div className="flex gap-3 w-full">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 px-4 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-100 transition-colors"
                            disabled={isProcessingPayment}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handlePayment}
                            disabled={!selectedSchool || !paymentEmail || isProcessingPayment}
                            className={`flex-1 py-3 px-4 font-semibold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 ${!selectedSchool || !paymentEmail || isProcessingPayment
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                                : 'bg-green-600 text-white hover:bg-green-700 transform hover:scale-[1.02]'
                                }`}
                        >
                            {isProcessingPayment ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    <span>Processing...</span>
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                    <span>Pay {!isNaN(basePrice) && basePrice > 0 ? `GHS ${calculatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '& Activate'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
            {/* MessageBox */}
            <MessageBox {...messageBox} />
        </div>
    );
};

export default SubscriptionRequestModal;
