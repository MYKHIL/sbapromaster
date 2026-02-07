import React, { useState, useMemo } from 'react';
import { User } from '../../types';
import { useData } from '../../context/DataContext';

interface UserSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSend: (selectedUserIds: number[], message: string, viaWhatsApp: boolean) => void;
    defaultMessage: string;
    contextTitle?: string;
    users?: User[];
}

const UserSelectionModal: React.FC<UserSelectionModalProps> = ({ isOpen, onClose, onSend, defaultMessage, contextTitle, users }) => {
    const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
    const [message, setMessage] = useState(defaultMessage);
    const [roleFilter, setRoleFilter] = useState<'All' | 'Teacher' | 'Admin' | 'Related'>('Related');

    // Rich Text Helpers
    const insertFormat = (format: string) => {
        const textarea = document.getElementById('message-textarea') as HTMLTextAreaElement;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const before = text.substring(0, start);
        const selection = text.substring(start, end);
        const after = text.substring(end);

        let newText = '';
        let newCursorPos = 0;

        if (format === 'bold') {
            newText = `${before}**${selection}**${after}`;
            newCursorPos = end + 4; // Move after closing **
        } else if (format === 'italic') {
            newText = `${before}*${selection}*${after}`;
            newCursorPos = end + 2;
        } else if (format === 'list') {
            newText = `${before}\n- ${selection}${after}`;
            newCursorPos = end + 3;
        }

        setMessage(newText);
        // Need to defer focus/selection set
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    };

    const filteredUsers = useMemo(() => {
        if (!users) return [];
        return users.filter(u => {
            if (roleFilter === 'All') return true;
            if (roleFilter === 'Related') {
                return contextTitle && u.allowedClasses && u.allowedClasses.includes(contextTitle);
            }
            return u.role === roleFilter;
        });
    }, [users, roleFilter, contextTitle]);

    // Initial Selection of Related Users
    React.useEffect(() => {
        if (users && contextTitle && selectedUserIds.length === 0) {
            const relatedIds = users
                .filter(u => u.allowedClasses && u.allowedClasses.includes(contextTitle))
                .map(u => u.id);
            if (relatedIds.length > 0) {
                setSelectedUserIds(relatedIds);
            }
        }
    }, [users, contextTitle]);

    const handleToggleUser = (id: number) => {
        setSelectedUserIds(prev =>
            prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]
        );
    };

    const handleSelectAll = () => {
        if (selectedUserIds.length === filteredUsers.length) {
            setSelectedUserIds([]);
        } else {
            setSelectedUserIds(filteredUsers.map(u => u.id));
        }
    };

    const handleSendSystem = () => {
        onSend(selectedUserIds, message, false);
        onClose();
    };

    const handleSendWhatsApp = () => {
        onSend(selectedUserIds, message, true);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-gray-800">Notify Users {contextTitle && `- ${contextTitle}`}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                    {/* Message Editor */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-medium text-gray-700">Message</label>
                            <div className="flex gap-1">
                                <button onClick={() => insertFormat('bold')} className="p-1 hover:bg-gray-200 rounded text-gray-600 font-bold px-2 text-xs" title="Bold (Ctrl+B)">B</button>
                                <button onClick={() => insertFormat('italic')} className="p-1 hover:bg-gray-200 rounded text-gray-600 italic px-2 text-xs" title="Italic (Ctrl+I)">I</button>
                                <button onClick={() => insertFormat('list')} className="p-1 hover:bg-gray-200 rounded text-gray-600 px-2 text-xs" title="List">• List</button>
                            </div>
                        </div>
                        <textarea
                            id="message-textarea"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.ctrlKey || e.metaKey) {
                                    if (e.key === 'b') { e.preventDefault(); insertFormat('bold'); }
                                    if (e.key === 'i') { e.preventDefault(); insertFormat('italic'); }
                                }
                            }}
                            className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px] font-mono"
                            placeholder="Type a message... Use **bold** or *italic*"
                        />
                    </div>

                    {/* Recipient Selection */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-medium text-gray-700">Recipients</label>
                            <div className="flex bg-gray-100 rounded-lg p-0.5">
                                {(['Related', 'All', 'Teacher', 'Admin'] as const).map(role => (
                                    <button
                                        key={role}
                                        onClick={() => setRoleFilter(role as any)}
                                        className={`text-xs px-2 py-1 rounded-md transition-all ${roleFilter === role ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        {role}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                            {filteredUsers.length === 0 ? (
                                <p className="text-center text-gray-400 text-sm py-4">No users found.</p>
                            ) : (
                                <div className="space-y-1">
                                    <div className="flex items-center px-2 py-1 border-b border-gray-100 pb-2 mb-1">
                                        <input
                                            type="checkbox"
                                            checked={selectedUserIds.length === filteredUsers.length && filteredUsers.length > 0}
                                            onChange={handleSelectAll}
                                            className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 mr-3"
                                        />
                                        <span className="text-xs font-semibold text-gray-500 uppercase">Select All</span>
                                    </div>
                                    {filteredUsers.map(user => (
                                        <label key={user.id} className="flex items-center px-2 py-1.5 hover:bg-white rounded cursor-pointer transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={selectedUserIds.includes(user.id)}
                                                onChange={() => handleToggleUser(user.id)}
                                                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 mr-3"
                                            />
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-gray-800">{user.name}</p>
                                                <p className="text-xs text-gray-500">{user.role} • {user.allowedClasses.slice(0, 2).join(', ')}{user.allowedClasses.length > 2 ? '...' : ''}</p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1 text-right">{selectedUserIds.length} selected</p>
                    </div>
                </div>

                <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors text-sm font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSendWhatsApp}
                        disabled={selectedUserIds.length === 0}
                        className="flex items-center gap-2 px-4 py-2 text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.232-.298.347-.497.115-.198.058-.372-.029-.545-.087-.174-.794-1.914-1.088-2.623-.287-.691-.578-.6-.794-.611-.202-.009-.433-.013-.664-.013-.231 0-.606.088-.923.432-.317.343-1.21 1.183-1.21 2.89 0 1.708 1.243 3.36 1.416 3.585.174.224 2.446 3.737 5.925 5.241.828.358 1.474.572 1.977.731.839.266 1.603.229 2.213.138.679-.1 1.758-.718 2.006-1.412.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                        </svg>
                        WhatsApp
                    </button>
                    <button
                        onClick={handleSendSystem}
                        disabled={selectedUserIds.length === 0}
                        className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 shadow-sm rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Send Notification
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UserSelectionModal;
