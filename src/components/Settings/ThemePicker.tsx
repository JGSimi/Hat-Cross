import { THEME_PRESETS, type AppTheme } from '../../types';

interface Props {
  current: AppTheme;
  onChange: (theme: AppTheme) => void;
}

export default function ThemePicker({ current, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {THEME_PRESETS.map((theme) => (
        <button
          key={theme.name}
          onClick={() => onChange(theme.name)}
          className={`w-9 h-9 rounded-xl border-2 transition-all ${
            current === theme.name
              ? 'border-white scale-110 shadow-lg'
              : 'border-transparent hover:scale-105'
          }`}
          style={{ background: theme.primary }}
          title={theme.label}
        />
      ))}
    </div>
  );
}
