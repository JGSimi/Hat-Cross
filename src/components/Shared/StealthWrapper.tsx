import { type ReactNode, useState, useEffect, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useSettingsStore } from '../../stores/settingsStore';

interface Props {
  children: ReactNode;
}

export default function StealthWrapper({ children }: Props) {
  const stealthHoverOpacity = useSettingsStore((s) => s.settings.popover.stealthHoverOpacity);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  // Make window click-through when in stealth idle
  useEffect(() => {
    const win = getCurrentWindow();
    win.setIgnoreCursorEvents(!isHovered).catch(() => {});
  }, [isHovered]);

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        width: '100%',
        height: '100%',
        opacity: isHovered ? stealthHoverOpacity : 0.08,
        filter: isHovered ? 'saturate(0.3)' : 'saturate(0)',
        transition: 'opacity 0.3s ease-in-out, filter 0.3s ease-in-out',
      }}
    >
      {children}
    </div>
  );
}
