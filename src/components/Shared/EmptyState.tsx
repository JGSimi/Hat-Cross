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
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', padding: '0 32px',
    }}>
      {/* Icon with dramatic entrance */}
      <motion.div
        initial={{ scale: 0.6, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.15 }}
        style={{ position: 'relative', marginBottom: 24 }}
      >
        {/* Ambient glow */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: [0, 0.25, 0.15], scale: [0.5, 1.2, 1] }}
          transition={{ duration: 2, ease: 'easeOut', delay: 0.2 }}
          style={{
            position: 'absolute', inset: -16, borderRadius: '50%',
            background: 'var(--color-accent)', filter: 'blur(24px)',
          }}
        />
        {/* Icon container */}
        <div style={{
          position: 'relative', width: 52, height: 52, borderRadius: 16,
          background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 50%, #000))',
          border: '1px solid var(--border-glass)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'var(--accent-shadow-lg)',
        }}>
          <GraduationCap size={26} color="white" strokeWidth={2} />
        </div>
        {/* Sparkle */}
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1, rotate: [0, 15, -15, 0] }}
          transition={{
            opacity: { delay: 0.5, duration: 0.3 },
            scale: { delay: 0.5, type: 'spring', stiffness: 300 },
            rotate: { delay: 0.8, duration: 4, repeat: Infinity, ease: 'easeInOut' },
          }}
          style={{ position: 'absolute', top: -4, right: -6 }}
        >
          <Sparkles size={14} color="var(--color-accent)" strokeWidth={2.5} />
        </motion.div>
      </motion.div>

      {/* Greeting */}
      <motion.h2
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.3 }}
        style={{
          fontSize: 22, fontWeight: 700, color: 'var(--text-bright)',
          margin: '0 0 6px 0', letterSpacing: -0.5,
        }}
      >
        {greeting}
      </motion.h2>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.4 }}
        style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 24px 0' }}
      >
        Como posso ajudar?
      </motion.p>

      {/* Shortcut badges */}
      <div style={{ display: 'flex', gap: 8 }}>
        {shortcuts.map((sc, i) => (
          <motion.div
            key={sc.keys}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + i * 0.12, type: 'spring', stiffness: 400, damping: 25 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--surface-tertiary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8, padding: '5px 10px',
            }}
          >
            <kbd style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10, color: 'var(--text-muted)', fontWeight: 500,
            }}>
              {sc.keys}
            </kbd>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sc.label}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
