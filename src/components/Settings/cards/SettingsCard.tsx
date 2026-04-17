import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

interface Props {
  title: string;
  icon: React.ReactNode;
  preview: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export default function SettingsCard({
  title,
  icon,
  preview,
  defaultOpen = false,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <motion.div
      layout
      className="glass-card"
      style={{
        borderRadius: 12,
        overflow: 'hidden',
        alignSelf: 'start',
      }}
    >
      <motion.button
        layout
        type="button"
        onClick={() => setOpen((v) => !v)}
        whileHover={{ backgroundColor: 'var(--surface-hover)' }}
        transition={{ backgroundColor: { duration: 0.15 } }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-primary)',
          textAlign: 'left',
        }}
        aria-expanded={open}
      >
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 26 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            color: 'var(--text-muted)',
          }}
        >
          <ChevronRight size={14} strokeWidth={2.2} />
        </motion.span>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            color: open ? 'var(--color-accent)' : 'var(--text-secondary)',
            transition: 'color 0.15s ease',
          }}
        >
          {icon}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: -0.1,
            color: 'var(--text-primary)',
            flex: 1,
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontSize: 10.5,
            color: 'var(--text-muted)',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '50%',
          }}
        >
          {preview}
        </span>
      </motion.button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { type: 'spring', stiffness: 300, damping: 30 },
              opacity: { duration: 0.18 },
            }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                padding: '4px 16px 16px',
                borderTop: '0.5px solid var(--glass-border-subtle)',
                paddingTop: 12,
              }}
            >
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
