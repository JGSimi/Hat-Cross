import type { ReactNode } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, Check, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToastStore, type ToastType } from '../../stores/toastStore';
import HorseLogo from './HorseLogo';

/** Glyph for each non-`credit` variant. `credit` renders HorseLogo
 * celebrating instead (see `renderIcon`). */
const iconFor: Record<Exclude<ToastType, 'credit'>, ReactNode> = {
  success: <Check size={14} />,
  error: <AlertCircle size={14} />,
  warn: <AlertTriangle size={14} />,
  info: <Info size={14} />,
};

interface Palette {
  bg: string;
  border: string;
  icon: string;
  shadow?: string;
}

const palette: Record<ToastType, Palette> = {
  info: {
    bg: 'color-mix(in srgb, var(--color-accent) 8%, var(--bg-secondary))',
    border: 'color-mix(in srgb, var(--color-accent) 20%, transparent)',
    icon: 'var(--color-accent)',
  },
  success: {
    bg: 'color-mix(in srgb, var(--success) 10%, var(--bg-secondary))',
    border: 'color-mix(in srgb, var(--success) 25%, transparent)',
    icon: 'var(--success)',
  },
  warn: {
    bg: 'color-mix(in srgb, var(--warning, #f59e0b) 10%, var(--bg-secondary))',
    border: 'color-mix(in srgb, var(--warning, #f59e0b) 30%, transparent)',
    icon: 'var(--warning, #f59e0b)',
  },
  error: {
    bg: 'color-mix(in srgb, var(--error) 10%, var(--bg-secondary))',
    border: 'color-mix(in srgb, var(--error) 30%, transparent)',
    icon: 'var(--error)',
  },
  credit: {
    bg: 'color-mix(in srgb, var(--color-accent) 14%, var(--bg-secondary))',
    border: 'color-mix(in srgb, var(--color-accent) 35%, transparent)',
    icon: 'var(--color-accent)',
    shadow: '0 0 22px color-mix(in srgb, var(--color-accent) 30%, transparent)',
  },
};

/** A11y role + politeness per variant. Error/warn interrupt; the rest are polite. */
function ariaFor(type: ToastType): { role: 'status' | 'alert'; live: 'polite' | 'assertive' } {
  return type === 'error' || type === 'warn'
    ? { role: 'alert', live: 'assertive' }
    : { role: 'status', live: 'polite' };
}

function renderIcon(type: ToastType): ReactNode {
  if (type === 'credit') {
    return <HorseLogo state="celebrating" size={22} />;
  }
  return iconFor[type];
}

export default function ToastContainer() {
  const { t } = useTranslation('toasts');
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismissToast);
  const reduced = useReducedMotion();

  return (
    <div
      role="region"
      aria-label={t('region', { defaultValue: 'Notificações' })}
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence>
        {toasts.map((toast) => {
          const colors = palette[toast.type];
          const { role, live } = ariaFor(toast.type);
          const shakeOnMount =
            !reduced && toast.type === 'error'
              ? { x: [0, -4, 4, -3, 3, 0] }
              : undefined;
          const pulseGlow =
            !reduced && toast.type === 'credit'
              ? {
                  boxShadow: [
                    '0 4px 16px rgba(0,0,0,0.2)',
                    colors.shadow || '0 4px 16px rgba(0,0,0,0.2)',
                    '0 4px 16px rgba(0,0,0,0.2)',
                  ],
                }
              : undefined;

          return (
            <motion.div
              key={toast.id}
              role={role}
              aria-live={live}
              aria-atomic="true"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                ...(shakeOnMount ?? {}),
                ...(pulseGlow ?? {}),
              }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{
                default: { type: 'spring', stiffness: 400, damping: 28 },
                x: { duration: 0.35 },
                boxShadow: { duration: 1.2, repeat: 1 },
              }}
              style={{
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: toast.type === 'error' ? '12px 14px' : '10px 14px',
                borderRadius: 10,
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                maxWidth: 340,
                minWidth: 200,
              }}
            >
              <span
                style={{
                  color: colors.icon,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {renderIcon(toast.type)}
              </span>
              <span
                style={{
                  flex: 1,
                  fontSize: toast.type === 'error' ? 12.5 : 12,
                  fontWeight: toast.type === 'error' ? 500 : 400,
                  color: 'var(--text-primary)',
                  lineHeight: 1.4,
                }}
              >
                {toast.message}
              </span>
              {toast.action && (
                <button
                  type="button"
                  onClick={() => {
                    toast.action!.onClick();
                    dismiss(toast.id);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-accent)',
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: 4,
                    flexShrink: 0,
                  }}
                >
                  {toast.action.label}
                </button>
              )}
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label={t('dismiss', { defaultValue: 'Fechar notificação' })}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: 2,
                  display: 'flex',
                  flexShrink: 0,
                }}
              >
                <X size={12} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
