import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';

export function useClipboard() {
  const readClipboard = async (): Promise<string> => {
    try {
      const text = await readText();
      return text || '';
    } catch {
      return '';
    }
  };

  const writeClipboard = async (text: string): Promise<void> => {
    try {
      await writeText(text);
    } catch (e) {
      console.error('Failed to write clipboard:', e);
    }
  };

  return { readClipboard, writeClipboard };
}
