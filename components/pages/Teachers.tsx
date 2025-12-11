import React, { useState, useMemo } from 'react';
import CameraCapture from '../CameraCapture';
import { useData } from '../../context/DataContext';
import SaveButton from '../SaveButton';
import type { Class } from '../../types';
import ConfirmationModal from '../ConfirmationModal';
import { enhanceImage } from '../../services/geminiService';
import { AI_FEATURES_ENABLED } from '../../constants';
import ReadOnlyWrapper from '../ReadOnlyWrapper';
import { useUser } from '../../context/UserContext';
import { compressImage } from '../../utils/imageUtils';

const EMPTY_TEACHER_FORM: Omit<Class, 'id'> = {
    name: '',
    teacherName: '',
    teacherSignature: '',
};

const SIGNATURE_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTUwIDUwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGQ9Ik0yIDI1LjVDMiAyNS41IDE1LjUgMTUuNSAyOS41IDI4QzQzLjUgNDAuNSA1MyAyNS41IDY2LjUgMjAuNUM4MCAxNS41IDg4LjUgMjkgMTAwIDI5QzExMS41IDI5IDEyMyAxNS41IDEzNyAyOS41IiBzdHJva2U9IiM5Y2EzYWYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PC9zdmc+';

const Teachers: React.FC = () => {
    const { classes, addClass, updateClass, deleteClass, saveClasses, isDirty, isSyncing, isOnline } = useData();
    const { currentUser } = useUser();
    const isAdmin = currentUser?.role === 'Admin';
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentClassData, setCurrentClassData] = useState<Class | Omit<Class, 'id'> | null>(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [itemIdToDelete, setItemIdToDelete] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isEnhancing, setIsEnhancing] = useState(false);

    const inputStyles = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500";
    const searchInputStyles = "w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

    const filteredClasses = useMemo(() => {
        const query = searchQuery.toLowerCase();
        let result = classes;

        // Filter by search query
        if (query) {
            result = result.filter(cls =>
                cls.name.toLowerCase().includes(query) ||
                cls.teacherName.toLowerCase().includes(query)
            );
        }

        return result;
    }, [classes, searchQuery]);

    // Check if current user can edit a specific class
    const canEditClass = (cls: Class) => {
        if (isAdmin) return true;
        if (!currentUser) return false;
        return currentUser.allowedClasses?.includes(cls.name);
    };

    const handleAddNew = () => {
        setCurrentClassData(EMPTY_TEACHER_FORM);
        setIsModalOpen(true);
    };

    const handleEdit = (cls: Class) => {
        if (canEditClass(cls)) {
            setCurrentClassData(cls);
            setIsModalOpen(true);
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

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentClassData(null);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setCurrentClassData(prev => prev ? { ...prev, [name]: value } : null);
    };



    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const raw = event.target?.result as string;
                try {
                    const compressed = await compressImage(raw);
                    setCurrentClassData(prev => prev ? { ...prev, teacherSignature: compressed } : null);
                } catch {
                    setCurrentClassData(prev => prev ? { ...prev, teacherSignature: raw } : null);
                }
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const handleCameraCapture = async (imageData: string) => {
        try {
            const compressed = await compressImage(imageData);
            setCurrentClassData(prev => prev ? { ...prev, teacherSignature: compressed } : null);
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

        if ('id' in currentClassData) {
            updateClass(currentClassData);
        } else {
            addClass(currentClassData);
        }
        handleCloseModal();
    };

    return (
        <ReadOnlyWrapper allowedRoles={['Admin', 'Teacher']}>
            <div className="space-y-6">
                <h1 className="text-3xl font-bold text-gray-800">Manage Teachers &amp; Classes</h1>

                <div className="bg-gray-100 py-4">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
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
                        {isAdmin && (
                            <button onClick={handleAddNew} className="add-button flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition-colors w-full md:w-auto justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                                Add New Teacher/Class
                            </button>
                        )}

                        {/* Save Button */}
                        {(isAdmin || currentUser?.role === 'Teacher') && (
                            <div className="w-full md:w-auto">
                                <SaveButton
                                    onClick={saveClasses}
                                    isDirty={isDirty('classes')}
                                    isSyncing={isSyncing}
                                    isOnline={isOnline}
                                    label="Save Changes"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Desktop Table View */}
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
                                    filteredClasses.map((cls, index) => (
                                        <tr key={cls.id} className="border-b hover:bg-gray-50">
                                            <td className="p-4 text-gray-600 font-semibold">{index + 1}</td>
                                            <td className="p-4 font-medium text-gray-900">{cls.name}</td>
                                            <td className="p-4 text-gray-900">{cls.teacherName}</td>
                                            <td className="p-4 space-x-4 flex items-center">
                                                {canEditClass(cls) && (
                                                    <button onClick={() => handleEdit(cls)} className="text-blue-600 hover:text-blue-800" title="Edit">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>
                                                    </button>
                                                )}
                                                {isAdmin && (
                                                    <button onClick={() => handleDeleteClick(cls.id)} className="text-red-600 hover:text-red-800" title="Delete">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
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
                        filteredClasses.map((cls, index) => (
                            <div key={cls.id} className="bg-white p-4 rounded-xl shadow-md border border-gray-200 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                        <span className="text-blue-700 font-bold text-sm">{index + 1}</span>
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800">{cls.teacherName}</p>
                                        <p className="text-sm text-gray-600">Class Teacher for: {cls.name}</p>
                                    </div>
                                </div>
                                <div className="flex space-x-2 flex-shrink-0">
                                    {canEditClass(cls) && (
                                        <button onClick={() => handleEdit(cls)} className="text-blue-600 p-2 rounded-full hover:bg-blue-100" title="Edit">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>
                                        </button>
                                    )}
                                    {isAdmin && (
                                        <button onClick={() => handleDeleteClick(cls.id)} className="text-red-600 p-2 rounded-full hover:bg-red-100" title="Delete">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center p-8 text-gray-500 bg-white rounded-xl shadow-md border border-gray-200">
                            No data found matching your search.
                        </div>
                    )}
                </div>

                {isModalOpen && currentClassData && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                        <div className="bg-white p-6 md:p-8 rounded-xl shadow-2xl w-full max-w-lg m-4">
                            <h2 className="text-2xl font-bold mb-6 text-gray-800">{'id' in currentClassData ? 'Edit Teacher/Class' : 'Add New Teacher/Class'}</h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Class Name</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={currentClassData.name}
                                        onChange={handleChange}
                                        required
                                        className={inputStyles}
                                        disabled={!isAdmin && 'id' in currentClassData} // Disable editing class name for non-admins if editing
                                    />
                                    {/* Clarification for teachers why this is disabled */}
                                    {!isAdmin && 'id' in currentClassData && (
                                        <p className="text-xs text-gray-500 mt-1">Class assignment cannot be changed.</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Teacher's Name</label>
                                    <input type="text" name="teacherName" value={currentClassData.teacherName} onChange={handleChange} required className={inputStyles} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Teacher's Signature</label>
                                    <div className="mt-1 flex items-center space-x-4">
                                        <img src={currentClassData.teacherSignature || SIGNATURE_PLACEHOLDER} alt="Signature Preview" className="h-12 w-36 object-contain border p-1 rounded-md bg-gray-50" />
                                        <div className="space-y-2 w-full">
                                            <input type="file" accept="image/*" onChange={handleFileChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                                            <CameraCapture onCapture={handleCameraCapture} label="Take Signature Photo" />
                                            {currentClassData.teacherSignature && (
                                                <button
                                                    type="button"
                                                    onClick={handleClearImage}
                                                    className="flex items-center px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors text-sm font-medium w-full justify-center"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                    Clear Signature
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {AI_FEATURES_ENABLED && (
                                        <div className="mt-2">
                                            <button
                                                type="button"
                                                onClick={handleEnhanceImage}
                                                disabled={!currentClassData.teacherSignature || isEnhancing}
                                                className="flex items-center text-sm bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full font-semibold hover:bg-indigo-200 disabled:bg-gray-200 disabled:text-gray-500 transition-colors"
                                            >
                                                {isEnhancing ? (
                                                    <>
                                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        Enhancing...
                                                    </>
                                                ) : '✨ Enhance Image'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="flex justify-end pt-4 space-x-2">
                                    <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                <ConfirmationModal
                    isOpen={isConfirmOpen}
                    onClose={() => setIsConfirmOpen(false)}
                    onConfirm={handleConfirmDelete}
                    title="Delete Teacher/Class"
                    message="Are you sure you want to delete this entry? This action cannot be undone."
                />
            </div>
        </ReadOnlyWrapper>
    );
};

export default Teachers;