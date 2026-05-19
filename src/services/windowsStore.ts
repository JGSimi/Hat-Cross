import { invoke } from '@tauri-apps/api/core';
import { isTauriRuntime } from '../utils/tauriRuntime';

export function isWindowsStoreRuntime(): boolean {
  return isTauriRuntime() && typeof navigator !== 'undefined' && /win/i.test(navigator.platform);
}

export async function getWindowsStoreValue<T>(
  file: string,
  key: string,
): Promise<T | null> {
  return await invoke<T | null>('windows_store_get', { file, key });
}

export async function setWindowsStoreValue(
  file: string,
  key: string,
  value: unknown,
): Promise<void> {
  await invoke('windows_store_set', { file, key, value });
}
