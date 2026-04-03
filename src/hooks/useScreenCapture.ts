import { invoke } from '@tauri-apps/api/core';

export function useScreenCapture() {
  const captureScreen = async (): Promise<string | null> => {
    try {
      const base64 = await invoke<string>('capture_screen');
      return base64;
    } catch (e) {
      console.error('Screen capture failed:', e);
      return null;
    }
  };

  const captureForPopover = async (): Promise<string | null> => {
    try {
      await invoke('hide_popover_temporarily');
      await new Promise((r) => setTimeout(r, 300));
      const base64 = await invoke<string>('capture_screen');
      // Re-show popover
      await invoke('toggle_popover');
      return base64;
    } catch (e) {
      // Re-show popover even on error
      await invoke('toggle_popover').catch(() => {});
      console.error('Screen capture failed:', e);
      return null;
    }
  };

  return { captureScreen, captureForPopover };
}
