import { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  FileText,
  Code2,
  Bug,
  PencilLine,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../stores/chatStore';

interface Suggestion {
  id: 'summarize' | 'explainCode' | 'debugError' | 'reviewWriting';
  icon: LucideIcon;
}

const SUGGESTIONS: readonly Suggestion[] = [
  { id: 'summarize', icon: FileText },
  { id: 'explainCode', icon: Code2 },
  { id: 'debugError', icon: Bug },
  { id: 'reviewWriting', icon: PencilLine },
];

function SuggestionGrid() {
  const { t } = useTranslation('chat');
  const setPendingInput = useChatStore((s) => s.setPendingInput);
  const reduced = useReducedMotion();

  const handleClick = (suggestionId: string) => {
    const prompt = t(`suggestions.${suggestionId}.prompt`);
    setPendingInput(prompt);
  };

  return (
    <div
      role="group"
      aria-label={t('suggestions.label', { defaultValue: 'Atalhos de partida' })}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 8,
        width: '100%',
        maxWidth: 520,
        margin: '0 auto',
      }}
    >
      {SUGGESTIONS.map((suggestion, i) => {
        const Icon = suggestion.icon;
        return (
          <motion.button
            type="button"
            key={suggestion.id}
            onClick={() => handleClick(suggestion.id)}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.6 + i * 0.06,
              type: 'spring',
              stiffness: 260,
              damping: 22,
            }}
            whileHover={reduced ? undefined : { y: -2 }}
            whileTap={reduced ? undefined : { scale: 0.98 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 6,
              padding: '12px 14px',
              borderRadius: 12,
              background: 'color-mix(in srgb, var(--surface-secondary, var(--bg-secondary)) 65%, transparent)',
              border:
                '0.5px solid color-mix(in srgb, var(--border-subtle, rgba(255,255,255,0.08)) 100%, transparent)',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
              transition: 'background 0.15s ease, border-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                'color-mix(in srgb, var(--color-accent) 10%, var(--surface-secondary, var(--bg-secondary)) 90%)';
              e.currentTarget.style.borderColor =
                'color-mix(in srgb, var(--color-accent) 35%, transparent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background =
                'color-mix(in srgb, var(--surface-secondary, var(--bg-secondary)) 65%, transparent)';
              e.currentTarget.style.borderColor =
                'color-mix(in srgb, var(--border-subtle, rgba(255,255,255,0.08)) 100%, transparent)';
            }}
          >
            <span
              aria-hidden
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: 8,
                background:
                  'color-mix(in srgb, var(--color-accent) 12%, transparent)',
                color: 'var(--color-accent)',
              }}
            >
              <Icon size={15} strokeWidth={1.75} />
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: -0.1,
              }}
            >
              {t(`suggestions.${suggestion.id}.title`)}
            </span>
            <span
              style={{
                fontSize: 11.5,
                color: 'var(--text-muted)',
                lineHeight: 1.35,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {t(`suggestions.${suggestion.id}.body`)}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

export default memo(SuggestionGrid);
