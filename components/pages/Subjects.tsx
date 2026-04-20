import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import CameraCapture from '../CameraCapture';
import SignaturePad from '../SignaturePad';
import { useData } from '../../context/DataContext';
import type { Subject } from '../../types';
import ConfirmationModal from '../ConfirmationModal';
import ReadOnlyWrapper from '../ReadOnlyWrapper';
import { useUser } from '../../context/UserContext';
import { useUserAction } from '../../context/UserActionContext';
import RestoreModal from '../modals/RestoreModal';
import { DIRTY_INDICATOR_BG, DIRTY_INDICATOR_TEXT, DIRTY_INDICATOR_SECONDARY_TEXT, DIRTY_INDICATOR_HOVER_BG, DIRTY_INDICATOR_BORDER } from '../../constants';
import { processAndUploadImage, validateImageSize } from '../../utils/imageUtils';

const SIGNATURE_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTUwIDUwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGQ9Ik0yIDI1LjVDMiAyNS41IDE1LjUgMTUuNSAyOS41IDI4QzQzLjUgNDAuNSA1MyAyNS41IDY2LjUgMjAuNUM4MCAxNS41IDg4LjUgMjkgMTAwIDI5QzExMS41IDI5IDEyMyAxNS41IDEzNyAyOS41IiBzdHJva2U9IiM5Y2EzYWYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PC9zdmc+';

const EMPTY_SUBJECT_FORM: Omit<Subject, 'id'> = {
    subject: '',
    type: 'Core',
    facilitator: '',
    signature: '',
};

