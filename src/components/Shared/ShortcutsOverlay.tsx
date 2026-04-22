import { useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, Keyboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePlatform } from '../../hooks/usePlatform';
import { useSettingsStore } from '../../stores/settingsStore';
import { formatShortcut } from '../../utils/formatShortcut';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface ShortcutRow {
  /** Raw accelerator, formatted via formatShortcut per platform. */
  keys: string;
  /** i18n key under `chat.shortcutsOverlay.labels`. */
  labelKey: string;
}

interface ShortcutSection {
  /** i18n key under `chat.shortcutsOverlay.sections`. */
  titleKey: string;
  rows: ShortcutRow[];
}

/**
 * Keyboard-shortcuts reference overlay, triggered by `?` anywhere in the
 * main window (hooked at MainLayout level). Addresses heuristic M5:
 * clipboard shortcuts (j/k/Enter/Space/⌘C/⇧C/p/⌘F/⌘⇧⌫) had zero
 * discoverability, and Rafa in interview context can't afford to Alt-Tab
 * out of a stealth flow just to recall a binding.
 *
 * Deliberately not a command palette or slash-menu — those are generic
 * AI-wrapper moves. This is a static reference card: the shortcuts are
 * fixed, the user just needs to remember them. Raycast-style with a
 * Hat accent, not a Raycast clone.
 */
export default function ShortcutsOverlay({ open, onClose }: Props) {
  const { t } = useTranslation('chat');
  const platform = usePlatform();
  const shortcuts = useSettingsStore((s) => s.settings.shortcuts);
  const reduced = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Focus the close button on mount so Esc / Enter feel predictable
    // and the overlay has a well-known focus anchor for screen readers.
    closeRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const sections: ShortcutSection[] = [
    {
      titleKey: 'global',
      rows: [
        { keys: shortcuts.floatingChat, labelKey: 'floatingChat' },
        { keys: shortcuts.clipboard, labelKey: 'clipboard' },
        { keys: shortcuts.adjustFlashPosition, labelKey: 'adjustFlash' },
        { keys: shortcuts.emergencyQuit, labelKey: 'emergencyQuit' },
      ],
    },
    {
      titleKey: 'chat',
      rows: [
        { keys: 'Enter', labelKey: 'send' },
        { keys: 'Shift+Enter', labelKey: 'newline' },
        { keys: 'CommandOrControl+F', labelKey: 'searchInChat' },
      ],
    },
    {
      titleKey: 'clipboardView',
      rows: [
        { keys: 'J', labelKey: 'navigateDown' },
        { keys: 'K', labelKey: 'navigateUp' },
        { keys: 'Enter', labelKey: 'openEntry' },
        { keys: 'Space', labelKey: 'previewEntry' },
        { keys: 'CommandOrControl+C', labelKey: 'copyResponse' },
        { keys: 'Shift+C', labelKey: 'copyOriginal' },
        { keys: 'P', labelKey: 'togglePin' },
        { keys: 'CommandOrControl+F', labelKey: 'searchClipboard' },
      ],
    },
    {
      titleKey: 'popover',
      rows: [
        { keys: 'Enter', labelKey: 'popoverReveal' },
        { keys: 'Escape', labelKey: 'popoverDisguise' },
      ],
    },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="shortcuts-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={reduced ? { duration: 0 } : { duration: 0.18 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            background: 'color-mix(in srgb, #000 60%, transparent)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <motion.div
            key="shortcuts-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-title"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
            transition={
              reduced
                ? { duration: 0 }
                : { type: 'spring', stiffness: 420, damping: 34 }
            }
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 520,
              maxHeight: '85vh',
              overflowY: 'auto',
              background: 'var(--bg-primary)',
              borderRadius: 14,
              border: '0.5px solid var(--border-subtle)',
              boxShadow:
                '0 24px 60px rgba(0,0,0,0.45), 0 0 0 1px color-mix(in srgb, var(--color-accent) 10%, transparent) inset',
              padding: 20,
              color: 'var(--text-primary)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <div
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <span
                  aria-hidden
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
                    color: 'var(--color-accent)',
                  }}
                >
                  <Keyboard size={14} strokeWidth={1.8} />
                </span>
                <h2
                  id="shortcuts-title"
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: -0.2,
                    margin: 0,
                  }}
                >
                  {t('shortcutsOverlay.title', { defaultValue: 'Atalhos' })}
                </h2>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label={t('shortcutsOverlay.close', { defaultValue: 'Fechar' })}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <X size={14} />
              </button>
            </div>

            <p
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                margin: '0 0 18px',
                lineHeight: 1.5,
              }}
            >
              {t('shortcutsOverlay.subtitle', {
                defaultValue:
                  'Atalhos ativos no Hat. Esc fecha esse painel.',
              })}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {sections.map((section) => (
                <section key={section.titleKey}>
                  <h3
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: 0.8,
                      color: 'var(--text-muted)',
                      margin: '0 0 8px',
                    }}
                  >
                    {t(`shortcutsOverlay.sections.${section.titleKey}`)}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {section.rows.map((row) => (
                      <div
                        key={`${section.titleKey}-${row.labelKey}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 10px',
                          borderRadius: 7,
                          background:
                            'color-mix(in srgb, var(--text-muted) 4%, transparent)',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12.5,
                            color: 'var(--text-primary)',
                            fontWeight: 500,
                          }}
                        >
                          {t(`shortcutsOverlay.labels.${row.labelKey}`)}
                        </span>
                        <kbd
                          style={{
                            fontFamily:
                              "'JetBrains Mono', ui-monospace, monospace",
                            fontSize: 10.5,
                            color: 'var(--text-secondary)',
                            padding: '3px 7px',
                            borderRadius: 5,
                            background: 'var(--surface-tertiary, rgba(255,255,255,0.04))',
                            border:
                              '0.5px solid color-mix(in srgb, var(--border-subtle) 200%, transparent)',
                            fontWeight: 600,
                            letterSpacing: 0.2,
                          }}
                        >
                          {formatShortcut(row.keys, platform)}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <div
              style={{
                marginTop: 16,
                paddingTop: 14,
                borderTop: '0.5px solid var(--border-subtle)',
                fontSize: 11,
                color: 'var(--text-muted)',
                textAlign: 'center',
              }}
            >
              {t('shortcutsOverlay.footer', {
                defaultValue: 'Aperta ? a qualquer momento pra reabrir.',
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
