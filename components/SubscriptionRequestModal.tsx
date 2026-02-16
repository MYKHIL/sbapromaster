import React, { useState, useEffect, useRef } from 'react';
import { SUBSCRIPTION_TIERS, ADMIN_EMAIL } from '../constants';
import { getSchoolList, SchoolListItem } from '../services/firebaseService';
import { initializePayment, loadPaystackScript, activateSubscription } from '../services/paystackService';

interface SubscriptionRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialSchoolName?: string;
}

const SubscriptionRequestModal: React.FC<SubscriptionRequestModalProps> = ({ isOpen, onClose, initialSchoolName }) => {
    const [selectedTier, setSelectedTier] = useState(SUBSCRIPTION_TIERS[1].name);
    const [selectedSchool, setSelectedSchool] = useState<SchoolListItem | null>(null);
    const [searchTerm, setSearchTerm] = useState(initialSchoolName || '');
    const [allSchools, setAllSchools] = useState<SchoolListItem[]>([]);
    const [filteredSchools, setFilteredSchools] = useState<SchoolListItem[]>([]);
    // Transaction ID removed as it's handled automatically
    const [isLoadingSchools, setIsLoadingSchools] = useState(false);
    const [showSchoolDropdown, setShowSchoolDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Payment State
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [paymentError, setPaymentError] = useState<string | null>(null);
    const [paymentEmail, setPaymentEmail] = useState('');
    // Phone number removed as requested

    // 1. Fetch All Schools for Combobox
    useEffect(() => {
        if (!isOpen) return;

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
                    const found = uniqueSchools.find(s => s.displayName === initialSchoolName);
                    if (found) setSelectedSchool(found);
                }
            } catch (error) {
                console.error('[Subscription] Failed to load schools:', error);
            } finally {
                setIsLoadingSchools(false);
            }
        };
        loadSchools();
        loadPaystackScript(); // Preload script
    }, [isOpen, initialSchoolName]);

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

    if (!isOpen) return null;

    const handlePayment = async () => {
        setPaymentError(null);
        if (!selectedSchool || !paymentEmail) {
            setPaymentError("Please fill in all fields");
            return;
        }

        const tier = SUBSCRIPTION_TIERS.find(t => t.name === selectedTier) || SUBSCRIPTION_TIERS[1];

        // Parse amount from price string (e.g., "GHS 100")
        const priceString = tier.price.replace(/[^0-9.]/g, '');
        const amount = parseFloat(priceString);

        if (isNaN(amount) || amount <= 0) {
            // Free tier or Request Quote
            if (tier.price.toLowerCase().includes('free')) {
                // Handle free tier activation directly
                activateFreeTier(tier);
                return;
            }
            if (tier.price.toLowerCase().includes('quote')) {
                window.location.href = `mailto:${ADMIN_EMAIL}?subject=Enterprise Quote Request&body=Requesting quote for ${selectedSchool.displayName}`;
                return;
            }
        }

        setIsProcessingPayment(true);

        try {
            // 1. Initialize Transaction
            const initResponse = await initializePayment(paymentEmail, amount, {
                schoolId: selectedSchool.docId,
                schoolName: selectedSchool.displayName,
                tierName: tier.name,
            });

            // 2. Open Paystack Popup
            const PaystackPop = (window as any).PaystackPop;

            if (!PaystackPop) {
                setPaymentError("Paystack SDK not loaded. Please refresh.");
                setIsProcessingPayment(false);
                return;
            }

            // Use .setup() legacy method which is standard for v1/inline.js
            const handler = PaystackPop.setup({
                key: 'pk_live_1018c988f6aa654f737092f2a09ec6cc6ca1065f', // Paystack Public Key
                email: paymentEmail,
                amount: amount * 100, // in kobo/pesewas
                ref: initResponse.reference, // Use backend/mock reference
                currency: 'GHS',
                metadata: {
                    custom_fields: [
                        {
                            display_name: "School",
                            variable_name: "school",
                            value: selectedSchool.displayName
                        }
                    ]
                },
                callback: (response: any) => {
                    // Wrap async logic in a sync function to satisfy Paystack library check
                    const handleSuccess = async () => {
                        // 3. Verify & Activate
                        try {
                            // Paystack Popup returns 'reference' in response object
                            await activateSubscription(
                                response.reference,
                                {
                                    id: selectedSchool.docId,
                                    name: selectedSchool.displayName,
                                    dbIndex: selectedSchool._databaseIndex || 1
                                },
                                tier
                            );
                            alert(`Success! Activation complete for ${selectedSchool.displayName}.`);
                            onClose();
                        } catch (err) {
                            console.error(err);
                            setPaymentError("Payment successful but activation failed. Please contact support.");
                        }
                    };
                    handleSuccess();
                },
                onClose: () => {
                    setIsProcessingPayment(false);
                    // alert('Transaction cancelled.');
                }
            });

            handler.openIframe();

        } catch (error: any) {
            console.error(error);
            setPaymentError(error.message || "Payment initialization failed.");
            setIsProcessingPayment(false);
        }
    };

    const activateFreeTier = async (tier: any) => {
        if (!selectedSchool) return;
        setIsProcessingPayment(true);
        try {
            // Use a specific reference for free tier
            const ref = `FREE_${Date.now()}`;
            await activateSubscription(
                ref,
                {
                    id: selectedSchool.docId,
                    name: selectedSchool.displayName,
                    dbIndex: selectedSchool._databaseIndex || 1
                },
                tier
            );
            alert(`Trial Activated for ${selectedSchool.displayName}!`);
            onClose();
        } catch (e) {
            setPaymentError("Failed to activate trial.");
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
                    <h2 className="text-2xl font-bold">Secure Payment & Activation</h2>
                    <p className="text-indigo-100 mt-1">Select your plan and activate instantly</p>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto">
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
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                            />
                            <div className="absolute right-3 top-3 flex items-center gap-2">
                                {isLoadingSchools && (
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                                )}
                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-gray-400 transition-transform ${showSchoolDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
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
                                    <path fillRule="evenodd" d="M10 18a8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span>Ready for activation</span>
                            </div>
                        )}
                    </div>

                    {/* 2. Tier Selection */}
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700">Select Subscription Tier</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                            {SUBSCRIPTION_TIERS.map((tier) => (
                                <button
                                    key={tier.name}
                                    onClick={() => setSelectedTier(tier.name)}
                                    className={`p-4 rounded-xl border-2 text-left transition-all ${selectedTier === tier.name
                                        ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-200'
                                        : 'border-gray-100 bg-gray-50 hover:border-indigo-200'
                                        }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <p className="font-bold text-gray-900">{tier.name}</p>
                                        <p className="text-indigo-600 font-bold text-sm text-right">{tier.price}</p>
                                    </div>
                                    <p className="text-xs text-gray-600 mt-1">
                                        {tier.maxStudents} Students • {tier.maxClass} Classes
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 3. Payment Details */}
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700">Billing Email</label>
                        <input
                            type="email"
                            placeholder="Enter email for receipt..."
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none transition-all"
                            value={paymentEmail}
                            onChange={(e) => setPaymentEmail(e.target.value)}
                        />
                        <p className="text-xs text-gray-500">We'll send the receipt to this email.</p>
                    </div>

                    {paymentError && (
                        <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-200">
                            {paymentError}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-6 bg-gray-50 flex flex-col gap-3 flex-shrink-0">
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
                                    <span>Pay & Activate</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SubscriptionRequestModal;
