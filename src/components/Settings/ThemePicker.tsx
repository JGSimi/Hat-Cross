import { MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Lock, Sparkles, Gem } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import {
  THEME_PRESETS,
  type AppTheme,
  type ThemePreset,
  type ThemeTierInfo,
} from '../../types';
import { useCreditsStore } from '../../stores/creditsStore';
import {
  groupByTier,
  getNextLocked,
  getProgressToNext,
  countUnlockedInTier,
  formatCredits,
} from '../../utils/themeUnlocks';
import { runThemeTransition } from '../../utils/themeTransition';

interface Props {
  current: AppTheme;
  onChange: (theme: AppTheme) => void;
}

// Evita View Transitions sobrepostas sem travar a navegação do picker.
const COOLDOWN_MS = 360;
const TEASER_LOCKED_COUNT = 3;

export default function ThemePicker({ current, onChange }: Props) {
  const { t } = useTranslation('themes');
  const [locked, setLocked] = useState(false);
  const timerRef = useRef<number | null>(null);
  const creditsSpent = useCreditsStore((s) => s.creditsSpent);
  const unlockedSet = useCreditsStore((s) => s.unlockedThemes);

  useEffect(() => () => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
  }, []);

  // Próximos 3 temas bloqueados em toda a progressão — estes aparecem
  // "com teaser" nos seus respectivos tiers. O resto fica oculto.
  const teaserLocked = useMemo(
    () => new Set(getNextLocked(unlockedSet, TEASER_LOCKED_COUNT).map((t) => t.name)),
    [unlockedSet],
  );

  const progress = useMemo(
    () => getProgressToNext(creditsSpent, unlockedSet),
    [creditsSpent, unlockedSet],
  );

  const groups = useMemo(() => groupByTier(), []);
  const exclusive = useMemo(
    () => THEME_PRESETS.find((t) => t.exclusive) ?? null,
    [],
  );

  const handleSelect = (event: MouseEvent<HTMLButtonElement>, name: AppTheme) => {
    if (locked || name === current) return;
    if (!unlockedSet.has(name)) return;

    setLocked(true);
    runThemeTransition(event, () => {
      document.documentElement.setAttribute('data-theme', name);
      onChange(name);
    });

    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setLocked(false);
      timerRef.current = null;
    }, COOLDOWN_MS);
  };

  return (
    <div className="theme-picker-v2">
      <ProgressBar creditsSpent={creditsSpent} progress={progress} />

      <div
        className={`theme-picker ${locked ? 'is-locked' : ''}`}
        role="radiogroup"
        aria-label={t('pickerAriaLabel', { defaultValue: 'Tema visual' })}
      >
        {groups.map(({ tier, themes }) => {
          // Tier exclusive é renderizado separado (destacado) no fim.
          if (tier.tier === 'exclusive') return null;

          const unlockedInTier = themes.filter((t) => unlockedSet.has(t.name));
          const lockedTeasersInTier = themes.filter(
            (t) => !unlockedSet.has(t.name) && teaserLocked.has(t.name),
          );
          const hiddenCount = themes.length - unlockedInTier.length - lockedTeasersInTier.length;
          const counts = countUnlockedInTier(tier.tier, unlockedSet);

          return (
            <TierSection
              key={tier.tier}
              tier={tier}
              counts={counts}
              unlockedInTier={unlockedInTier}
              lockedTeasers={lockedTeasersInTier}
              hiddenCount={hiddenCount}
              activeTheme={current}
              pickerLocked={locked}
              onSelect={handleSelect}
            />
          );
        })}

        {exclusive && (
          <ExclusiveCard
            theme={exclusive}
            unlocked={unlockedSet.has(exclusive.name)}
            active={current === exclusive.name}
            pickerLocked={locked}
            onSelect={handleSelect}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Progress bar global — mostra próximo milestone e quanto falta
// ============================================================================

function ProgressBar({
  creditsSpent,
  progress,
}: {
  creditsSpent: number;
  progress: ReturnType<typeof getProgressToNext>;
}) {
  const { t } = useTranslation('themes');
  if (!progress) {
    return (
      <div className="theme-progress theme-progress--complete">
        <Sparkles size={14} />
        <span>{t('progress.allUnlocked')}</span>
      </div>
    );
  }

  const { next, progress: pct, remaining } = progress;
  const gastosFmt = formatCredits(creditsSpent);
  const alvoFmt = formatCredits(next.unlockAt);
  const faltamFmt = formatCredits(remaining);

  return (
    <div className="theme-progress">
      <div className="theme-progress__header">
        <span className="theme-progress__label">
          <Trans
            t={t}
            i18nKey="progress.nextLabel"
            values={{ name: next.label }}
            components={{ strong: <strong /> }}
          />
        </span>
        <span className="theme-progress__meta">
          {t('progress.nextMeta', { spent: gastosFmt, target: alvoFmt, remaining: faltamFmt })}
        </span>
      </div>
      <div className="theme-progress__track">
        <motion.div
          className="theme-progress__fill"
          initial={{ width: 0 }}
          animate={{ width: `${pct * 100}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 22 }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Seção por tier — cabeçalho + grid de swatches (unlocked + teaser) + teaser
// ============================================================================

function TierSection({
  tier,
  counts,
  unlockedInTier,
  lockedTeasers,
  hiddenCount,
  activeTheme,
  pickerLocked,
  onSelect,
}: {
  tier: ThemeTierInfo;
  counts: { unlocked: number; total: number };
  unlockedInTier: ThemePreset[];
  lockedTeasers: ThemePreset[];
  hiddenCount: number;
  activeTheme: AppTheme;
  pickerLocked: boolean;
  onSelect: (event: MouseEvent<HTMLButtonElement>, name: AppTheme) => void;
}) {
  // Se tudo deste tier está escondido (nem unlocked nem teaser visível),
  // oculta a seção inteira pra não poluir. Só aparece quando o usuário se
  // aproxima.
  const { t } = useTranslation('themes');
  if (unlockedInTier.length === 0 && lockedTeasers.length === 0) return null;

  const tierLabel = t(`tiers.${tier.tier}.label`, { defaultValue: tier.label });
  const tierTagline = t(`tiers.${tier.tier}.tagline`, { defaultValue: tier.tagline });

  return (
    <section className="theme-tier">
      <header className="theme-tier__header">
        <span className="theme-tier__glyph" aria-hidden>{tier.glyph}</span>
        <span className="theme-tier__title">{tierLabel}</span>
        <span className="theme-tier__tagline">· {tierTagline}</span>
        <span className="theme-tier__count">
          {counts.unlocked}/{counts.total}
        </span>
      </header>

      <div className="theme-tier__grid">
        {unlockedInTier.map((theme) => (
          <ThemeSwatch
            key={theme.name}
            theme={theme}
            active={activeTheme === theme.name}
            pickerLocked={pickerLocked}
            onSelect={onSelect}
          />
        ))}
        {lockedTeasers.map((theme) => (
          <LockedSwatch key={theme.name} theme={theme} />
        ))}
        {hiddenCount > 0 && (
          <div className="theme-tier__hidden" aria-label={t('progress.hiddenTeaser', { count: hiddenCount })}>
            <Sparkles size={14} />
            <span>{t('progress.hiddenTeaser', { count: hiddenCount })}</span>
          </div>
        )}
      </div>
    </section>
  );
}

// ============================================================================
// Swatch desbloqueado — comportamento idêntico ao picker anterior
// ============================================================================

function ThemeSwatch({
  theme,
  active,
  pickerLocked,
  onSelect,
}: {
  theme: ThemePreset;
  active: boolean;
  pickerLocked: boolean;
  onSelect: (event: MouseEvent<HTMLButtonElement>, name: AppTheme) => void;
}) {
  const disabled = pickerLocked && !active;
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={(event) => onSelect(event, theme.name)}
      whileHover={disabled ? undefined : { y: -2 }}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      className={`theme-swatch ${active ? 'is-active' : ''}`}
      style={{
        ['--swatch-bg' as string]: theme.bgPrimary,
        ['--swatch-bg-2' as string]: theme.bgSecondary,
        ['--swatch-primary' as string]: theme.primary,
        ['--swatch-text' as string]: theme.textPrimary,
        ['--swatch-muted' as string]: theme.textMuted,
      }}
      title={theme.label}
      role="radio"
      aria-checked={active}
      aria-label={theme.label}
    >
      <span className="theme-swatch__window" aria-hidden>
        <span className="theme-swatch__tl">
          <i />
          <i />
          <i />
        </span>
        <span className="theme-swatch__line theme-swatch__line--1" />
        <span className="theme-swatch__line theme-swatch__line--2" />
        <span className="theme-swatch__dot" />
        <AnimatePresence>
          {active && (
            <motion.span
              key="ring"
              className="theme-swatch__ring"
              initial={{ scale: 0.72, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.22, opacity: 0 }}
              transition={{
                scale: { type: 'spring', stiffness: 360, damping: 22 },
                opacity: { duration: 0.25, ease: 'easeOut' },
              }}
              aria-hidden
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {active && (
            <motion.span
              key="check"
              className="theme-swatch__check"
              initial={{ scale: 0, opacity: 0, rotate: -35 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{
                scale: { type: 'spring', stiffness: 500, damping: 24 },
                opacity: { duration: 0.18 },
                rotate: { duration: 0.25, ease: 'easeOut' },
              }}
            >
              <Check size={10} strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>
        {active && (
          <motion.span
            key="burst"
            className="theme-swatch__burst"
            initial={{ scale: 0.4, opacity: 0.8 }}
            animate={{ scale: 1.8, opacity: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            aria-hidden
          />
        )}
      </span>
      <span className="theme-swatch__label">{theme.label}</span>
    </motion.button>
  );
}

// ============================================================================
// Swatch bloqueado (teaser) — blur + cadeado + milestone
// ============================================================================

function LockedSwatch({ theme }: { theme: ThemePreset }) {
  const { t, i18n } = useTranslation('themes');
  // Visual diferenciado por tema — em vez de janelinha borrada,
  // mostramos a paleta real em faixas verticais. Cada tema fica
  // reconhecível mesmo bloqueado, criando desejo concreto.
  return (
    <div
      className="theme-swatch theme-swatch--locked"
      style={{
        ['--swatch-bg' as string]: theme.bgPrimary,
        ['--swatch-bg-2' as string]: theme.bgSecondary,
        ['--swatch-primary' as string]: theme.primary,
        ['--swatch-hover' as string]: theme.hover,
        ['--swatch-text' as string]: theme.textPrimary,
        ['--swatch-text-2' as string]: theme.textSecondary,
        ['--swatch-muted' as string]: theme.textMuted,
      }}
      aria-label={t('lockedAria', { label: theme.label, amount: formatCredits(theme.unlockAt) })}
      title={t('lockedTitle', {
        label: theme.label,
        amount: theme.unlockAt.toLocaleString(i18n.language),
      })}
    >
      <span className="theme-lock-preview" aria-hidden>
        <span className="theme-lock-preview__stripes">
          <i style={{ background: theme.primary }} />
          <i style={{ background: theme.hover }} />
          <i style={{ background: theme.bgSecondary }} />
          <i style={{ background: theme.textSecondary }} />
        </span>
        <span className="theme-lock-preview__scrim" />
        <span className="theme-lock-preview__icon">
          <Lock size={14} strokeWidth={2.4} />
        </span>
      </span>
      <span className="theme-swatch__label theme-swatch__label--locked">
        {formatCredits(theme.unlockAt)}
      </span>
    </div>
  );
}

// ============================================================================
// Card exclusivo — destaque com moldura animada
// ============================================================================

function ExclusiveCard({
  theme,
  unlocked,
  active,
  pickerLocked,
  onSelect,
}: {
  theme: ThemePreset;
  unlocked: boolean;
  active: boolean;
  pickerLocked: boolean;
  onSelect: (event: MouseEvent<HTMLButtonElement>, name: AppTheme) => void;
}) {
  const { t } = useTranslation('themes');
  return (
    <section className="theme-exclusive">
      <header className="theme-exclusive__header">
        <span className="theme-exclusive__glyph" aria-hidden>❈</span>
        <span className="theme-exclusive__title">{t('exclusive.title')}</span>
        <span className="theme-exclusive__tagline">
          {t('exclusive.tagline')}
        </span>
      </header>
      <div className="theme-exclusive__swatch-wrap">
        {unlocked ? (
          <motion.button
            type="button"
            disabled={pickerLocked && !active}
            onClick={(e) => onSelect(e, theme.name)}
            whileHover={pickerLocked && !active ? undefined : { y: -3 }}
            whileTap={pickerLocked && !active ? undefined : { scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            className={`theme-swatch theme-swatch--exclusive ${active ? 'is-active' : ''}`}
            style={{
              ['--swatch-bg' as string]: theme.bgPrimary,
              ['--swatch-bg-2' as string]: theme.bgSecondary,
              ['--swatch-primary' as string]: theme.primary,
              ['--swatch-text' as string]: theme.textPrimary,
              ['--swatch-muted' as string]: theme.textMuted,
            }}
            role="radio"
            aria-checked={active}
            aria-label={`Tema exclusivo ${theme.label}`}
          >
            <span className="theme-swatch__window theme-swatch__window--prisma" aria-hidden>
              <span className="theme-swatch__tl">
                <i />
                <i />
                <i />
              </span>
              <span className="theme-swatch__line theme-swatch__line--1" />
              <span className="theme-swatch__line theme-swatch__line--2" />
              <span className="theme-swatch__dot" />
              <AnimatePresence>
                {active && (
                  <motion.span
                    key="ring"
                    className="theme-swatch__ring"
                    initial={{ scale: 0.72, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.22, opacity: 0 }}
                    transition={{
                      scale: { type: 'spring', stiffness: 360, damping: 22 },
                      opacity: { duration: 0.25 },
                    }}
                    aria-hidden
                  />
                )}
              </AnimatePresence>
            </span>
            <span className="theme-swatch__label">{theme.label}</span>
          </motion.button>
        ) : (
          <div
            className="theme-swatch theme-swatch--exclusive-locked"
            aria-label={t('lockedAria', { label: theme.label, amount: '1.000.000' })}
          >
            <span className="theme-exclusive-locked" aria-hidden>
              <span className="theme-exclusive-locked__aura" />
              <span className="theme-exclusive-locked__gem">
                <Gem size={30} strokeWidth={1.6} />
              </span>
              <span className="theme-exclusive-locked__sparkles">
                <i /><i /><i /><i />
              </span>
            </span>
            <span className="theme-exclusive-locked__label">
              <Lock size={11} strokeWidth={2.5} />
              {t('exclusive.lockedLabel')}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
