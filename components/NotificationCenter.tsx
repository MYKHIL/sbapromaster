import React, { useState } from 'react';
import { Notification, Page } from '../types';
import { useClassStatistics } from '../hooks/useClassStatistics';

interface NotificationCenterProps {
    isOpen: boolean;
    onClose: () => void;
    notifications: Notification[];
    onMarkRead: (id: string) => void;
    onReply: (notificationId: string, message: string) => void;
    onNavigate: (page: Page) => void;
}

const NotificationItem: React.FC<{
    notification: Notification;
    onMarkRead: (id: string) => void;
    onReply: (id: string, message: string) => void;
    onNavigate: (page: Page) => void;
    onClose?: () => void;
}> = ({ notification, onMarkRead, onReply, onNavigate, onClose }) => {
    // If it has context, check for updates dynamically
    const contextClassId = notification.context?.classId;
    const { missingScores, missingRemarks } = useClassStatistics(notification.type === 'missing_data_alert' ? contextClassId : undefined);

    const [replyText, setReplyText] = useState('');
    const [isReplying, setIsReplying] = useState(false);

    // Dynamic Content Logic
    let displayMessage = notification.message;
    let isResolved = false;

    if (notification.type === 'missing_data_alert' && contextClassId) {
        const currentMissingCount = notification.context?.dataType === 'scores'
            ? missingScores.length
            : notification.context?.dataType === 'remarks'
                ? missingRemarks.length
                : (missingScores.length + missingRemarks.length);

        if (currentMissingCount === 0) {
            isResolved = true;
            displayMessage = "✅ Issues resolved. Great job!";
        } else {
            // Keep original message but maybe append status if we wanted dynamic updates in text.
            // For now, we will rely on the rendered message below.
            // Actually, for rich text rendering, we should probably stick to the static message 
            // OR wrap the dynamic part.
            // Let's use the static message as base for rich text.
        }
    }

    const handleSendReply = () => {
        if (!replyText.trim()) return;
        onReply(notification.id, replyText);
        setReplyText('');
        setIsReplying(false);
    };

    // Simple Markdown Renderer
    const renderMessage = (text: string) => {
        const lines = text.split('\n');
        return lines.map((line, idx) => {
            if (line.trim().startsWith('- ')) {
                const content = line.trim().substring(2);
                return <li key={idx} className="ml-4 list-disc">{formatInline(content)}</li>;
            }
            return <p key={idx} className="min-h-[1.2em]">{formatInline(line)}</p>;
        });
    };

    const formatInline = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i}>{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('*') && part.endsWith('*')) {
                return <em key={i}>{part.slice(1, -1)}</em>;
            }
            return part;
        });
    };

    return (
        <div className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${!notification.read ? 'bg-blue-50/50' : ''}`}>
            <div className="flex justify-between items-start gap-3">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${notification.type === 'missing_data_alert' ? 'bg-purple-100 text-purple-700' :
                            notification.type === 'feedback' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-700'
                            }`}>
                            {notification.type === 'missing_data_alert' ? 'Action' : notification.type === 'feedback' ? 'Reply' : 'System'}
                        </span>
                        <span className="text-xs text-gray-400">{new Date(notification.date).toLocaleString()}</span>
                        {isResolved && <span className="text-[10px] bg-green-100 text-green-700 px-2 rounded-full border border-green-200">Resolved</span>}
                    </div>

                    {notification.senderName && (
                        <p className="text-xs font-semibold text-gray-600 mb-1">From: {notification.senderName}</p>
                    )}

                    <div className="text-gray-800 text-sm whitespace-pre-wrap leading-relaxed">
                        {isResolved ? <span className="text-green-700 italic">✅ Issues resolved. Great job!</span> : renderMessage(displayMessage)}
                    </div>

                    {notification.replies && notification.replies.length > 0 && (
                        <div className="mt-2 pl-3 border-l-2 border-gray-200 space-y-2">
                            {notification.replies.map((r, idx) => (
                                <div key={idx} className="bg-gray-50 p-2 rounded text-xs">
                                    <span className="font-bold text-gray-700">{r.senderName}: </span>
                                    <span className="text-gray-600">{r.message}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center gap-3 mt-3">
                        {notification.link && !isResolved && (
                            <button
                                onClick={() => {
                                    onNavigate(notification.link as Page);
                                    // onClose?.(); // Optional: keep open
                                }}
                                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                            >
                                View Page
                            </button>
                        )}

                        {!isReplying && (
                            <button
                                onClick={() => setIsReplying(true)}
                                className="text-xs font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1"
                            >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                                Reply
                            </button>
                        )}

                        {!notification.read && (
                            <button onClick={() => onMarkRead(notification.id)} className="text-xs text-gray-400 hover:text-blue-500 ml-auto">
                                Mark as Read
                            </button>
                        )}
                    </div>

                    {isReplying && (
                        <div className="mt-2 flex gap-2">
                            <input
                                type="text"
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Type a reply..."
                                className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                            <button onClick={handleSendReply} className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700">Send</button>
                            <button onClick={() => setIsReplying(false)} className="px-2 py-1 text-gray-500 hover:bg-gray-100 rounded text-xs">Cancel</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose, notifications, onMarkRead, onReply, onNavigate }) => {
    const unreadCount = notifications.filter(n => !n.read).length;

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop for mobile to handle outside clicks better if needed */}
            <div className="fixed inset-0 z-[55] bg-black/10 backdrop-blur-[1px] md:hidden" onClick={onClose}></div>

            <div className="fixed left-4 right-4 md:left-auto md:right-auto md:w-96 
                            top-[8.5rem] md:top-20 
                            md:fixed md:left-1/2 md:-translate-x-1/2 md:transform
                            bg-white rounded-xl shadow-2xl border border-gray-200 z-[60] overflow-hidden flex flex-col max-h-[70vh] animate-in fade-in zoom-in-95 duration-200 origin-top">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        Notifications
                        {unreadCount > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>}
                    </h3>
                    <div className="flex gap-2">
                        {unreadCount > 0 && (
                            <button
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                onClick={() => notifications.forEach(n => !n.read && onMarkRead(n.id))}
                            >
                                Mark all read
                            </button>
                        )}
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 custom-scrollbar">
                    {notifications.length === 0 ? (
                        <div className="p-8 text-center">
                            <div className="bg-gray-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                                <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                            </div>
                            <p className="text-sm text-gray-500">No notifications yet</p>
                        </div>
                    ) : (
                        notifications.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(n => (
                            <NotificationItem
                                key={n.id}
                                notification={n}
                                onMarkRead={onMarkRead}
                                onReply={onReply}
                                onNavigate={onNavigate}
                                onClose={onClose}
                            />
                        ))
                    )}
                </div>
            </div>
        </>
    );
};

export default NotificationCenter;
