import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  action?: { label: string; onClick: () => void };
}

interface ToastState {
  toasts: Toast[];
  showToast: (message: string, type?: ToastType, options?: {
    duration?: number;
    action?: { label: string; onClick: () => void };
  }) => void;
  dismissToast: (id: string) => void;
}

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],

  showToast: (message, type = 'info', options) => {
    const id = crypto.randomUUID();
    const duration = options?.duration ?? 3000;
    const toast: Toast = { id, message, type, duration, action: options?.action };

    set((state) => ({
      toasts: [...state.toasts.slice(-4), toast], // max 5 toasts
    }));

    // Auto-dismiss
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, duration);
  },

  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));
