import { motion } from 'framer-motion';
import { GraduationCap, Sparkles } from 'lucide-react';
import { getGreeting } from '../../utils/markdown';

const shortcuts = [
  { keys: '⌘⇧X', label: 'Clipboard' },
  { keys: '⌘⇧Z', label: 'Tela' },
];

export default function EmptyState() {
  const greeting = getGreeting();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '0 32px',
      }}
    >
      {/* Floating hat icon */}
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'relative', marginBottom: 20 }}
      >
        {/* Glow ring */}
        <motion.div
          animate={{ opacity: [0.15, 0.35, 0.15] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            inset: -8,
            borderRadius: '50%',
            background: 'var(--color-accent)',
            filter: 'blur(16px)',
          }}
        />
        {/* Icon circle */}
        <div
          style={{
            position: 'relative',
            width: 52,
            height: 52,
            borderRadius: 16,
            background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 50%, #000))',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)',
          }}
        >
          <GraduationCap size={26} color="white" strokeWidth={2} />
        </div>
        {/* Sparkle accent */}
        <motion.div
          animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            top: -4,
            right: -6,
          }}
        >
          <Sparkles size={14} color="var(--color-accent)" strokeWidth={2.5} />
        </motion.div>
      </motion.div>

      {/* Title */}
      <h2
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.95)',
          margin: '0 0 6px 0',
          letterSpacing: -0.5,
        }}
      >
        {greeting}
      </h2>

      {/* Subtitle */}
      <p
        style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          margin: '0 0 24px 0',
        }}
      >
        Como posso ajudar?
      </p>

      {/* Shortcut badges */}
      <div style={{ display: 'flex', gap: 8 }}>
        {shortcuts.map((sc, i) => (
          <motion.div
            key={sc.keys}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.1, type: 'spring', stiffness: 400, damping: 25 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: '5px 10px',
            }}
          >
            <kbd
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                fontSize: 10,
                color: 'var(--text-muted)',
                fontWeight: 500,
              }}
            >
              {sc.keys}
            </kbd>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {sc.label}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
