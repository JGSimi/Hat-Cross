import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useCreditsStore } from '../../stores/creditsStore';
import {
  getProgressToNext,
  groupByTier,
} from '../../utils/themeUnlocks';
import { TIER_MILESTONES, type ThemeTier } from '../../types';

/**
 * Compact "next tier" teaser under the balance in AccountHeader.
 * Surfaces the tier that's currently in progress (next unlocked theme's
 * tier) so users see their gamification arc on every Settings open,
 * not only after scrolling deep into ThemePicker.
 *
 * Renders nothing when the user has unlocked every theme (no "100%
 * complete" badge — that cheapens the catalog). Uses the same
 * `getProgressToNext` helper the full ThemePicker ProgressBar uses,
 * but trims the presentation to a single-line strip with a 4px bar.
 */
export default function TierProgressionStrip() {
  const { t } = useTranslation('themes');
  const creditsSpent = useCreditsStore((s) => s.creditsSpent);
  const unlockedSet = useCreditsStore((s) => s.unlockedThemes);
  const reduced = useReducedMotion();

  const progress = useMemo(
    () => getProgressToNext(creditsSpent, unlockedSet),
    [creditsSpent, unlockedSet],
  );

  // Cache tier → glyph lookup so the strip knows which tier the next
  // theme belongs to.
  const tierByTheme = useMemo(() => {
    const map = new Map<string, ThemeTier>();
    for (const { tier, themes } of groupByTier()) {
      for (const theme of themes) map.set(theme.name, tier.tier);
    }
    return map;
  }, []);

  if (!progress) return null;

  const tier = tierByTheme.get(progress.next.name);
  const tierInfo = tier
    ? TIER_MILESTONES.find((m) => m.tier === tier)
    : null;
  const tierLabel = tierInfo
    ? t(`tiers.${tierInfo.tier}.label`, { defaultValue: tierInfo.label })
    : progress.next.label;
  const tierGlyph = tierInfo?.glyph ?? '✦';

  const pct = Math.round(progress.progress * 100);
  const remaining = progress.remaining.toLocaleString('pt-BR');

  return (
    <div
      role="group"
      aria-label={t('progress.stripLabel', {
        defaultValue: 'Progresso para o próximo tier',
      })}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '8px 10px',
        marginTop: 8,
        borderRadius: 8,
        background:
          'color-mix(in srgb, var(--color-accent) 7%, transparent)',
        border:
          '0.5px solid color-mix(in srgb, var(--color-accent) 22%, transparent)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          fontSize: 10.5,
          color: 'var(--text-muted)',
          fontWeight: 500,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            aria-hidden
            style={{
              fontSize: 11,
              color: 'var(--color-accent)',
              lineHeight: 1,
            }}
          >
            {tierGlyph}
          </span>
          <span>
            {t('progress.stripRemaining', {
              remaining,
              tier: tierLabel,
              defaultValue: `Faltam ${remaining} pra ${tierLabel}`,
            })}
          </span>
        </span>
        <span
          aria-hidden
          style={{
            color: 'var(--color-accent)',
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {pct}%
        </span>
      </div>
      <div
        aria-hidden
        style={{
          height: 3,
          borderRadius: 2,
          background:
            'color-mix(in srgb, var(--text-muted) 18%, transparent)',
          overflow: 'hidden',
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={
            reduced
              ? { duration: 0 }
              : { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
          }
          style={{
            height: '100%',
            background:
              'linear-gradient(90deg, var(--color-accent), var(--color-accent-hover, var(--color-accent)))',
            borderRadius: 2,
          }}
        />
      </div>
    </div>
  );
}
