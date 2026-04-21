import { Palette, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import SettingsCard from './SettingsCard';
import ThemePicker from '../ThemePicker';
import { Section } from './primitives';
import { useSettingsStore } from '../../../stores/settingsStore';
import { useCreditsStore } from '../../../stores/creditsStore';
import { THEME_PRESETS } from '../../../types';
import { formatCredits, getProgressToNext } from '../../../utils/themeUnlocks';

export default function AppearanceCard() {
  const { settings, setTheme } = useSettingsStore();
  const unlocked = useCreditsStore((s) => s.unlockedThemes);
  const creditsSpent = useCreditsStore((s) => s.creditsSpent);
  const active = THEME_PRESETS.find((t) => t.name === settings.theme) ?? THEME_PRESETS[0];
  const total = THEME_PRESETS.length;
  const progress = getProgressToNext(creditsSpent, unlocked);

  return (
    <SettingsCard
      title="Aparência"
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
              Tema atual
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
        title="Temas"
        meta={
          progress ? (
            `${unlocked.size}/${total} · próximo em ${formatCredits(progress.remaining)}`
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-accent)' }}>
              <Sparkles size={10} />
              {unlocked.size}/{total} · coleção completa
            </span>
          )
        }
      >
        <ThemePicker current={settings.theme} onChange={setTheme} />
      </Section>
    </SettingsCard>
  );
}
