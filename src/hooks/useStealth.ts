import { useState, useCallback } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

export function useStealth() {
  const stealthMode = useSettingsStore((s) => s.settings.popover.stealthMode);
  const stealthHoverOpacity = useSettingsStore((s) => s.settings.popover.stealthHoverOpacity);
  const [isHovered, setIsHovered] = useState(false);

  const onMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const onMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  return {
    stealthMode,
    stealthHoverOpacity,
    isHovered,
    handlers: {
      onMouseEnter,
      onMouseLeave,
    },
  };
}
