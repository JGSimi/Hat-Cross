import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { LogicalSize } from '@tauri-apps/api/dpi';
import { useSettingsStore } from '../stores/settingsStore';
import PopoverLayout from '../components/Popover/PopoverLayout';
import StealthWrapper from '../components/Shared/StealthWrapper';

export default function PopoverPage() {
  const stealthMode = useSettingsStore((s) => s.settings.popover.stealthMode);
  const popoverSettings = useSettingsStore((s) => s.settings.popover);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    appWindow.setSize(new LogicalSize(popoverSettings.width, popoverSettings.height)).catch(() => {});
  }, [popoverSettings.width, popoverSettings.height]);

  const content = (
    <div className="w-screen h-screen overflow-hidden">
      <PopoverLayout />
    </div>
  );

  if (stealthMode) {
    return <StealthWrapper>{content}</StealthWrapper>;
  }

  return content;
}
