import { motion } from 'framer-motion';
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
        padding: '0 24px',
      }}
    >
      {/* Floating hat container */}
      <motion.div
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'relative', marginBottom: 16 }}
      >
        {/* Glow ring */}
        <motion.div
          animate={{ opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            inset: -4,
            borderRadius: '50%',
            background: 'var(--color-accent)',
            filter: 'blur(12px)',
          }}
        />
        {/* Hat icon circle */}
        <div
          style={{
            position: 'relative',
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'var(--glass-secondary)',
            border: '0.5px solid var(--glass-border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            // accent overlay
            backgroundImage: 'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 15%, transparent), transparent)',
          }}
        >
          🎩
        </div>
      </motion.div>

      {/* Title */}
      <h2
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--text-primary)',
          margin: '0 0 4px 0',
        }}
      >
        {greeting}
      </h2>

      {/* Subtitle */}
      <p
        style={{
          fontSize: 12.5,
          color: 'var(--text-muted)',
          margin: '0 0 20px 0',
        }}
      >
        Como posso ajudar?
      </p>

      {/* Shortcut badges */}
      <div style={{ display: 'flex', gap: 12 }}>
        {shortcuts.map((sc, i) => (
          <motion.div
            key={sc.keys}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, type: 'spring', stiffness: 400, damping: 25 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--glass-secondary)',
              border: '0.5px solid var(--border-subtle)',
              borderRadius: 7,
              padding: '5px 10px',
            }}
          >
            <kbd
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                fontSize: 9,
                color: 'var(--text-muted)',
              }}
            >
              {sc.keys}
            </kbd>
            <span
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
              }}
            >
              {sc.label}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
