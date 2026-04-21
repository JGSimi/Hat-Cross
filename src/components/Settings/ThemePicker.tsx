import { MouseEvent, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { THEME_PRESETS, type AppTheme, type ThemePreset } from '../../types';
import { runThemeTransition } from '../../utils/themeTransition';

interface Props {
  current: AppTheme;
  onChange: (theme: AppTheme) => void;
}

// Lock a fresh click until the reveal completes. Without this, rapid clicks
// spawn overlapping View Transitions — each cancels the previous, so the user
// sees every click resolve sequentially (~1.4s each) and experiences a ~3s
// stall before the final theme visually lands. Keeping the lockout slightly
// under the reveal duration feels snappy without leaking races.
const COOLDOWN_MS = 1200;

export default function ThemePicker({ current, onChange }: Props) {
  const [locked, setLocked] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
  }, []);

  const handleSelect = (event: MouseEvent<HTMLButtonElement>, name: AppTheme) => {
    if (locked || name === current) return;

    setLocked(true);
    runThemeTransition(event, () => {
      // Apply to DOM synchronously so the View Transition captures the new
      // palette before the callback returns — the zustand update in onChange
      // schedules a re-render that runs later.
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
    <div className={`theme-picker ${locked ? 'is-locked' : ''}`}>
      {THEME_PRESETS.map((theme) => (
        <ThemeSwatch
          key={theme.name}
          theme={theme}
          active={current === theme.name}
          locked={locked}
          onSelect={(e) => handleSelect(e, theme.name)}
        />
      ))}
    </div>
  );
}

function ThemeSwatch({
  theme,
  active,
  locked,
  onSelect,
}: {
  theme: ThemePreset;
  active: boolean;
  locked: boolean;
  onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const disabled = locked && !active;
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={(event) => onSelect(event)}
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
      aria-pressed={active}
      aria-label={`Tema ${theme.label}`}
    >
      <span className="theme-swatch__window" aria-hidden>
        {/* Faux macOS traffic lights — pure decoration */}
        <span className="theme-swatch__tl">
          <i />
          <i />
          <i />
        </span>

        {/* Text line previews */}
        <span className="theme-swatch__line theme-swatch__line--1" />
        <span className="theme-swatch__line theme-swatch__line--2" />

        {/* Accent color corner bubble */}
        <span className="theme-swatch__dot" />

        {/* Selection indicators — crossfade handoff from old swatch to new:
            the previous active's ring pulses outward as it fades, the new
            swatch's ring springs in with a slight scale. Reads clearly as
            "the selection moved" without a confusing flight path. */}
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
        {/* Activation burst — a radial flash on the swatch that JUST became
            active. Re-keyed on `active` so React remounts and the animation
            replays each time the swatch is picked. */}
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
