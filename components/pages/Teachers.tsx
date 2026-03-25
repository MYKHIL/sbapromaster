import React, { useState, useMemo } from 'react';
import CameraCapture from '../CameraCapture';
import { useData } from '../../context/DataContext';
import SaveButton from '../SaveButton';
import type { Class } from '../../types';
import ConfirmationModal from '../ConfirmationModal';
import { enhanceImage } from '../../services/geminiService';
import RestoreModal from '../modals/RestoreModal';
import { AI_FEATURES_ENABLED, AUTO_SANITIZE_TEACHERS, DIRTY_INDICATOR_BG, DIRTY_INDICATOR_TEXT, DIRTY_INDICATOR_SECONDARY_TEXT, DIRTY_INDICATOR_HOVER_BG, DIRTY_INDICATOR_BORDER } from '../../constants';
import ReadOnlyWrapper from '../ReadOnlyWrapper';
import { useUser } from '../../context/UserContext';
import { processImageForUpload, validateImageSize } from '../../utils/imageUtils';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';
import { useUserAction } from '../../context/UserActionContext';
import type { NavigationMeta } from '../../types';

interface TeachersProps {
    navigationMeta?: NavigationMeta | null;
}

const EMPTY_TEACHER_FORM: Omit<Class, 'id'> = {
    name: '',
    teacherName: '',
    teacherSignature: '',
};

const SIGNATURE_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTUwIDUwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGQ9Ik0yIDI1LjVDMiAyNS41IDE1LjUgMTUuNSAyOS41IDI4QzQzLjUgNDAuNSA1MyAyNS41IDY2LjUgMjAuNUM4MCAxNS41IDg4LjUgMjkgMTAwIDI5QzExMS41IDI5IDEyMyAxNS41IDEzNyAyOS41IiBzdHJva2U9IiM5Y2EzYWYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PC9zdmc+';

