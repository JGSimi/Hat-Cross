import { motion, AnimatePresence } from 'framer-motion';
import { THEME_PRESETS, type AppTheme } from '../../types';

interface Props {
  current: AppTheme;
  onChange: (theme: AppTheme) => void;
}

export default function ThemePicker({ current, onChange }: Props) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {THEME_PRESETS.map((theme) => (
        <div key={theme.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <motion.button
            onClick={() => onChange(theme.name)}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              background: theme.bgPrimary,
              border: 'none',
              cursor: 'pointer',
              outline: current === theme.name ? `2px solid ${theme.primary}` : '2px solid transparent',
              outlineOffset: 3,
              boxShadow: current === theme.name
                ? `0 0 16px color-mix(in srgb, ${theme.primary} 40%, transparent), 0 0 0 1px rgba(255,255,255,0.1) inset`
                : '0 0 0 1px rgba(255,255,255,0.06) inset',
              transition: 'box-shadow 0.2s ease, outline 0.2s ease',
              position: 'relative',
              overflow: 'hidden',
            }}
            title={theme.label}
          >
            {/* Accent dot */}
            <div style={{
              position: 'absolute',
              bottom: 4,
              right: 4,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: theme.primary,
              boxShadow: `0 0 6px ${theme.primary}`,
            }} />
            {/* Text preview lines */}
            <div style={{
              position: 'absolute',
              top: 8,
              left: 6,
              width: 18,
              height: 2,
              borderRadius: 1,
              background: theme.textPrimary,
              opacity: 0.6,
            }} />
            <div style={{
              position: 'absolute',
              top: 14,
              left: 6,
              width: 12,
              height: 2,
              borderRadius: 1,
              background: theme.textMuted,
              opacity: 0.4,
            }} />
          </motion.button>
          <AnimatePresence>
            {current === theme.name && (
              <motion.span
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                style={{ fontSize: 9, color: theme.primary, fontWeight: 600 }}
              >
                {theme.label}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
