import { motion } from 'framer-motion';
import HorseLogo from './HorseLogo';
import { getGreeting } from '../../utils/markdown';
import { usePlatform } from '../../hooks/usePlatform';
import { useSettingsStore } from '../../stores/settingsStore';
import { formatShortcut } from '../../utils/formatShortcut';

interface Props {
  onSuggestionClick?: (text: string) => void;
}

const suggestions = [
  'Resuma este texto para mim',
  'Traduza para inglês',
  'Explique esse conceito',
  'Corrija este código',
];

export default function EmptyState({ onSuggestionClick }: Props) {
  const greeting = getGreeting();
  const platform = usePlatform();
  const shortcutSettings = useSettingsStore((s) => s.settings.shortcuts);

  const shortcuts = [
    { keys: formatShortcut(shortcutSettings.clipboard, platform), label: 'Clipboard' },
    { keys: formatShortcut(shortcutSettings.screenCapture, platform), label: 'Tela' },
  ];

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
        <HorseLogo size={64} animated />
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

      {/* Suggestion chips */}
      {onSuggestionClick && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, type: 'spring', stiffness: 300, damping: 25 }}
          style={{
            display: 'flex', flexWrap: 'wrap', gap: 6,
            justifyContent: 'center', marginTop: 20, maxWidth: 340,
          }}
        >
          {suggestions.map((s) => (
            <motion.button
              key={s}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSuggestionClick(s)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 11,
                background: 'color-mix(in srgb, var(--color-accent) 8%, transparent)',
                color: 'var(--text-secondary)',
                border: '1px solid color-mix(in srgb, var(--color-accent) 15%, transparent)',
                cursor: 'pointer',
              }}
            >
              {s}
            </motion.button>
          ))}
        </motion.div>
      )}
    </div>
  );
}
