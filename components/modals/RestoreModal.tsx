import React, { useEffect, useMemo, useState } from 'react';
import { useUser } from '../../context/UserContext';
import { useData } from '../../context/DataContext';
import { RotateCw, Undo2 } from "lucide-react";

interface RestoreModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    items: any[];
    onRestore: (ids: number[]) => void;
    onDeletePermanently?: (ids: number[]) => void;
    itemNameKey: string;
}

const RestoreModal: React.FC<RestoreModalProps> = ({ isOpen, onClose, title, items, onRestore, onDeletePermanently, itemNameKey }) => {
    const { currentUser } = useUser();
    const {
        users,
        undoPendingRestoreDeleteAction,
        redoPendingRestoreDeleteAction,
        canUndoPendingRestoreDeleteAction,
        canRedoPendingRestoreDeleteAction,
    } = useData();
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    // Filter items based on permissions
    const visibleItems = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.role === 'Admin') return items;
        return items.filter(item => item.deletedBy === currentUser.id);
    }, [items, currentUser]);

    useEffect(() => {
        if (!isOpen) {
            setSelectedIds([]);
            return;
        }

        if (visibleItems.length === 0) {
            setSelectedIds([]);
        }
    }, [isOpen, visibleItems.length]);

    const getDeleterName = (userId: number) => {
        return users?.find(u => u.id === userId)?.name || 'Unknown User';
    };

    const toggleSelection = (id: number) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]);
    };

    const handleSelectAll = () => {
        if (visibleItems.length === 0) return;
        const allVisibleIds = visibleItems.map(item => item.id);
        setSelectedIds(prev => prev.length === allVisibleIds.length && allVisibleIds.every(id => prev.includes(id)) ? [] : allVisibleIds);
    };

    const allVisibleSelected = visibleItems.length > 0 && visibleItems.every(item => selectedIds.includes(item.id));
    const hasSelection = selectedIds.length > 0;
    const showBulkActions = hasSelection && selectedIds.length > 1 && visibleItems.length > 0;
    const showIndividualActions = !showBulkActions;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="bg-gradient-to-r from-red-600 to-red-800 px-6 py-4 flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-xl text-white">{title}</h3>
                        <p className="text-red-100 text-xs mt-0.5 font-medium uppercase tracking-wider">{visibleItems.length} Items found</p>
                        {selectedIds.length > 0 && (
                            <p className="text-red-100 text-xs mt-1 font-semibold">{selectedIds.length} selected</p>
                        )}
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
                        <>
                            <div className="hidden md:block">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="px-4 py-3 w-12">
                                                <input
                                                    type="checkbox"
                                                    checked={allVisibleSelected}
                                                    onChange={handleSelectAll}
                                                    className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                                                    aria-label="Select all visible items"
                                                />
                                            </th>
                                            <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Item Name</th>
                                            <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Deleted By</th>
                                            <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Date Deleted</th>
                                            <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {visibleItems.map(item => {
                                            const isSelected = selectedIds.includes(item.id);
                                            return (
                                                <tr key={item.id} className="hover:bg-red-50/30 transition-colors group">
                                                    <td className="px-4 py-4">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleSelection(item.id)}
                                                            className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                                                            aria-label={`Select ${item[itemNameKey]}`}
                                                        />
                                                    </td>
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
                                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                                        {showIndividualActions ? (
                                                            <div className="flex justify-end gap-2">
                                                                {onDeletePermanently && currentUser?.role === 'Admin' && (
                                                                    <button
                                                                        onClick={() => onDeletePermanently([item.id])}
                                                                        className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 font-bold text-xs rounded-lg transition-colors border border-red-200"
                                                                        title="Permanently remove this item"
                                                                    >
                                                                        Delete Permanently
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => onRestore([item.id])}
                                                                    className="px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 font-bold text-xs rounded-lg transition-colors border border-green-200"
                                                                >
                                                                    Restore
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-gray-400">Bulk actions</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="block md:hidden p-3 space-y-3">
                                {visibleItems.map(item => {
                                    const isSelected = selectedIds.includes(item.id);
                                    return (
                                        <div key={item.id} className={`rounded-xl border p-3 shadow-sm transition-colors ${isSelected ? 'border-red-300 bg-red-50/50' : 'border-gray-200 bg-white'}`}>
                                            <div className="flex items-start gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelection(item.id)}
                                                    className="mt-1 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                                                    aria-label={`Select ${item[itemNameKey]}`}
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold text-gray-800 truncate">{item[itemNameKey]}</p>
                                                            <p className="text-xs text-gray-500 mt-0.5">Deleted by: {getDeleterName(item.deletedBy)}</p>
                                                            <p className="text-[11px] text-gray-400 mt-0.5">Date: {item.deletedAt ? new Date(item.deletedAt).toLocaleString('en-US', {
                                                                month: 'short',
                                                                day: 'numeric',
                                                                year: 'numeric',
                                                                hour: 'numeric',
                                                                minute: '2-digit',
                                                                hour12: true
                                                            }) : 'Unknown'}</p>
                                                        </div>
                                                        {showIndividualActions ? (
                                                            <div className="flex flex-col gap-1.5 shrink-0">
                                                                {onDeletePermanently && currentUser?.role === 'Admin' && (
                                                                    <button
                                                                        onClick={() => onDeletePermanently([item.id])}
                                                                        className="px-2.5 py-1 bg-red-50 text-red-700 hover:bg-red-100 font-semibold text-[11px] rounded-lg transition-colors border border-red-200"
                                                                    >
                                                                        Delete
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => onRestore([item.id])}
                                                                    className="px-2.5 py-1 bg-green-50 text-green-700 hover:bg-green-100 font-semibold text-[11px] rounded-lg transition-colors border border-green-200"
                                                                >
                                                                    Restore
                                                                </button>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                <div className="bg-gray-50 px-4 py-3 md:px-6 md:py-4 border-t border-gray-100 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                        {visibleItems.length > 0 && (
                            <button
                                onClick={handleSelectAll}
                                className="px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-colors font-semibold"
                            >
                                {allVisibleSelected ? 'Clear Selection' : 'Select All Visible'}
                            </button>
                        )}
                        {hasSelection && <span>{selectedIds.length} selected</span>}
                    </div>
                    <div className="flex flex-wrap gap-2">

{showBulkActions && onDeletePermanently && currentUser?.role === 'Admin' && (
                            <button
                                onClick={() => {
                                    if (selectedIds.length > 1) {
                                        setSelectedIds([]);
                                        onDeletePermanently(selectedIds);
                                    }
                                }}
                                className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all text-sm font-bold shadow-sm"
                            >
                                Delete Selected Permanently
                            </button>
                        )}
                        {showBulkActions && (
                            <button
                                onClick={() => {
                                    if (selectedIds.length > 1) {
                                        setSelectedIds([]);
                                        onRestore(selectedIds);
                                    }
                                }}
                                className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all text-sm font-bold shadow-sm"
                            >
                                Restore Selected
                            </button>
                        )}

                        <button
    onClick={() => undoPendingRestoreDeleteAction()}
    disabled={!canUndoPendingRestoreDeleteAction}
    className="
        group
        inline-flex items-center gap-2
        px-4 py-2.5
        rounded-xl
        bg-white
        border border-gray-200
        text-gray-700
        font-semibold
        shadow-sm
        transition-all duration-200
        hover:bg-amber-50
        hover:border-amber-300
        hover:text-amber-700
        hover:shadow-md
        active:scale-95
        focus:outline-none
        focus:ring-2
        focus:ring-amber-500/30
        disabled:opacity-50
        disabled:cursor-not-allowed
        disabled:hover:bg-white
        disabled:hover:border-gray-200
        disabled:hover:text-gray-700
        disabled:hover:shadow-sm
    "
>
    <Undo2
        size={18}
        className="transition-transform duration-300 group-hover:-translate-x-0.5"
    />
    <span>Undo</span>
</button>
                        <button
    onClick={() => redoPendingRestoreDeleteAction()}
    disabled={!canRedoPendingRestoreDeleteAction}
    className="
        group
        inline-flex items-center gap-2
        px-4 py-2.5
        rounded-xl
        bg-white
        border border-gray-200
        text-gray-700
        font-semibold
        shadow-sm
        transition-all duration-200
        hover:bg-blue-50
        hover:border-blue-300
        hover:text-blue-700
        hover:shadow-md
        active:scale-95
        focus:outline-none
        focus:ring-2
        focus:ring-blue-500/30
        disabled:opacity-50
        disabled:cursor-not-allowed
    "
>
    <RotateCw
        size={18}
        className="transition-transform duration-300 group-hover:rotate-180"
    />
    <span>Redo</span>
</button>
                        
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-white text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-all text-sm font-bold shadow-sm active:scale-95"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RestoreModal;
