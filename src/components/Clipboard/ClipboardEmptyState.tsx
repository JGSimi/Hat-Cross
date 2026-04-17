import { motion, useReducedMotion } from 'framer-motion';
import { Clipboard, SearchX, X, Sparkles } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { usePlatform } from '../../hooks/usePlatform';

function formatShortcut(shortcut: string, platform: string): string {
  if (platform === 'macos') {
    return shortcut
      .replace(/CommandOrControl\+/g, '⌘')
      .replace(/CmdOrCtrl\+/g, '⌘')
      .replace(/Shift\+/g, '⇧')
      .replace(/Alt\+/g, '⌥');
  }
  return shortcut
    .replace(/CommandOrControl\+/g, 'Ctrl+')
    .replace(/CmdOrCtrl\+/g, 'Ctrl+');
}

interface ZeroProps {
  onSuggestionClick?: () => void;
}

export function ClipboardZeroState({ onSuggestionClick }: ZeroProps) {
  const reduceMotion = useReducedMotion();
  const platform = usePlatform();
  const clipboardShortcut = useSettingsStore((s) => s.settings.shortcuts.clipboard);
  const formatted = formatShortcut(clipboardShortcut, platform);

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        textAlign: 'center',
      }}
    >
      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { scale: 0.8, opacity: 0 }}
        animate={reduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        style={{ position: 'relative', marginBottom: 24 }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: -14,
            borderRadius: 28,
            background:
              'radial-gradient(circle, color-mix(in srgb, var(--color-accent) 14%, transparent) 0%, transparent 70%)',
            animation: reduceMotion ? undefined : 'pulseGlow 3s ease-in-out infinite',
          }}
        />
        <div
          style={{
            position: 'relative',
            width: 72,
            height: 72,
            borderRadius: 20,
            background:
              'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 14%, transparent), color-mix(in srgb, var(--color-accent) 6%, transparent))',
            border: '0.5px solid color-mix(in srgb, var(--color-accent) 22%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 32px color-mix(in srgb, var(--color-accent) 18%, transparent)',
          }}
        >
          <Clipboard size={30} style={{ color: 'var(--color-accent)' }} />
        </div>
      </motion.div>

      <motion.h3
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 22 }}
        className="text-heading"
        style={{
          margin: '0 0 8px',
          color: 'var(--text-primary)',
          fontSize: 17,
        }}
      >
        Nenhum clipboard processado
      </motion.h3>

      <motion.p
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, type: 'spring', stiffness: 260, damping: 22 }}
        style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.55,
          color: 'var(--text-muted)',
          maxWidth: 300,
        }}
      >
        Copie um texto ou imagem e pressione{' '}
        <kbd
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 7px',
            margin: '0 2px',
            borderRadius: 5,
            background: 'var(--glass-secondary)',
            border: '0.5px solid var(--glass-border-subtle)',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-secondary)',
          }}
        >
          {formatted}
        </kbd>{' '}
        para processar com IA.
      </motion.p>

      {onSuggestionClick && (
        <motion.button
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26, type: 'spring', stiffness: 260, damping: 22 }}
          whileHover={reduceMotion ? undefined : { scale: 1.03 }}
          whileTap={reduceMotion ? undefined : { scale: 0.97 }}
          onClick={onSuggestionClick}
          style={{
            marginTop: 22,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '8px 14px',
            borderRadius: 8,
            background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
            color: 'var(--color-accent)',
            border: '0.5px solid color-mix(in srgb, var(--color-accent) 25%, transparent)',
            cursor: 'pointer',
            fontSize: 12.5,
            fontWeight: 500,
          }}
        >
          <Sparkles size={13} />
          Abrir Chat
        </motion.button>
      )}
    </div>
  );
}

interface NoResultsProps {
  query: string;
  onClearSearch: () => void;
}

export function ClipboardNoResultsState({ query, onClearSearch }: NoResultsProps) {
  const reduceMotion = useReducedMotion();
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        textAlign: 'center',
      }}
    >
      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: 'var(--glass-secondary)',
          border: '0.5px solid var(--glass-border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 18,
          color: 'var(--text-muted)',
        }}
      >
        <SearchX size={28} />
      </motion.div>
      <p
        className="text-subheading"
        style={{
          margin: 0,
          color: 'var(--text-secondary)',
          fontWeight: 600,
        }}
      >
        Nenhum resultado para “{query}”
      </p>
      <p
        style={{
          margin: '6px 0 18px',
          fontSize: 12.5,
          color: 'var(--text-muted)',
        }}
      >
        Tente buscar por outras palavras.
      </p>
      <motion.button
        whileHover={reduceMotion ? undefined : { scale: 1.03 }}
        whileTap={reduceMotion ? undefined : { scale: 0.97 }}
        onClick={onClearSearch}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 13px',
          borderRadius: 7,
          background: 'var(--glass-secondary)',
          color: 'var(--text-secondary)',
          border: '0.5px solid var(--glass-border-subtle)',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 500,
        }}
      >
        <X size={12} />
        Limpar busca
      </motion.button>
    </div>
  );
}
