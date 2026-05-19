import { useState } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { ArrowLeft, Palette, Zap, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import WindowControls from '../Shared/WindowControls';
import { usePlatform } from '../../hooks/usePlatform';
import { startWindowDrag } from '../../utils/windowDrag';
import AccountHeader from './AccountHeader';
import GeneralCard from './cards/GeneralCard';
import AppearanceCard from './cards/AppearanceCard';
import AICard from './cards/AICard';
import ClipboardCard from './cards/ClipboardCard';
import FlashCard from './cards/FlashCard';
import PopoverCard from './cards/PopoverCard';
import NotificationsCard from './cards/NotificationsCard';

interface Props {
  onClose: () => void;
}

type SectionId = 'appearance' | 'flow' | 'stealth';

/**
 * Settings navigation is a horizontal tabstrip with three canonical groups
 * (decision #6 in the UX strategy memo): Appearance & Themes · Flow &
 * Shortcuts · Stealth. The previous grid of 7 cards offered no hierarchy,
 * buried the stealth pillar, and made Luiza / Kat scan the whole panel to
 * find a single toggle.
 *
 * Each tab hosts a filtered set of the existing cards; no card content was
 * rewritten here — only moved. The tab state is session-local (resets on
 * each open) by design: the settings panel is short-lived.
 */
const SECTION_CONTENT: Record<SectionId, React.FC> = {
  appearance: () => (
    <div className="settings-grid">
      <AppearanceCard />
    </div>
  ),
  flow: () => (
    <div className="settings-grid">
      <GeneralCard />
      <AICard />
      <NotificationsCard />
    </div>
  ),
  stealth: () => (
    <div className="settings-grid">
      <PopoverCard />
      <FlashCard />
      <ClipboardCard />
    </div>
  ),
};

const SECTION_ICON: Record<SectionId, typeof Palette> = {
  appearance: Palette,
  flow: Zap,
  stealth: EyeOff,
};

const SECTIONS: readonly SectionId[] = ['appearance', 'flow', 'stealth'];

export default function SettingsPanel({ onClose }: Props) {
  const platform = usePlatform();
  const { t } = useTranslation('settings');
  const [activeSection, setActiveSection] = useState<SectionId>('appearance');
  const Content = SECTION_CONTENT[activeSection];

  return (
    <motion.div
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-primary)',
      }}
      className="bg-atmosphere"
    >
      {/* Header — drag region for custom titlebar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          borderBottom: '0.5px solid var(--border-subtle)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <motion.button
          data-no-drag
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClose}
          aria-label={t('panel.close')}
          style={{
            padding: 6,
            borderRadius: 6,
            color: 'var(--text-secondary)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ArrowLeft size={16} />
        </motion.button>
        <h2
          className="window-drag-region"
          data-tauri-drag-region
          onPointerDown={startWindowDrag}
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0,
            flex: 1,
          }}
        >
          {t('panel.title')}
        </h2>
        {platform !== 'macos' && <WindowControls variant="header" />}
      </div>

      {/* Content column: AccountHeader + section tabs + active section cards */}
      <div
        className="settings-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <AccountHeader />
        </div>

        <LayoutGroup id="settings-section-tabs">
          <div
            role="tablist"
            aria-label={t('sections.nav', { defaultValue: 'Seções' })}
            style={{
              display: 'flex',
              gap: 6,
              padding: 4,
              borderRadius: 12,
              background: 'color-mix(in srgb, var(--text-muted) 6%, transparent)',
              border: '0.5px solid var(--border-subtle)',
              marginBottom: 16,
            }}
          >
            {SECTIONS.map((id) => {
              const Icon = SECTION_ICON[id];
              const active = activeSection === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`settings-section-${id}`}
                  id={`settings-tab-${id}`}
                  onClick={() => setActiveSection(id)}
                  style={{
                    position: 'relative',
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'transparent',
                    color: active
                      ? 'var(--text-primary)'
                      : 'var(--text-muted)',
                    fontSize: 12.5,
                    fontWeight: active ? 600 : 500,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    zIndex: 1,
                    transition: 'color 0.15s ease',
                  }}
                >
                  {active && (
                    <motion.span
                      layoutId="settings-tab-pill"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: 8,
                        background: 'var(--surface-primary, var(--bg-secondary))',
                        border: '0.5px solid var(--border-subtle)',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                        zIndex: -1,
                      }}
                    />
                  )}
                  <Icon size={13} strokeWidth={1.85} aria-hidden />
                  <span>{t(`sections.${id}.title`)}</span>
                </button>
              );
            })}
          </div>
        </LayoutGroup>

        <div
          role="tabpanel"
          id={`settings-section-${activeSection}`}
          aria-labelledby={`settings-tab-${activeSection}`}
        >
          <motion.p
            key={`subtitle-${activeSection}`}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              margin: '0 4px 14px',
              lineHeight: 1.45,
            }}
          >
            {t(`sections.${activeSection}.subtitle`)}
          </motion.p>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <Content />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
