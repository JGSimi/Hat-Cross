import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import HorseLogo from './HorseLogo';
import RecentConversations from '../Chat/RecentConversations';
import { getGreeting } from '../../utils/markdown';
import { usePlatform } from '../../hooks/usePlatform';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAuthStore } from '../../stores/authStore';
import { formatShortcut } from '../../utils/formatShortcut';

interface EmptyStateProps {
  /** When true (popover / any narrow embedding), renders only the
   * mascot + greeting. Suggestion grid + shortcut badges are dropped
   * because they overflow the 380×480 popover and look broken. */
  compact?: boolean;
}

export default function EmptyState({ compact = false }: EmptyStateProps = {}) {
  // `i18n.language` acesso só pra re-renderizar quando o idioma mudar
  // (getGreeting é função pura que lê i18n.t, mas React não sabe disso).
  const { t, i18n } = useTranslation('chat');
  void i18n.language;
  const greeting = getGreeting();
  const platform = usePlatform();
  const shortcutSettings = useSettingsStore((s) => s.settings.shortcuts);
  // First name from Firebase displayName personalises the subtitle when
  // available ("Joao Simi" → "Joao"). Falls back to neutral copy when the
  // user is signed out or displayName is missing.
  const firstName = useAuthStore((s) => {
    const name = s.user?.displayName?.trim();
    if (!name) return null;
    return name.split(/\s+/)[0];
  });
  const subtitle = firstName
    ? t('empty.subtitleNamed', { name: firstName })
    : t('empty.subtitle');

  const shortcuts = [
    { keys: formatShortcut(shortcutSettings.clipboard, platform), label: t('shortcuts.clipboard') },
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
        {subtitle}
      </motion.p>

      {/* Recents + shortcut badges only in full (main-window) mode. The
          popover is 380×480 and stealth-focused — no room, no business.
          Suggestion cards are gone per user feedback (too generic,
          layout was overflowing the viewport and pushing the input
          off-screen). */}
      {!compact && (
        <>
          {/* Returning-user surface. Renders null when conversations=0
              so first-time users don't see an empty "Recentes" block. */}
          <div style={{ width: '100%', marginBottom: 20 }}>
            <RecentConversations />
          </div>

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
                  fontFamily: '"SFMono-Regular", "SF Mono", Consolas, "Liberation Mono", monospace',
                  fontSize: 10, color: 'var(--text-muted)', fontWeight: 500,
                }}>
                  {sc.keys}
                </kbd>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sc.label}</span>
              </motion.div>
            ))}
          </div>
        </>
      )}

    </div>
  );
}
