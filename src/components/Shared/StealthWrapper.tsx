import { type ReactNode, useState, useEffect, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useSettingsStore } from '../../stores/settingsStore';

interface Props {
  children: ReactNode;
}

export default function StealthWrapper({ children }: Props) {
  const hoverOpacity = useSettingsStore((s) => s.settings.popover.stealthHoverOpacity);
  const [hovered, setHovered] = useState(false);

  const onEnter = useCallback(() => setHovered(true), []);
  const onLeave = useCallback(() => setHovered(false), []);

  useEffect(() => {
    getCurrentWindow().setIgnoreCursorEvents(!hovered).catch(() => {});
  }, [hovered]);

  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        width: '100%',
        height: '100%',
        opacity: hovered ? hoverOpacity : 0.06,
        filter: hovered ? 'none' : 'saturate(0) brightness(0.7)',
        transition: 'opacity 0.25s ease, filter 0.25s ease',
      }}
    >
      {children}
    </div>
  );
}
