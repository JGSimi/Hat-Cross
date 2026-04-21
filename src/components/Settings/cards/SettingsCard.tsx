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
    <motion.div layout className={`settings-card ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="settings-card__header"
        aria-expanded={open}
      >
        <span className="settings-card__chevron">
          <ChevronRight size={14} strokeWidth={2.2} />
        </span>
        <span className="settings-card__icon">{icon}</span>
        <span className="settings-card__title">{title}</span>
        <span className="settings-card__preview">{preview}</span>
      </button>

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
            <div className="settings-card__body">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
