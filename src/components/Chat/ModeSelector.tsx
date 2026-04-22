import { motion, useReducedMotion } from 'framer-motion';
import { Zap, Sparkles } from 'lucide-react';
import { useCreditsStore } from '../../stores/creditsStore';
import { AI_MODES, type AIMode } from '../../types/account';

// Each mode gets a signature hue that shows through even when idle — gives
// the picker a visual identity without shouting. Active tile layers a pill
// that morphs across tiles via layoutId so the transition feels physical.
const MODE_TINT: Record<AIMode, { icon: typeof Zap; hue: string; glow: string }> = {
  hat:       { icon: Zap,      hue: '#FBBF24', glow: 'rgba(251, 191, 36, 0.35)' },
  'hat-pro': { icon: Sparkles, hue: '#818CF8', glow: 'rgba(129, 140, 248, 0.35)' },
};

export default function ModeSelector() {
  const selectedMode = useCreditsStore((s) => s.selectedMode);
  const setSelectedMode = useCreditsStore((s) => s.setSelectedMode);
  const reducedMotion = useReducedMotion();

  return (
    <div
      role="radiogroup"
      aria-label="Modelo de IA"
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 2,
        padding: 3,
        borderRadius: 10,
        background:
          'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
        border: '0.5px solid var(--border-subtle)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      {AI_MODES.map((m) => {
        const { icon: Icon, hue, glow } = MODE_TINT[m.id];
        const active = selectedMode === m.id;

        return (
          <motion.button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={active}
            title={m.description}
            whileTap={reducedMotion ? undefined : { scale: 0.96 }}
            onClick={() => setSelectedMode(m.id)}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              padding: '6px 10px',
              borderRadius: 7,
              fontSize: 10.5,
              fontWeight: active ? 600 : 500,
              color: active ? 'white' : 'var(--text-muted)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              zIndex: 1,
              letterSpacing: active ? 0.1 : 0,
              transition: 'color 0.2s ease, font-weight 0.2s ease',
            }}
          >
            {active && (
              <motion.span
                layoutId="mode-selector-pill"
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 7,
                  background: `linear-gradient(135deg, ${hue}, ${hue}dd)`,
                  boxShadow: `0 0 18px ${glow}, inset 0 0 0 0.5px rgba(255,255,255,0.22)`,
                  zIndex: -1,
                }}
                transition={
                  reducedMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 380, damping: 32 }
                }
              />
            )}
            <Icon
              size={11}
              strokeWidth={active ? 2.5 : 2}
              style={{
                color: active ? 'white' : hue,
                filter: active ? 'none' : 'saturate(0.75)',
                transition: 'color 0.2s ease',
              }}
            />
            <span>{m.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
