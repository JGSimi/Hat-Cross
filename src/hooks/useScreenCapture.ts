import { invoke } from '@tauri-apps/api/core';

export function useScreenCapture() {
  const captureScreen = async (): Promise<string | null> => {
    try {
      return await invoke<string>('capture_screen');
    } catch (e) {
      console.error('Screen capture failed:', e);
      return null;
    }
  };

  return { captureScreen };
}
