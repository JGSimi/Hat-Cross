import { AnimatePresence, motion } from 'framer-motion';
import { X, FileText } from 'lucide-react';
import type { ChatAttachment } from '../../types';

interface Props {
  attachments: ChatAttachment[];
  onRemove: (id: string) => void;
}

export default function AttachmentPreview({ attachments, onRemove }: Props) {
  if (attachments.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        padding: '8px 4px',
        overflowX: 'auto',
      }}
    >
      <AnimatePresence>
        {attachments.map((att) => (
          <motion.div
            key={att.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="group"
            style={{
              position: 'relative',
              flexShrink: 0,
            }}
          >
            {att.isImage && att.data ? (
              <img
                src={`data:image/png;base64,${att.data}`}
                alt={att.name}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 6,
                  objectFit: 'cover',
                  border: '0.5px solid var(--glass-border-subtle)',
                }}
              />
            ) : (
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 6,
                  border: '0.5px solid var(--glass-border-subtle)',
                  background: 'var(--glass-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                }}
              >
                <FileText size={18} style={{ color: 'var(--text-muted)' }} />
              </div>
            )}
            <button
              onClick={() => onRemove(att.id)}
              className="group-hover:opacity-100"
              style={{
                position: 'absolute',
                top: -6,
                right: -6,
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: '#ef4444',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0,
                transition: 'opacity 0.15s ease',
              }}
            >
              <X size={10} color="white" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
