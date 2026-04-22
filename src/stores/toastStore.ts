import { create } from 'zustand';

/** Canonical toast taxonomy used by the UX MVP feedback system.
 *
 * - `info`     — neutral notice (modo leve ativado, tema salvo em rascunho)
 * - `success`  — action landed (copiado, chave salva)
 * - `warn`     — advisory (contexto perto do limite, cooldown)
 * - `error`    — action failed (permissão negada, provedor caiu)
 * - `credit`   — celebration (tier destravada, créditos adicionados);
 *                rendered with HorseLogo celebrating instead of a glyph.
 */
export type ToastType = 'info' | 'success' | 'warn' | 'error' | 'credit';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  action?: ToastAction;
}

export interface ToastOptions {
  duration?: number;
  action?: ToastAction;
}

/** Default auto-dismiss per variant. Error / warn linger; info / success
 * stay short; credit sits in the middle to give the glow a beat. */
const DEFAULT_DURATION: Record<ToastType, number> = {
  info: 3000,
  success: 3000,
  warn: 5000,
  error: 6000,
  credit: 4500,
};

interface ToastState {
  toasts: Toast[];
  showToast: (
    message: string,
    type?: ToastType,
    options?: ToastOptions,
  ) => void;
  dismissToast: (id: string) => void;
}

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],

  showToast: (message, type = 'info', options) => {
    const id = crypto.randomUUID();
    const duration = options?.duration ?? DEFAULT_DURATION[type];
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
