import { motion } from 'framer-motion';
import { THEME_PRESETS, type AppTheme } from '../../types';

interface Props {
  current: AppTheme;
  onChange: (theme: AppTheme) => void;
}

export default function ThemePicker({ current, onChange }: Props) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {THEME_PRESETS.map((theme) => (
        <motion.button
          key={theme.name}
          onClick={() => onChange(theme.name)}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            background: theme.primary,
            border: 'none',
            cursor: 'pointer',
            outline: current === theme.name ? '2px solid white' : '2px solid transparent',
            outlineOffset: 2,
            boxShadow: current === theme.name ? 'var(--shadow-medium)' : 'none',
          }}
          title={theme.label}
        />
      ))}
    </div>
  );
}
