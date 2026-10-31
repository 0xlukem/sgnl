import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type?: ToastType;
  title: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}

interface ToastProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-16 right-4 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2.5 sm:bottom-18 sm:right-6"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const type = toast.type ?? 'info';
        const isSuccess = type === 'success';
        const isError = type === 'error';

        const borderColor = isSuccess
          ? 'border-emerald-500/40'
          : isError
          ? 'border-rose-500/40'
          : 'border-white/15';

        const iconColor = isSuccess
          ? 'text-emerald-400'
          : isError
          ? 'text-rose-400'
          : 'text-sky-400';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-[#090b10]/95 p-3.5 transition-colors duration-300 animate-in fade-in slide-in-from-bottom-2 ${borderColor}`}
            role="status"
            data-toast-type={type}
          >
            <div className={`mt-0.5 shrink-0 ${iconColor}`}>
              {isSuccess ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : isError ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <Info className="h-4 w-4" />
              )}
            </div>

            <div className="flex-1 space-y-0.5 min-w-0">
              <div className="font-mono text-sm font-bold text-white tracking-wide">
                {toast.title}
              </div>
              {toast.message && (
                <p className="font-tech text-base text-zinc-300 leading-relaxed break-words">
                  {toast.message}
                </p>
              )}
              {toast.action && (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.onClick();
                    onDismiss(toast.id);
                  }}
                  className="mt-1.5 inline-flex items-center rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 font-mono text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/25"
                >
                  {toast.action.label}
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="shrink-0 rounded-md p-1 text-zinc-400 hover:bg-white/10 hover:text-white transition"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
