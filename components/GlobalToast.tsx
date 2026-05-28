import React, { useEffect, useState } from 'react';

type ToastType = 'success' | 'warning' | 'info';

const GlobalToast: React.FC = () => {
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    useEffect(() => {
        const handler = (e: CustomEvent) => {
            const detail = e.detail as { message: string; type?: ToastType };
            setToast({ message: detail.message, type: detail.type || 'info' });
            setTimeout(() => setToast(null), 3500);
        };

        window.addEventListener('sba-toast' as any, handler as any);
        return () => window.removeEventListener('sba-toast' as any, handler as any);
    }, []);

    if (!toast) return null;

    const bg = toast.type === 'success' ? 'bg-green-600' : toast.type === 'warning' ? 'bg-amber-500' : 'bg-blue-600';

    return (
        <div className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[100] px-4 py-2 rounded-lg shadow-lg text-white text-sm font-medium ${bg} animate-fade-in-up`}>
            {toast.message}
        </div>
    );
};

export default GlobalToast;
