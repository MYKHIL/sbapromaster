import React, { useMemo } from 'react';
import { useUser } from '../../context/UserContext';
import { useData } from '../../context/DataContext';

interface RestoreModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    items: any[];
    onRestore: (id: number) => void;
    onDeletePermanently?: (id: number) => void;
    itemNameKey: string;
}

const RestoreModal: React.FC<RestoreModalProps> = ({ isOpen, onClose, title, items, onRestore, onDeletePermanently, itemNameKey }) => {
    const { currentUser } = useUser();
    const { users } = useData();

    // Filter items based on permissions
    const visibleItems = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.role === 'Admin') return items;
        return items.filter(item => item.deletedBy === currentUser.id);
    }, [items, currentUser]);

    const getDeleterName = (userId: number) => {
        return users?.find(u => u.id === userId)?.name || 'Unknown User';
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="bg-gradient-to-r from-red-600 to-red-800 px-6 py-4 flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-xl text-white">{title}</h3>
                        <p className="text-red-100 text-xs mt-0.5 font-medium uppercase tracking-wider">{visibleItems.length} Items found</p>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="text-white/80 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-2 rounded-full"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-0 overflow-y-auto flex-1 custom-scrollbar">
                    {visibleItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                            <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <p className="text-lg font-medium">No deleted items available to restore.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Item Name</th>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Deleted By</th>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Date Deleted</th>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {visibleItems.map(item => (
                                    <tr key={item.id} className="hover:bg-red-50/30 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-800">
                                            {item[itemNameKey]}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {getDeleterName(item.deletedBy)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {item.deletedAt ? new Date(item.deletedAt).toLocaleString('en-US', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                                hour: 'numeric',
                                                minute: '2-digit',
                                                hour12: true
                                            }) : 'Unknown'}
                                        </td>
                                         <td className="px-6 py-4 whitespace-nowrap text-right flex justify-end gap-2">
                                            {onDeletePermanently && currentUser?.role === 'Admin' && (
                                                <button
                                                    onClick={() => onDeletePermanently(item.id)}
                                                    className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 font-bold text-xs rounded-lg transition-colors border border-red-200"
                                                    title="Permanently remove this item"
                                                >
                                                    Delete Permanently
                                                </button>
                                            )}
                                            <button
                                                onClick={() => onRestore(item.id)}
                                                className="px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 font-bold text-xs rounded-lg transition-colors border border-green-200"
                                            >
                                                Restore
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-white text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-all text-sm font-bold shadow-sm active:scale-95"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RestoreModal;
