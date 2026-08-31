import React, { useState, useEffect } from 'react';
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { onFirestoreWriteError } from '../services/firebase';

export type ToastType = 'info' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

type ToastListener = (toast: ToastItem) => void;
const _toastListeners = new Set<ToastListener>();

/**
 * Dispatch an autonomous UI toast notification.
 */
export function showToast(message: string, type: ToastType = 'info'): void {
  const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const item: ToastItem = { id, message, type };
  _toastListeners.forEach(fn => fn(item));
}

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    // Listen for manual toasts
    const handleToast: ToastListener = (toast) => {
      setToasts(prev => [...prev.slice(-4), toast]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, 5000);
    };
    _toastListeners.add(handleToast);

    // Listen for Firestore sync failures
    const unsubscribe = onFirestoreWriteError((message) => {
      showToast(message, 'error');
    });

    return () => {
      _toastListeners.delete(handleToast);
      unsubscribe();
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-28 md:bottom-24 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-start gap-3 p-3.5 bg-surface-container-high border border-outline-variant/30 rounded-xl shadow-2xl text-on-surface text-xs font-medium animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          {toast.type === 'error' && <AlertCircle size={16} className="text-error flex-shrink-0 mt-0.5" />}
          {toast.type === 'warning' && <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />}
          {toast.type === 'info' && <Info size={16} className="text-primary flex-shrink-0 mt-0.5" />}
          <span className="flex-1 leading-relaxed text-white/90">{toast.message}</span>
          <button
            onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
            className="text-on-surface-variant hover:text-white transition-colors p-0.5"
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
