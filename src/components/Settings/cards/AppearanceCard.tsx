import { lazy, Suspense } from 'react';
import { Palette, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import SettingsCard from './SettingsCard';
import { Section } from './primitives';
import { useSettingsStore } from '../../../stores/settingsStore';
import { useCreditsStore } from '../../../stores/creditsStore';
import { THEME_PRESETS } from '../../../types';
import { formatCredits, getProgressToNext } from '../../../utils/themeUnlocks';

const ThemePicker = lazy(() => import('../ThemePicker'));

export default function AppearanceCard() {
  const { settings, setTheme } = useSettingsStore();
  const unlocked = useCreditsStore((s) => s.unlockedThemes);
  const creditsSpent = useCreditsStore((s) => s.creditsSpent);
  const active = THEME_PRESETS.find((t) => t.name === settings.theme) ?? THEME_PRESETS[0];
  const total = THEME_PRESETS.length;
  const progress = getProgressToNext(creditsSpent, unlocked);
  const { t } = useTranslation('settings');

  return (
    <SettingsCard
      title={t('appearance.title')}
      icon={<Palette size={14} strokeWidth={2} />}
      preview={active.label}
    >
      {/* Current theme — living preview of the selected palette */}
      <motion.div
        layoutId="theme-current-preview"
        className="theme-current"
        style={{
          background: `linear-gradient(135deg, ${active.bgPrimary} 0%, ${active.bgSecondary} 100%)`,
          borderColor: `color-mix(in srgb, ${active.primary} 28%, var(--border-subtle))`,
          boxShadow: `0 6px 20px -10px color-mix(in srgb, ${active.primary} 45%, transparent)`,
        }}
      >
        <div className="theme-current__bar" aria-hidden>
          <i style={{ background: '#FF5F57' }} />
          <i style={{ background: '#FEBC2E' }} />
          <i style={{ background: '#28C840' }} />
        </div>
        <div className="theme-current__body">
          <div className="theme-current__meta">
            <div className="theme-current__label" style={{ color: active.textPrimary }}>
              {active.label}
            </div>
            <div className="theme-current__sub" style={{ color: active.textMuted }}>
              {t('appearance.currentTheme')}
            </div>
          </div>
          <div className="theme-current__palette">
            <motion.span
              layoutId="theme-current-accent"
              className="theme-current__chip"
              style={{
                background: active.primary,
                boxShadow: `0 0 12px color-mix(in srgb, ${active.primary} 55%, transparent)`,
              }}
            />
            <span
              className="theme-current__chip theme-current__chip--sm"
              style={{ background: active.hover }}
            />
            <span
              className="theme-current__chip theme-current__chip--sm"
              style={{ background: active.textSecondary, opacity: 0.8 }}
            />
          </div>
        </div>
      </motion.div>

      <Section
        title={t('appearance.themes')}
        meta={
          progress ? (
            t('appearance.themesMetaNext', {
              unlocked: unlocked.size,
              total,
              remaining: formatCredits(progress.remaining),
            })
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-accent)' }}>
              <Sparkles size={10} />
              {t('appearance.themesMetaComplete', { unlocked: unlocked.size, total })}
            </span>
          )
        }
      >
        <Suspense fallback={<div style={{ minHeight: 72 }} />}>
          <ThemePicker current={settings.theme} onChange={setTheme} />
        </Suspense>
      </Section>
    </SettingsCard>
  );
}