const Teachers: React.FC<TeachersProps> = ({ navigationMeta }) => {
    const { recordAction } = useUserAction();
    const { classes, deletedClasses, restoreItem, permanentlyDeleteItem, addClass, updateClass, deleteClass, saveClasses, isDirty, isItemDirty, isSyncing, isOnline, subscription, loadMetadata } = useData();
    const { currentUser } = useUser();
    const isAdmin = currentUser?.role === 'Admin';
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
    const [currentClassData, setCurrentClassData] = useState<Class | Omit<Class, 'id'> | null>(null);
    const firstInputRef = React.useRef<HTMLInputElement>(null);

    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isPermanentConfirmOpen, setIsPermanentConfirmOpen] = useState(false);
    const [itemIdToDelete, setItemIdToDelete] = useState<number | null>(null);
    const [idToPermanentlyDelete, setIdToPermanentlyDelete] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
    const [sessionAddedIds, setSessionAddedIds] = useState<number[]>([]);
    const [isSessionListOpen, setIsSessionListOpen] = useState(false);
    const [modalError, setModalError] = useState<string | null>(null);

    React.useEffect(() => {
        if (isModalOpen && firstInputRef.current) {
            const timer = setTimeout(() => {
                firstInputRef.current?.focus();
                firstInputRef.current?.select();
            }, 100);
            return () => clearTimeout(timer);
        }
        if (!isModalOpen) {
            setSessionAddedIds([]);
            setIsSessionListOpen(false);
        }
    }, [isModalOpen]);

    // Initial check for navigation meta (handle instructions to open modal)
    // AND: Trigger Metadata Reconciliation to identify unsaved local items
    React.useEffect(() => {
        loadMetadata();
        if (navigationMeta?.openAddModal && isAdmin) {
            handleAddNew();
        }
    }, [navigationMeta, isAdmin, loadMetadata]);

    const inputStyles = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500";
    const searchInputStyles = "w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

    const filteredClasses = useMemo(() => {
        const query = searchQuery.toLowerCase();
        let result = classes;

        // Filter by search query
        if (query) {
            result = result.filter(cls =>
                (cls.name || '').toLowerCase().includes(query) ||
                (cls.teacherName || '').toLowerCase().includes(query)
            );
        }

        return result;
    }, [classes, searchQuery]);

    const visibleDeletedClasses = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.role === 'Admin') return deletedClasses;
        return deletedClasses.filter(c => c.deletedBy === currentUser.id);
    }, [deletedClasses, currentUser]);

    // AUTO-SANITIZATION: Remove duplicate Class+Teacher entries
    React.useEffect(() => {
        if (!AUTO_SANITIZE_TEACHERS || !isAdmin || classes.length === 0) return;

        const seen = new Set<string>();
        const duplicates: number[] = [];

        classes.forEach(cls => {
            const key = `${(cls.name || '').trim().toLowerCase()}_${(cls.teacherName || '').trim().toLowerCase()}`;
            if (seen.has(key)) {
                duplicates.push(cls.id);
            } else {
                seen.add(key);
            }
        });

        if (duplicates.length > 0) {
            console.warn(`[Teachers] Auto-sanitizing ${duplicates.length} duplicate teacher-class entries...`);
            duplicates.forEach(id => deleteClass(id));
        }
    }, [classes, isAdmin, deleteClass]);

    // Check if current user can edit a specific class
    const canEditClass = (cls: Class) => {
        if (isAdmin) return true;
        if (!currentUser) return false;
        return currentUser.allowedClasses?.includes(cls.name);
    };

    const handleAddNew = () => {
        setModalError(null);
        setCurrentClassData(EMPTY_TEACHER_FORM);
        setIsModalOpen(true);
        recordAction('Opened modal to add new teacher/class');
    };

    const handleEdit = (cls: Class) => {
        if (canEditClass(cls)) {
            setModalError(null);
            setCurrentClassData(cls);
            setIsModalOpen(true);
            recordAction(`Opened modal to edit teacher for class: ${cls.name}`);
        }
    };


    const handleDeleteClick = (id: number) => {
        setItemIdToDelete(id);
        setIsConfirmOpen(true);
    };

    const handleConfirmDelete = () => {
        if (itemIdToDelete !== null) {
            deleteClass(itemIdToDelete);
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
            permanentlyDeleteItem('classes', idToPermanentlyDelete);
        }
        setIsPermanentConfirmOpen(false);
        setIdToPermanentlyDelete(null);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentClassData(null);
        setSaveFeedback(null);
        setModalError(null);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (modalError) setModalError(null);
        setCurrentClassData(prev => prev ? { ...prev, [name]: value } : null);
    };



    const handleExportExcel = () => {
        const headers = ['Class Name', 'Teacher Name'];
        const keys = ['name', 'teacherName'];
        exportToExcel(filteredClasses, headers, keys, 'Teachers_List', 'Teachers');
    };

    const handleExportPDF = () => {
        const headers = ['Class Name', 'Teacher Name'];
        const data = filteredClasses.map(c => [c.name, c.teacherName]);
        exportToPDF('Teachers List', headers, data, 'Teachers_List');
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            if (!validateImageSize(e.target.files[0])) {
                e.target.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = async (event) => {
                const raw = event.target?.result as string;
                try {
                    const processed = await processImageForUpload(raw);
                    setCurrentClassData(prev => prev ? { ...prev, teacherSignature: processed } : null);
                } catch {
                    setCurrentClassData(prev => prev ? { ...prev, teacherSignature: raw } : null);
                }
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const handleCameraCapture = async (imageData: string) => {
        try {
            const processed = await processImageForUpload(imageData);
            setCurrentClassData(prev => prev ? { ...prev, teacherSignature: processed } : null);
        } catch {
            setCurrentClassData(prev => prev ? { ...prev, teacherSignature: imageData } : null);
        }
    };

    const handleClearImage = () => {
        setCurrentClassData(prev => prev ? { ...prev, teacherSignature: '' } : null);
    };

    const handleEnhanceImage = async () => {
        if (!currentClassData?.teacherSignature) {
            alert("Please upload a signature first.");
            return;
        }
        setIsEnhancing(true);
        try {
            const enhancedImage = await enhanceImage(currentClassData.teacherSignature);
            setCurrentClassData(prev => prev ? { ...prev, teacherSignature: enhancedImage } : null);
        } catch (error) {
            console.error(error);
            alert((error as Error).message);
        } finally {
            setIsEnhancing(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentClassData) return;

        // DUPLICATE PREVENTION: Check if Class Name + Teacher Name already exists
        const isDuplicate = classes.some(cls =>
            (cls.name || '').trim().toLowerCase() === (currentClassData.name || '').trim().toLowerCase() &&
            (cls.teacherName || '').trim().toLowerCase() === (currentClassData.teacherName || '').trim().toLowerCase() &&
            ('id' in currentClassData ? cls.id !== currentClassData.id : true)
        );

        if (isDuplicate) {
            setModalError("This Class + Teacher combination already exists.");
            return;
        }

        if ('id' in currentClassData) {
            updateClass(currentClassData);
        } else {
            const newId = addClass(currentClassData);
            if (newId) {
                setSessionAddedIds(prev => [newId, ...prev]);
            }

            // STAY OPEN ON ADD
            setSaveFeedback("Class Added Successfully!");
            setCurrentClassData(EMPTY_TEACHER_FORM);

            // Explicit focus AND select for batch entry (after reset)
            setTimeout(() => {
                if (firstInputRef.current) {
                    firstInputRef.current.focus();
                    firstInputRef.current.select();
                }
            }, 150);

            // Vanish after 3s
            setTimeout(() => setSaveFeedback(null), 3000);
            return; // Don't close modal
        }
        handleCloseModal();
    };
    const maxClasses = subscription?.maxClass || Infinity;
    const isLimitReached = classes.length >= maxClasses;

    return (
        <div className="space-y-6">
            {isLimitReached && (
                <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-md shadow-sm animate-pulse mb-4">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-amber-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-amber-700">
                                <span className="font-bold">License Limit Reached:</span> You have reached the maximum number of classes ({maxClasses}) allowed by your current subscription. Please upgrade your license to add more classes.
                            </p>
                        </div>
                    </div>
                </div>
            )}
            <h1 className="text-3xl font-bold text-gray-800">Manage Classes &amp; Teachers</h1>

            <div className="bg-gray-100 py-4">
                <div className="flex flex-col md:flex-row justify-start items-center gap-4">
                    <div className="relative w-full md:w-1/3">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Search by class or teacher name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={searchInputStyles}
                        />
                    </div>
                    <ReadOnlyWrapper allowedRoles={['Admin', 'Teacher']}>
                        {isAdmin && (
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleAddNew}
                                    disabled={isLimitReached}
                                    className={`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition shadow-sm ${isLimitReached ? 'bg-gray-400 cursor-not-allowed opacity-75' : 'bg-blue-600 hover:bg-blue-700'}`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                    </svg>
                                    <span>Add New Teacher/Class</span>
                                </button>
                                {visibleDeletedClasses.length > 0 && (
                                    <button
                                        onClick={() => setIsRestoreModalOpen(true)}
                                        className="flex items-center space-x-2 px-3 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition shadow-sm font-semibold border border-red-200"
                                        title="Restore Deleted Classes"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                        </svg>
                                        <span className="hidden sm:inline">Restore</span>
                                    </button>
                                )}
                                <button
                                    onClick={handleExportExcel}
                                    className="p-2 hover:bg-gray-100 rounded-full transition-colors group"
                                    title="Export to Excel"
                                >
                                    <svg className="w-8 h-8 text-green-600 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 16 16">
                                        <path d="M9.293 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.707A1 1 0 0 0 13.707 4L10 .293A1 1 0 0 0 9.293 0zM9.5 3.5v-2l3 3h-2a1 1 0 0 1-1-1zM5.884 6.68 8 9.219l2.116-2.54a.5.5 0 1 1 .768.641L8.651 10l2.233 2.68a.5.5 0 0 1-.768.64L8 10.781l-2.116 2.54a.5.5 0 0 1-.768-.641L7.349 10 5.116 7.32a.5.5 0 1 1 .768-.64z" />
                                    </svg>
                                </button>
                                <button
                                    onClick={handleExportPDF}
                                    className="p-2 hover:bg-gray-100 rounded-full transition-colors group"
                                    title="Export to PDF"
                                >
                                    <svg className="w-8 h-8 text-red-600 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M20 2H8c-1.1 0-2 .9-2 2v12H4v5c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5v1.5H19v2h-1.5V7h2V8.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z" />
                                    </svg>
                                </button>
                            </div>
                        )}
                    </ReadOnlyWrapper>

                    {/* Save Button */}
                    {/* Save Button Removed - Using Global Action Bar */}
                </div>
            </div>

            {/* Desktop Table View */}
            <ReadOnlyWrapper allowedRoles={['Admin', 'Teacher']}>
                <div className="hidden lg:block bg-white p-6 rounded-xl shadow-md border border-gray-200">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50 border-b">
                                    <th className="p-4 font-semibold text-gray-600">#</th>
                                    <th className="p-4 font-semibold text-gray-600">Class Name</th>
                                    <th className="p-4 font-semibold text-gray-600">Teacher Name</th>
                                    <th className="p-4 font-semibold text-gray-600">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredClasses.length > 0 ? (
                                    filteredClasses.map((cls, index) => {
                                        const isDirtyRow = isItemDirty('classes', cls.id);
                                        return (
                                            <tr key={cls.id} className={`border-b transition-colors ${isDirtyRow ? `${DIRTY_INDICATOR_BG} ${DIRTY_INDICATOR_TEXT} ${DIRTY_INDICATOR_HOVER_BG}` : 'hover:bg-gray-50'}`}>
                                                <td className="p-4 relative">
                                                    {index + 1}
                                                    {isDirtyRow && (
                                                        <span className="absolute left-0 top-0 text-[10px] font-bold uppercase tracking-wider px-1 py-0.5 bg-yellow-400 text-black leading-none rounded-br z-10">
                                                            Unsaved
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-4 font-medium">{cls.name}</td>
                                                <td className={`p-4 ${isDirtyRow ? DIRTY_INDICATOR_SECONDARY_TEXT : 'text-gray-900'}`}>{cls.teacherName}</td>
                                                <td className="p-4 space-x-4 flex items-center">
                                                    {canEditClass(cls) && (
                                                        <button onClick={() => handleEdit(cls)} className={`${isDirtyRow ? `${DIRTY_INDICATOR_SECONDARY_TEXT} hover:text-white` : 'text-blue-600 hover:text-blue-800'}`} title="Edit">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>
                                                        </button>
                                                    )}
                                                    {isAdmin && (
                                                        <button onClick={() => handleDeleteClick(cls.id)} className={`${isDirtyRow ? 'text-white hover:text-gray-200 opacity-90' : 'text-red-600 hover:text-red-800'}`} title="Delete">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="text-center p-8 text-gray-500">
                                            No data found matching your search.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden space-y-4">
                    {filteredClasses.length > 0 ? (
                        filteredClasses.map((cls, index) => {
                            const isDirtyRow = isItemDirty('classes', cls.id);
                            return (
                                <div key={cls.id} className={`p-4 rounded-xl shadow-md border transition-colors flex justify-between items-center relative ${isDirtyRow ? `${DIRTY_INDICATOR_BG} ${DIRTY_INDICATOR_BORDER} ${DIRTY_INDICATOR_TEXT}` : 'bg-white border-gray-200'}`}>
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
                                            <p className="font-bold">{cls.teacherName}</p>
                                            <p className={`text-sm ${isDirtyRow ? DIRTY_INDICATOR_SECONDARY_TEXT : 'text-gray-600'}`}>Class Teacher for: {cls.name}</p>
                                        </div>
                                    </div>
                                    <div className="flex space-x-2 flex-shrink-0">
                                        {canEditClass(cls) && (
                                            <button onClick={() => handleEdit(cls)} className={`${isDirtyRow ? `${DIRTY_INDICATOR_SECONDARY_TEXT} hover:text-white` : 'text-blue-600 hover:bg-blue-100'} p-2 rounded-full`} title="Edit">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>
                                            </button>
                                        )}
                                        {isAdmin && (
                                            <button onClick={() => handleDeleteClick(cls.id)} className={`${isDirtyRow ? 'text-white hover:bg-black/20' : 'text-red-600 hover:bg-red-100'} p-2 rounded-full`} title="Delete">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center p-8 text-gray-500 bg-white rounded-xl shadow-md border border-gray-200">
                            No data found matching your search.
                        </div>
                    )}
                </div>
            </ReadOnlyWrapper>

            {isModalOpen && currentClassData && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-2 sm:p-4">
                    <div className="bg-white p-3 sm:p-5 rounded-xl shadow-2xl w-full max-w-lg relative animate-fade-in-scale overflow-y-auto max-h-[98vh] sm:max-h-[95vh]">

                        <div className="flex items-center justify-between mb-3 border-b pb-2">
                            <h2 className="text-lg sm:text-xl font-bold text-gray-800">{'id' in currentClassData ? 'Edit Teacher/Class' : 'Add New Teacher/Class'}</h2>
                            
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
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-tight mb-1">Class Name</label>
                                    <div className="relative">
                                        <input
                                            ref={firstInputRef}
                                            type="text"
                                            name="name"
                                            value={currentClassData.name}
                                            onChange={handleChange}
                                            required
                                            className={`${inputStyles} py-1.5 text-sm`}
                                            disabled={!isAdmin && 'id' in currentClassData}
                                            placeholder="e.g. Class 1"
                                        />
                                        
                                        {/* Session List Dropdown */}
                                        {isSessionListOpen && sessionAddedIds.length > 0 && (
                                            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-100 p-2 max-h-40 overflow-y-auto animate-fade-in-down ring-1 ring-black/5">
                                                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 px-1 flex justify-between">
                                                    <span>Session History</span>
                                                    <span>({sessionAddedIds.length})</span>
                                                </div>
                                                <div className="space-y-1">
                                                    {sessionAddedIds.map(id => {
                                                        const cls = classes.find(item => item.id === id);
                                                        const isDirty = isItemDirty('classes', id);
                                                        return (
                                                            <div key={id} className="flex items-center justify-between px-2 py-1.5 bg-gray-50 rounded text-xs">
                                                                <span className="truncate flex-1 text-gray-700 font-medium">{cls?.name || 'Unknown'}</span>
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
                                    {!isAdmin && 'id' in currentClassData && (
                                        <p className="text-[9px] text-gray-500 mt-0.5 uppercase font-bold">Fixed class assignment.</p>
                                    )}
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-tight mb-1">Teacher's Name</label>
                                    <input type="text" name="teacherName" value={currentClassData.teacherName} onChange={handleChange} required className={`${inputStyles} py-1.5 text-sm`} placeholder="e.g. John Doe" />
                                </div>
                            </div>

                            <div className="bg-gray-50 p-2 sm:p-3 rounded-lg border border-gray-100">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-tight mb-2">Teacher's Signature</label>
                                <div className="flex items-center space-x-3 sm:space-x-4">
                                    <div className="relative group flex-shrink-0">
                                        <img src={currentClassData.teacherSignature || SIGNATURE_PLACEHOLDER} alt="Signature Preview" className="h-10 w-28 sm:h-12 sm:w-36 object-contain border p-1 rounded-md bg-white shadow-sm" />
                                        {isEnhancing && (
                                            <div className="absolute inset-0 bg-black/10 rounded-md flex items-center justify-center">
                                                <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent animate-spin rounded-full"></div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <div className="flex flex-wrap gap-2">
                                            <input
                                                type="file"
                                                id="signature-upload"
                                                accept="image/*"
                                                onChange={handleFileChange}
                                                className="hidden"
                                            />
                                            <label htmlFor="signature-upload" className="cursor-pointer text-[10px] bg-white border border-gray-300 px-2.5 py-1.5 rounded-full font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
                                                Upload
                                            </label>
                                            <CameraCapture onCapture={handleCameraCapture} />
                                            {currentClassData.teacherSignature && (
                                                <button type="button" onClick={handleClearImage} className="text-red-500 text-[10px] font-bold hover:underline px-1">
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                        {AI_FEATURES_ENABLED && currentClassData.teacherSignature && (
                                            <button type="button" onClick={handleEnhanceImage} disabled={isEnhancing} className="flex items-center text-[10px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full font-bold hover:bg-indigo-100 disabled:opacity-50 transition-colors border border-indigo-100">
                                                {isEnhancing ? 'Enhancing...' : '✨ Enhance'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {modalError && <p className="text-red-500 text-[10px] mt-0.5 font-bold animate-pulse">{modalError}</p>}

                            <div className="flex justify-end pt-2 space-x-2 border-t mt-2">
                                <button type="button" onClick={handleCloseModal} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors">Close</button>
                                <button type="submit" className="px-5 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-sm transition-all active:scale-95">Commit</button>
                            </div>

                        </form>
                    </div>
                </div>
            )}
            <ConfirmationModal
                isOpen={isConfirmOpen}
                message="Are you sure you want to delete this entry? Its records will be hidden."
                onConfirm={handleConfirmDelete}
                onClose={() => {
                    setIsConfirmOpen(false);
                    setItemIdToDelete(null);
                }}
                title="Delete Teacher/Class"
            />

            <RestoreModal
                isOpen={isRestoreModalOpen}
                onClose={() => setIsRestoreModalOpen(false)}
                title="Restore Deleted Classes"
                items={deletedClasses}
                onRestore={(id) => restoreItem('classes', id)}
                onDeletePermanently={handlePermanentDeleteClick}
                itemNameKey="name"
            />

            <ConfirmationModal
                isOpen={isPermanentConfirmOpen}
                message={
                    <>
                        Are you sure you want to <span className="font-bold text-red-600 underline">permanently delete</span> this class? 
                        <br /><br />
                        This action <span className="font-bold">cannot be undone</span> and all related records (including student enrollments in this class) will be completely removed from the system.
                    </>
                }
                onConfirm={handleConfirmPermanentDelete}
                onClose={() => {
                    setIsPermanentConfirmOpen(false);
                    setIdToPermanentlyDelete(null);
                }}
                title="Permanent Deletion"
                variant="danger"
                confirmText="Yes, Delete Permanently"
            />
        </div>
    );
};
export default Teachers;