const Subjects: React.FC = () => {
    const { recordAction } = useUserAction();
    const { subjects, deletedSubjects, restoreItem, permanentlyDeleteItem, addSubject, updateSubject, deleteSubject, saveSubjects, isDirty, isItemDirty, isSyncing, isOnline, loadMetadata } = useData();
    const { currentUser } = useUser();

    // TRIGGER RECONCILIATION: Identify unsaved local items on mount
    React.useEffect(() => {
        loadMetadata();
    }, [loadMetadata]);
    const isAdmin = currentUser?.role === 'Admin';
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
    const [currentSubject, setCurrentSubject] = useState<Subject | Omit<Subject, 'id'> | null>(null);
    const firstInputRef = React.useRef<HTMLInputElement>(null);
    const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
    const [sessionAddedIds, setSessionAddedIds] = useState<number[]>([]);
    const [isSessionListOpen, setIsSessionListOpen] = useState(false);
    const [modalError, setModalError] = useState<string | null>(null);

    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isPermanentConfirmOpen, setIsPermanentConfirmOpen] = useState(false);
    const [itemIdToDelete, setItemIdToDelete] = useState<number | null>(null);
    const [idToPermanentlyDelete, setIdToPermanentlyDelete] = useState<number | null>(null);
    const [isDuplicateConfirmOpen, setIsDuplicateConfirmOpen] = useState(false);
    const [duplicatePendingSubject, setDuplicatePendingSubject] = useState<Subject | Omit<Subject, 'id'> | null>(null);
    const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
    const [selectedMergeTarget, setSelectedMergeTarget] = useState<number | null>(null);
    const [mergeDuplicates, setMergeDuplicates] = useState<number[]>([]);
    const { mergeSubjects } = useData();
    const [searchQuery, setSearchQuery] = useState('');
    const [showSignaturePad, setShowSignaturePad] = useState(false);
    const [isUploadingSignature, setIsUploadingSignature] = useState(false);

    // Context menu for subject signature download
    const [sigContextMenu, setSigContextMenu] = useState<{ x: number; y: number } | null>(null);
    const sigLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const sigContextMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (sigContextMenu && sigContextMenuRef.current && !sigContextMenuRef.current.contains(e.target as Node)) {
                setSigContextMenu(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [sigContextMenu]);

    const handleSignatureDrawSave = useCallback(async (dataUrl: string) => {
        setIsUploadingSignature(true);
        try {
            const url = await processAndUploadImage(dataUrl);
            setCurrentSubject(prev => prev ? { ...prev, signature: url } : null);
        } catch (error) {
            console.error("Subject signature upload failed", error);
            alert("Failed to upload signature. Please try again.");
        } finally {
            setIsUploadingSignature(false);
        }
    }, []);

    const handleSigFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            if (!validateImageSize(e.target.files[0])) { e.target.value = ''; return; }
            setIsUploadingSignature(true);
            const reader = new FileReader();
            reader.onload = async (event) => {
                const raw = event.target?.result as string;
                try {
                    const url = await processAndUploadImage(raw);
                    setCurrentSubject(prev => prev ? { ...prev, signature: url } : null);
                } catch (error) {
                    console.error("Subject signature file upload failed", error);
                    alert("Failed to upload signature file.");
                } finally {
                    setIsUploadingSignature(false);
                }
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const handleSigCameraCapture = async (imageData: string) => {
        setIsUploadingSignature(true);
        try {
            const url = await processAndUploadImage(imageData);
            setCurrentSubject(prev => prev ? { ...prev, signature: url } : null);
        } catch (error) {
            console.error("Subject signature camera capture failed", error);
            alert("Failed to upload captured signature.");
        } finally {
            setIsUploadingSignature(false);
        }
    };

    const handleClearSignature = () => {
        setCurrentSubject(prev => prev ? { ...prev, signature: '' } : null);
    };

    const downloadSubjectSignature = useCallback(() => {
        const src = currentSubject?.signature;
        if (!src) return;
        const a = document.createElement('a');
        a.href = src;
        a.download = 'subject-facilitator-signature.png';
        a.click();
        setSigContextMenu(null);
    }, [currentSubject?.signature]);

    const handleSigContextMenu = useCallback((e: React.MouseEvent) => {
        if (!currentSubject?.signature) return;
        e.preventDefault();
        setSigContextMenu({ x: e.clientX, y: e.clientY });
    }, [currentSubject?.signature]);

    const handleSigTouchStart = useCallback((e: React.TouchEvent) => {
        if (!currentSubject?.signature) return;
        sigLongPressTimer.current = setTimeout(() => {
            const touch = e.touches[0];
            setSigContextMenu({ x: touch.clientX, y: touch.clientY });
        }, 500);
    }, [currentSubject?.signature]);

    const handleSigTouchEnd = useCallback(() => {
        if (sigLongPressTimer.current) {
            clearTimeout(sigLongPressTimer.current);
            sigLongPressTimer.current = null;
        }
    }, []);

    const inputStyles = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500";
    const searchInputStyles = "w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

    const filteredSubjects = useMemo(() => {
        const query = searchQuery.toLowerCase();
        if (!query) return subjects;
        return subjects.filter(subject =>
            subject.subject.toLowerCase().includes(query) ||
            subject.type.toLowerCase().includes(query)
        );
    }, [subjects, searchQuery]);

    const visibleDeletedSubjects = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.role === 'Admin') return deletedSubjects;
        return deletedSubjects.filter(s => s.deletedBy === currentUser.id);
    }, [deletedSubjects, currentUser]);

    const duplicateGroups = useMemo(() => {
        const groups: Record<string, Subject[]> = {};
        subjects.forEach(s => {
            const name = s.subject.trim().toLowerCase();
            if (!groups[name]) groups[name] = [];
            groups[name].push(s);
        });
        return Object.entries(groups)
            .filter(([_, list]) => list.length > 1)
            .map(([name, list]) => ({ name, subjects: list }));
    }, [subjects]);

    const handleAddNew = () => {
        setModalError(null);
        setCurrentSubject(EMPTY_SUBJECT_FORM);
        setIsModalOpen(true);
        recordAction('Opened modal to add new subject');
    };

    const handleEdit = (subject: Subject) => {
        setModalError(null);
        setCurrentSubject(subject);
        setIsModalOpen(true);
        recordAction(`Opened modal to edit subject: ${subject.subject}`);
    };


    const handleDeleteClick = (id: number) => {
        setItemIdToDelete(id);
        setIsConfirmOpen(true);
    };

    const handleConfirmDelete = () => {
        if (itemIdToDelete !== null) {
            deleteSubject(itemIdToDelete);
        }
        setIsConfirmOpen(false);
        setItemIdToDelete(null);
    };

    const handlePermanentDeleteClick = (id: number) => {
        setIdToPermanentlyDelete(id);
        setIsPermanentConfirmOpen(true);
    };

    const handleConfirmPermanentDelete = () => {
        if (idToPermanentlyDelete !== null) {
            permanentlyDeleteItem('subjects', idToPermanentlyDelete);
        }
        setIsPermanentConfirmOpen(false);
        setIdToPermanentlyDelete(null);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentSubject(null);
        setSaveFeedback(null);
        setSessionAddedIds([]);
        setIsSessionListOpen(false);
        setModalError(null);
    };

    // Auto-focus logic: Trigger ONLY on initial modal open
    React.useEffect(() => {
        if (isModalOpen && firstInputRef.current) {
            const timer = setTimeout(() => {
                firstInputRef.current?.focus();
                firstInputRef.current?.select();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isModalOpen]);


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (modalError) setModalError(null);
        setCurrentSubject(prev => prev ? { ...prev, [name]: value } : null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentSubject) return;

        if (isUploadingSignature) {
            alert("Please wait for the signature to finish uploading.");
            return;
        }

        // DUPLICATE PREVENTION: Check if Subject Name already exists
        const isDuplicate = subjects.some(s =>
            (s.subject || '').trim().toLowerCase() === (currentSubject.subject || '').trim().toLowerCase() &&
            ('id' in currentSubject ? s.id !== currentSubject.id : true)
        );

        if (isDuplicate) {
            setDuplicatePendingSubject(currentSubject);
            setIsDuplicateConfirmOpen(true);
            return;
        }

        executeSubmit(currentSubject);
    };

    const executeSubmit = (subject: Subject | Omit<Subject, 'id'>) => {
        if ('id' in subject) {
            updateSubject(subject);
        } else {
            const newId = addSubject(subject);
            if (newId) {
                setSessionAddedIds(prev => [newId, ...prev]);
            }

            // STAY OPEN ON ADD for continuous entry
            setSaveFeedback(`Subject "${subject.subject}" Added!`);
            setCurrentSubject(EMPTY_SUBJECT_FORM);

            // Explicit focus AND select for batch entry (after reset)
            setTimeout(() => {
                if (firstInputRef.current) {
                    firstInputRef.current.focus();
                    firstInputRef.current.select();
                }
            }, 150);

            setTimeout(() => setSaveFeedback(null), 3000);
            return;
        }
        handleCloseModal();
    };

    const handleMergeClick = (group: { name: string, subjects: Subject[] }) => {
        const ids = group.subjects.map(s => s.id);
        setMergeDuplicates(ids);
        setSelectedMergeTarget(ids[0]);
        setIsMergeModalOpen(true);
    };

    const executeMerge = () => {
        if (selectedMergeTarget && mergeDuplicates.length > 1) {
            const duplicatesToMerge = mergeDuplicates.filter(id => id !== selectedMergeTarget);
            mergeSubjects(selectedMergeTarget, duplicatesToMerge);
            setIsMergeModalOpen(false);
            setMergeDuplicates([]);
            setSelectedMergeTarget(null);
            alert("Subjects merged successfully! All scores and user permissions have been updated.");
        }
    };


    return (
        <div className="space-y-6 pb-24 lg:pb-0">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-800">Manage Subjects</h1>
                {/* Save Button Removed - Using Global Action Bar */}
            </div>

            <div className="bg-gray-100 py-4">
                <div className="flex flex-col md:flex-row justify-start items-center gap-4">
                    <div className="relative w-full md:w-1/3">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Search by subject or type..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={searchInputStyles}
                        />
                    </div>

                    <ReadOnlyWrapper allowedRoles={['Admin']}>
                        {isAdmin && (
                            <div className="flex items-center gap-3">
                                <button onClick={handleAddNew} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition-colors w-full md:w-auto justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                    </svg>
                                    Add New Subject
                                </button>
                                {visibleDeletedSubjects.length > 0 && (
                                    <button
                                        onClick={() => setIsRestoreModalOpen(true)}
                                        className="flex items-center space-x-2 px-3 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition shadow-sm font-semibold border border-red-200"
                                        title="Restore Deleted Subjects"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                        </svg>
                                        <span className="hidden sm:inline">Restore</span>
                                    </button>
                                )}
                                {duplicateGroups.length > 0 && (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm animate-pulse">
                                        <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        <span>Detected {duplicateGroups.length} duplicate subject groups.</span>
                                        <button 
                                            onClick={() => handleMergeClick(duplicateGroups[0])}
                                            className="ml-2 font-bold underline hover:no-underline"
                                        >
                                            Fix Now
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </ReadOnlyWrapper>
                </div>
            </div>

            {/* Desktop Table View */}
            <ReadOnlyWrapper allowedRoles={['Admin']}>
                <div className="hidden lg:block bg-white p-6 rounded-xl shadow-md border border-gray-200">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50 border-b">
                                    <th className="p-4 font-semibold text-gray-600">#</th>
                                    <th className="p-4 font-semibold text-gray-600">Subject Name</th>
                                    <th className="p-4 font-semibold text-gray-600">Type</th>
                                    <th className="p-4 font-semibold text-gray-600">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSubjects.length > 0 ? (
                                    filteredSubjects.map((subject, index) => {
                                        const isDirtyRow = isItemDirty('subjects', subject.id);
                                        return (
                                            <tr key={subject.id} className={`border-b transition-colors ${isDirtyRow ? `${DIRTY_INDICATOR_BG} ${DIRTY_INDICATOR_TEXT} ${DIRTY_INDICATOR_HOVER_BG}` : 'hover:bg-gray-50'}`}>
                                                <td className="p-4 relative">
                                                    {index + 1}
                                                    {isDirtyRow && (
                                                        <span className="absolute left-0 top-0 text-[10px] font-bold uppercase tracking-wider px-1 py-0.5 bg-yellow-400 text-black leading-none rounded-br z-10">
                                                            Unsaved
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-4 font-medium">{subject.subject}</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${subject.type === 'Core' ? (isDirtyRow ? 'bg-green-900/50 text-green-100 border border-green-700' : 'bg-green-100 text-green-800') : (isDirtyRow ? 'bg-amber-900/50 text-amber-100 border border-amber-700' : 'bg-yellow-100 text-yellow-800')}`}>
                                                        {subject.type}
                                                    </span>
                                                </td>
                                                <td className="p-4 space-x-4 flex items-center">
                                                    {isAdmin && (
                                                        <>
                                                            <button onClick={() => handleEdit(subject)} className={`${isDirtyRow ? `${DIRTY_INDICATOR_SECONDARY_TEXT} hover:text-white` : 'text-blue-600 hover:text-blue-800'}`} title="Edit">
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" />
                                                                </svg>
                                                            </button>
                                                            <button onClick={() => handleDeleteClick(subject.id)} className={`${isDirtyRow ? 'text-white hover:text-gray-200 opacity-90' : 'text-red-600 hover:text-red-800'}`} title="Delete">
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                </svg>
                                                            </button>
                                                        </>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="text-center p-8 text-gray-500">
                                            No subjects found matching your search.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden space-y-4">
                    {filteredSubjects.length > 0 ? (
                        filteredSubjects.map((subject, index) => {
                            const isDirtyRow = isItemDirty('subjects', subject.id);
                            return (
                                <div key={subject.id} className={`p-4 rounded-xl shadow-md border transition-colors flex justify-between items-center relative ${isDirtyRow ? `${DIRTY_INDICATOR_BG} ${DIRTY_INDICATOR_BORDER} ${DIRTY_INDICATOR_TEXT}` : 'bg-white border-gray-200'}`}>
                                    {isDirtyRow && (
                                        <div className="absolute top-0 right-0 bg-yellow-400 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-bl uppercase z-10">
                                            Unsaved
                                        </div>
                                    )}
                                    <div className="flex items-center gap-3">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center relative">
                                            <div className={`absolute inset-0 rounded-full opacity-20 ${isDirtyRow ? 'bg-white' : 'bg-blue-500'}`}></div>
                                            <span className={`${isDirtyRow ? 'text-white' : 'text-blue-700'} font-bold text-sm z-10`}>{index + 1}</span>
                                        </div>
                                        <div>
                                            <p className={`font-bold ${isDirtyRow ? 'text-white' : 'text-gray-800'}`}>{subject.subject}</p>
                                            <span className={`mt-1 inline-block px-2 py-1 text-xs font-semibold rounded-full ${subject.type === 'Core' ? (isDirtyRow ? 'bg-green-900/50 text-green-100 border border-green-700' : 'bg-green-100 text-green-800') : (isDirtyRow ? 'bg-amber-900/50 text-amber-100 border border-amber-700' : 'bg-yellow-100 text-yellow-800')}`}>
                                                {subject.type}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex space-x-2 flex-shrink-0">
                                        {isAdmin && (
                                            <>
                                                <button onClick={() => handleEdit(subject)} className={`${isDirtyRow ? `${DIRTY_INDICATOR_SECONDARY_TEXT} hover:text-white` : 'text-blue-600 hover:bg-blue-100'} p-2 rounded-full`} title="Edit">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>
                                                </button>
                                                <button onClick={() => handleDeleteClick(subject.id)} className={`${isDirtyRow ? 'text-white hover:bg-black/20' : 'text-red-600 hover:bg-red-100'} p-2 rounded-full`} title="Delete">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center p-8 text-gray-500 bg-white rounded-xl shadow-md border border-gray-200">
                            No subjects found matching your search.
                        </div>
                    )}
                </div>
            </ReadOnlyWrapper>


            {isModalOpen && currentSubject && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-2 sm:p-4">
                    <div className="bg-white p-3 sm:p-5 rounded-xl shadow-2xl w-full max-w-lg relative animate-fade-in-scale overflow-y-auto max-h-[98vh] sm:max-h-[95vh]">

                        <div className="flex items-center justify-between mb-3 border-b pb-2">
                            <h2 className="text-lg sm:text-xl font-bold text-gray-800">{'id' in currentSubject ? 'Edit Subject' : 'Add New Subject'}</h2>
                            
                            {/* Session Counter Badge (Header position) */}
                            {sessionAddedIds.length > 0 && (
                                <button 
                                    type="button"
                                    onClick={() => setIsSessionListOpen(!isSessionListOpen)}
                                    className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-sm border border-blue-500 active:scale-95"
                                >
                                    <span className="text-[10px] font-bold">{sessionAddedIds.length} Added</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 transition-transform ${isSessionListOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* Feedback label removed from top */}

                        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                            <div className="grid grid-cols-2 gap-2.5">
                                <div className="col-span-1">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-tight mb-1">Subject Name</label>
                                    <div className="relative">
                                        <input ref={firstInputRef} type="text" name="subject" value={currentSubject.subject} onChange={handleChange} required className={`${inputStyles} py-1.5 text-sm`} placeholder="e.g. Mathematics" />
                                        
                                        {/* Session List Dropdown */}
                                        {isSessionListOpen && sessionAddedIds.length > 0 && (
                                            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-100 p-2 max-h-40 overflow-y-auto animate-fade-in-down ring-1 ring-black/5">
                                                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 px-1 flex justify-between">
                                                    <span>Session History</span>
                                                    <span>({sessionAddedIds.length})</span>
                                                </div>
                                                <div className="space-y-1">
                                                    {sessionAddedIds.map(id => {
                                                        const s = subjects.find(item => item.id === id);
                                                        const isDirty = isItemDirty('subjects', id);
                                                        return (
                                                            <div key={id} className="flex items-center justify-between px-2 py-1.5 bg-gray-50 rounded text-xs">
                                                                <span className="truncate flex-1 text-gray-700 font-medium">{s?.subject || 'Unknown'}</span>
                                                                <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                                                    isDirty ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'
                                                                }`}>
                                                                    {isDirty ? 'Pending' : 'Saved'}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Push-Down Feedback */}
                                    <div className={`overflow-hidden transition-all duration-300 ${saveFeedback ? 'max-h-12 mt-1 opacity-100' : 'max-h-0 opacity-0'}`}>
                                        <div className="text-green-600 font-bold text-[11px] py-1 pl-1 flex items-center bg-green-50 rounded">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                            {saveFeedback || ''}
                                        </div>
                                    </div>
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-tight mb-1">Type</label>
                                    <select name="type" value={currentSubject.type} onChange={handleChange} className={`${inputStyles} py-1.5 text-sm`}>
                                        <option>Core</option>
                                        <option>Elective</option>
                                    </select>
                                </div>
                            </div>

                            {modalError && <p className="text-red-500 text-[10px] mt-0.5 font-bold animate-pulse">{modalError}</p>}

                            {/* Facilitator Signature — hidden, reserved for future enhancement */}
                            {false && <div className="bg-gray-50 p-2 sm:p-3 rounded-lg border border-gray-100">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-tight mb-2">Facilitator's Signature <span className="font-normal normal-case text-gray-400">(optional)</span></label>
                                <div className="flex items-center space-x-3 sm:space-x-4">
                                    <div className="relative flex-shrink-0">
                                        <img
                                            src={currentSubject.signature || SIGNATURE_PLACEHOLDER}
                                            alt="Signature Preview"
                                            title={currentSubject.signature ? 'Right-click or long-press to download' : undefined}
                                            className={`h-10 w-28 sm:h-12 sm:w-36 object-contain border p-1 rounded-md bg-white shadow-sm ${currentSubject.signature ? 'cursor-context-menu' : ''} ${isUploadingSignature ? 'opacity-40 animate-pulse' : ''}`}
                                            onContextMenu={handleSigContextMenu}
                                            onTouchStart={handleSigTouchStart}
                                            onTouchEnd={handleSigTouchEnd}
                                            onTouchMove={handleSigTouchEnd}
                                            draggable={false}
                                        />
                                        {isUploadingSignature && (
                                            <div className="absolute inset-0 bg-black/10 rounded-md flex items-center justify-center">
                                                <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent animate-spin rounded-full"></div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex flex-wrap gap-2">
                                            <input
                                                type="file"
                                                id="subject-signature-upload"
                                                accept="image/*"
                                                onChange={handleSigFileChange}
                                                disabled={isUploadingSignature}
                                                className="hidden"
                                            />
                                            <label htmlFor="subject-signature-upload" className={`cursor-pointer text-[10px] bg-white border border-gray-300 px-2.5 py-1.5 rounded-full font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm ${isUploadingSignature ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                Upload
                                            </label>
                                            <CameraCapture onCapture={handleSigCameraCapture} disabled={isUploadingSignature} />
                                            <button
                                                type="button"
                                                onClick={() => setShowSignaturePad(true)}
                                                disabled={isUploadingSignature}
                                                className="text-[10px] bg-indigo-50 border border-indigo-200 px-2.5 py-1.5 rounded-full font-bold text-indigo-700 hover:bg-indigo-100 transition-colors shadow-sm flex items-center gap-1 disabled:opacity-50"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                </svg>
                                                {isUploadingSignature ? "Uploading..." : "Draw"}
                                            </button>
                                            {currentSubject.signature && (
                                                <button type="button" onClick={handleClearSignature} disabled={isUploadingSignature} className="text-red-500 text-[10px] font-bold hover:underline px-1 disabled:opacity-50">
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>}

                            <div className="flex justify-end pt-2 space-x-2 border-t mt-2">
                                <button type="button" onClick={handleCloseModal} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors">Close</button>
                                <button type="submit" className="px-5 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-sm transition-all active:scale-95">Commit</button>
                            </div>
                        </form>

                    </div>
                </div>
            )}

            {/* Signature drawing pad modal */}
            {showSignaturePad && (
                <SignaturePad
                    onSave={handleSignatureDrawSave}
                    onClose={() => setShowSignaturePad(false)}
                />
            )}

            {/* Signature context menu (right-click / long-press) */}
            {sigContextMenu && (
                <div
                    ref={sigContextMenuRef}
                    className="fixed z-[60] bg-white rounded-xl shadow-2xl border border-gray-100 py-1.5 min-w-[210px] overflow-hidden"
                    style={{ top: sigContextMenu.y, left: sigContextMenu.x }}
                >
                    <button
                        className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors gap-2.5"
                        onClick={downloadSubjectSignature}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download Signature
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    <button
                        className="flex items-center w-full px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors gap-2.5"
                        onClick={() => setSigContextMenu(null)}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Close
                    </button>
                </div>
            )}

            <ConfirmationModal
                isOpen={isConfirmOpen}
                message="Are you sure you want to delete this subject? Its records will be hidden."
                onConfirm={handleConfirmDelete}
                onClose={() => {
                    setIsConfirmOpen(false);
                    setItemIdToDelete(null);
                }}
                title="Delete Subject"
            />

            <RestoreModal
                isOpen={isRestoreModalOpen}
                onClose={() => setIsRestoreModalOpen(false)}
                title="Restore Deleted Subjects"
                items={deletedSubjects}
                onRestore={(id) => restoreItem('subjects', id)}
                onDeletePermanently={handlePermanentDeleteClick}
                itemNameKey="subject"
            />

            <ConfirmationModal
                isOpen={isPermanentConfirmOpen}
                message={
                    <>
                        Are you sure you want to <span className="font-bold text-red-600 underline">permanently delete</span> this subject? 
                        <br /><br />
                        This action <span className="font-bold">cannot be undone</span> and all related records will be completely removed from the system.
                    </>
                }
                onConfirm={handleConfirmPermanentDelete}
                onClose={() => {
                    setIsPermanentConfirmOpen(false);
                    setIdToPermanentlyDelete(null);
                }}
                title="Permanent Deletion"
                variant={currentUser && currentUser.id === idToPermanentlyDelete ? "warning" : undefined}
            />

            {/* Duplicate Confirmation Modal */}
            <ConfirmationModal
                isOpen={isDuplicateConfirmOpen}
                onClose={() => setIsDuplicateConfirmOpen(false)}
                onConfirm={() => {
                    if (duplicatePendingSubject) executeSubmit(duplicatePendingSubject);
                    setIsDuplicateConfirmOpen(false);
                }}
                title="Duplicate Subject Name"
                message={`A subject with the name "${duplicatePendingSubject?.subject}" already exists. Are you sure you want to create another one? Having multiple subjects with the same name can cause confusion.`}
                variant="warning"
                confirmText="Yes, Create Duplicate"
                cancelText="No, Change Name"
            />

            {/* Merge Modal */}
            {isMergeModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[60] p-4">
                    <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-lg">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">Merge Duplicate Subjects</h2>
                        <p className="text-gray-600 mb-6">
                            Consolidate multiple records for <span className="font-bold text-blue-600">"{duplicateGroups.find(g => g.subjects.some(s => s.id === mergeDuplicates[0]))?.name}"</span> into one master record.
                        </p>
                        
                        <div className="space-y-4 mb-6">
                            <label className="block text-sm font-medium text-gray-700">Select Master Subject (This ID will be kept):</label>
                            <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-2">
                                {mergeDuplicates.map(id => {
                                    const s = subjects.find(sub => sub.id === id);
                                    if (!s) return null;
                                    return (
                                        <label key={id} className={`flex items-center p-3 rounded-lg border cursor-pointer transition ${selectedMergeTarget === id ? 'bg-blue-50 border-blue-500' : 'hover:bg-gray-50 border-gray-200'}`}>
                                            <input 
                                                type="radio" 
                                                name="mergeTarget" 
                                                checked={selectedMergeTarget === id}
                                                onChange={() => setSelectedMergeTarget(id)}
                                                className="h-4 w-4 text-blue-600"
                                            />
                                            <div className="ml-3">
                                                <div className="font-medium text-gray-900">{s.subject} (ID: {s.id})</div>
                                                <div className="text-xs text-gray-500">{s.type} {s.facilitator ? `• ${s.facilitator}` : ''}</div>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                            <h4 className="text-amber-800 font-bold flex items-center gap-2 text-sm">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                CONSEQUENCES OF MERGING:
                            </h4>
                            <ul className="text-xs text-amber-700 list-disc list-inside mt-2 space-y-1">
                                <li>All student scores from duplicate IDs will move to the Master ID.</li>
                                <li>User permissions (Teacher access) will be updated to the Master ID.</li>
                                <li>Duplicate subject records will be deleted.</li>
                                <li><span className="font-bold">This action cannot be undone.</span></li>
                            </ul>
                        </div>

                        <div className="flex gap-3">
                            <button 
                                onClick={() => setIsMergeModalOpen(false)}
                                className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={executeMerge}
                                className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg transition font-bold"
                            >
                                Confirm Merge
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Subjects;