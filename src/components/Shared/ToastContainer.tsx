import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, AlertTriangle, Info } from 'lucide-react';
import { useToastStore, type ToastType } from '../../stores/toastStore';

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <Check size={14} />,
  error: <AlertTriangle size={14} />,
  info: <Info size={14} />,
};

const colorMap: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: {
    bg: 'color-mix(in srgb, var(--success) 10%, var(--bg-secondary))',
    border: 'color-mix(in srgb, var(--success) 25%, transparent)',
    icon: 'var(--success)',
  },
  error: {
    bg: 'color-mix(in srgb, var(--error) 10%, var(--bg-secondary))',
    border: 'color-mix(in srgb, var(--error) 25%, transparent)',
    icon: 'var(--error)',
  },
  info: {
    bg: 'color-mix(in srgb, var(--color-accent) 8%, var(--bg-secondary))',
    border: 'color-mix(in srgb, var(--color-accent) 20%, transparent)',
    icon: 'var(--color-accent)',
  },
};

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismissToast);

  return (
    <div
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
          const colors = colorMap[toast.type];
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              style={{
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 10,
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                maxWidth: 320,
                minWidth: 200,
              }}
            >
              <span style={{ color: colors.icon, flexShrink: 0, display: 'flex' }}>
                {iconMap[toast.type]}
              </span>
              <span style={{
                flex: 1,
                fontSize: 12,
                color: 'var(--text-primary)',
                lineHeight: 1.4,
              }}>
                {toast.message}
              </span>
              {toast.action && (
                <button
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
                onClick={() => dismiss(toast.id)}
                aria-label="Fechar notificacao"
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
