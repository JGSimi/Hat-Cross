import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import ChatWindow from '../Chat/ChatWindow';

interface PopoverChatProps {
  onBack?: () => void;
}

export default function PopoverChat({ onBack }: PopoverChatProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
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
      {/* Drag region + back to clock */}
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
          onClick={onBack}
          aria-label="Voltar ao relógio"
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
        <ChatWindow />
      </div>
    </motion.div>
  );
}
