import React, { useState, useEffect, useRef } from 'react';
import { SUBSCRIPTION_TIERS, ADMIN_EMAIL } from '../constants';
import { getSchoolList, SchoolListItem } from '../services/firebaseService';

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
    const [transactionId, setTransactionId] = useState('');
    const [isLoadingSchools, setIsLoadingSchools] = useState(false);
    const [showSchoolDropdown, setShowSchoolDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // 1. Fetch All Schools for Combobox
    useEffect(() => {
        if (!isOpen) return;

        const loadSchools = async () => {
            setIsLoadingSchools(true);
            try {
                const list = await getSchoolList();

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
    }, [isOpen, initialSchoolName]);

    // 2. Filter Schools for Combobox
    useEffect(() => {
        if (!searchTerm) {
            setFilteredSchools(allSchools);
            return;
        }

        const filtered = allSchools.filter(s =>
            s.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.docId.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setFilteredSchools(filtered);
    }, [searchTerm, allSchools]);

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

    const handleSend = () => {
        const tier = SUBSCRIPTION_TIERS.find(t => t.name === selectedTier) || SUBSCRIPTION_TIERS[1];
        const schoolName = selectedSchool ? selectedSchool.displayName : searchTerm;
        const schoolId = selectedSchool ? selectedSchool.docId : 'Not Selected';

        const subject = encodeURIComponent(`Subscription Request: ${schoolName}`);
        const body = encodeURIComponent(
            `Hello Admin,\n\n` +
            `I would like to request a subscription activation for my school.\n\n` +
            `--- Details ---\n` +
            `School Name: ${schoolName}\n` +
            `School ID: ${schoolId}\n` +
            `Requested Tier: ${selectedTier}\n` +
            `Benefits: ${tier.maxStudents} Students, ${tier.maxClass} Classes\n` +
            `Duration: ${tier.duration}\n` +
            `Price: ${tier.price}\n` +
            `Transaction ID: ${transactionId}\n\n` +
            `Please activate my account as soon as possible.\n\n` +
            `Thank you.`
        );

        window.location.href = `mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`;
        onClose();
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
                    <h2 className="text-2xl font-bold">Subscription & Payment</h2>
                    <p className="text-indigo-100 mt-1">Request account activation</p>
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
                                placeholder="Search or type school name..."
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
                                            No schools found. You can type a new name.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        {selectedSchool && (
                            <div className="flex items-center gap-2 text-green-600 text-sm mt-1 animate-fadeIn">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span>Verified school selected</span>
                            </div>
                        )}
                    </div>

                    {/* 2. Tier Selection */}
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700">Select Subscription Tier</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                                        <p className="text-indigo-600 font-bold text-sm">{tier.price}</p>
                                    </div>
                                    <p className="text-xs text-gray-600 mt-1">
                                        {tier.maxStudents} Students • {tier.maxClass} Classes
                                    </p>
                                    <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">
                                        Duration: {tier.duration}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 3. Transaction ID */}
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700">Transaction ID</label>
                        <input
                            type="text"
                            value={transactionId}
                            onChange={(e) => setTransactionId(e.target.value)}
                            placeholder="Enter the payment transaction ID..."
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                        />
                        <p className="text-xs text-gray-500 italic">
                            Proof of payment is required for manual activation.
                        </p>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 bg-gray-50 flex gap-3 flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 px-4 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-100 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={!searchTerm || !transactionId}
                        className={`flex-1 py-3 px-4 font-semibold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 ${!searchTerm || !transactionId
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 transform hover:scale-[1.02]'
                            }`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span>Send Request via Email</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SubscriptionRequestModal;
