import { motion } from 'framer-motion';
import { Zap, Sparkles, Brain } from 'lucide-react';
import { useCreditsStore } from '../../stores/creditsStore';
import { AI_MODES, type AIMode } from '../../types/account';

const ICONS: Record<AIMode, typeof Zap> = {
  mini: Zap,
  standard: Sparkles,
  plus: Brain,
};

export default function ModeSelector() {
  const selectedMode = useCreditsStore((s) => s.selectedMode);
  const setSelectedMode = useCreditsStore((s) => s.setSelectedMode);

  return (
    <div
      style={{
        display: 'flex',
        gap: 2,
        padding: 2,
        borderRadius: 8,
        background: 'var(--surface-secondary)',
        border: '0.5px solid var(--border-subtle)',
      }}
    >
      {AI_MODES.map((m) => {
        const Icon = ICONS[m.id];
        const active = selectedMode === m.id;
        return (
          <motion.button
            key={m.id}
            type="button"
            title={m.description}
            whileTap={{ scale: 0.96 }}
            onClick={() => setSelectedMode(m.id)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: '5px 10px',
              borderRadius: 6,
              fontSize: 10.5,
              fontWeight: active ? 600 : 500,
              background: active ? 'var(--color-accent)' : 'transparent',
              color: active ? 'white' : 'var(--text-muted)',
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
          >
            <Icon size={11} />
            <span>{m.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
