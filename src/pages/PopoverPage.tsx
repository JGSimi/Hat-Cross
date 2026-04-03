import { useEffect } from 'react';
import { getCurrentWindow, Effect, EffectState } from '@tauri-apps/api/window';
import { useSettingsStore } from '../stores/settingsStore';
import PopoverLayout from '../components/Popover/PopoverLayout';
import StealthWrapper from '../components/Shared/StealthWrapper';

export default function PopoverPage() {
  const stealthMode = useSettingsStore((s) => s.settings.popover.stealthMode);

  // Apply native vibrancy effect for true transparent glass on macOS
  useEffect(() => {
    const win = getCurrentWindow();
    win.setEffects({
      effects: [Effect.Popover],
      state: EffectState.Active,
      radius: 14,
    }).catch(() => {});
  }, []);

  const content = (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: 'transparent' }}>
      <PopoverLayout />
    </div>
  );

  if (stealthMode) {
    return <StealthWrapper>{content}</StealthWrapper>;
  }

  return content;
}
