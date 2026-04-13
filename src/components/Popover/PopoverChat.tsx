import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import ChatWindow from '../Chat/ChatWindow';
import { useSettingsStore } from '../../stores/settingsStore';

export default function PopoverChat() {
  const reducedMotion = useSettingsStore((s) => s.settings.performance.reducedMotion);

  const handleClose = () => {
    invoke('close_window', { label: 'popover' }).catch(() => {});
  };

  const animationProps = reducedMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, transition: { duration: 0.01 } }
    : { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 }, transition: { type: 'spring' as const, stiffness: 350, damping: 28 } };

  return (
    <motion.div
      {...animationProps}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: 'var(--bg-primary)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {/* Drag region + close */}
      <div
        data-tauri-drag-region
        style={{
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 6px',
          borderBottom: '0.5px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        <motion.button
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleClose}
          aria-label="Fechar"
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
          }}
        >
          <X size={12} />
        </motion.button>
      </div>

      {/* Chat content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <ChatWindow showScreenCapture={false} />
      </div>
    </motion.div>
  );
}
