import { isTauriRuntime } from './tauriRuntime';

export function useWindowsWebStorageFallback(): boolean {
  return isTauriRuntime() && typeof navigator !== 'undefined' && /win/i.test(navigator.platform);
}

export function readLocalJson<T>(key: string): T | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeLocalJson(key: string, value: unknown): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}
