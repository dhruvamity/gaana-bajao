import React, { useState, useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { onFirestoreWriteError } from '../services/firebase';

interface ToastItem {
  id: string;
  message: string;
}

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const unsubscribe = onFirestoreWriteError((message) => {
      const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      setToasts(prev => [...prev.slice(-4), { id, message }]);

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 5000);
    });

    return unsubscribe;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-28 md:bottom-24 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-start gap-3 p-3.5 bg-surface-container-high border border-outline-variant/30 rounded-xl shadow-2xl text-on-surface text-xs font-medium animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <AlertCircle size={16} className="text-error flex-shrink-0 mt-0.5" />
          <span className="flex-1 leading-relaxed text-white/90">{toast.message}</span>
          <button
            onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
            className="text-on-surface-variant hover:text-white transition-colors p-0.5"
            aria-label="Dismiss error notification"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
