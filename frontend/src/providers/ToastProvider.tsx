import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

type Toast = {
  id: number;
  title: string;
  description?: string;
  type?: 'success' | 'error' | 'info';
};

type ToastContextValue = {
  notify: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let toastId = 0;

export const ToastProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((toast: Omit<Toast, 'id'>) => {
    toastId += 1;
    const id = toastId;
    setToasts((current) => [...current, { id, ...toast }]);
    setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const value = useMemo(() => ({ notify, dismiss }), [notify, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="fixed inset-x-0 top-0 z-50 flex flex-col gap-3 p-4 md:items-end">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-soft transition md:w-96 ${
                toast.type === 'success'
                  ? 'border-emerald-200'
                  : toast.type === 'error'
                  ? 'border-red-200'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-900">{toast.title}</p>
                  {toast.description ? (
                    <p className="mt-1 text-sm text-slate-500">{toast.description}</p>
                  ) : null}
                </div>
                <button
                  onClick={() => dismiss(toast.id)}
                  className="rounded-full p-1 text-slate-400 hover:text-slate-600"
                  aria-label="Dismiss notification"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};
