import { create } from 'zustand';
import { LazyStore } from '@tauri-apps/plugin-store';
import { emit, listen } from '@tauri-apps/api/event';
import {
  type AppSettings,
  type AppTheme,
  type TokenUsage,
  DEFAULT_SETTINGS,
  VALID_THEMES,
} from '../types';

// --- Tauri persistent store ---

const tauriStore = new LazyStore('settings.json');

// --- Deep merge helper (preserves nested user values, fills in new defaults) ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepMerge(defaults: any, stored: any): any {
  if (
    typeof defaults !== 'object' || defaults === null || Array.isArray(defaults) ||
    typeof stored !== 'object' || stored === null || Array.isArray(stored)
  ) {
    return stored;
  }
  const result = { ...defaults };
  for (const key in stored) {
    if (stored[key] !== undefined && stored[key] !== null) {
      if (
        typeof defaults[key] === 'object' && defaults[key] !== null && !Array.isArray(defaults[key]) &&
        typeof stored[key] === 'object' && stored[key] !== null && !Array.isArray(stored[key])
      ) {
        result[key] = deepMerge(defaults[key], stored[key]);
      } else {
        result[key] = stored[key];
      }
    }
  }
  return result;
}

// --- Store interface ---
//
// BYOK was removed on 2026-04-16 — the store no longer tracks per-provider
// API keys, endpoints, or model choices. The user's chosen AI mode lives in
// creditsStore (`selectedMode`), and everything else the Worker needs is
// derived from the Firebase session at request time.

interface SettingsState {
  settings: AppSettings;
  _hydrated: boolean;
  showSettingsPanel: boolean;

  // Actions
  setShowSettingsPanel: (show: boolean) => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
  setTheme: (theme: AppTheme) => void;
  updateTokenStats: (usage: Partial<TokenUsage>) => void;
  resetTokenStats: () => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  _hydrated: false,
  showSettingsPanel: false,

  setShowSettingsPanel: (show) => {
    set({ showSettingsPanel: show });
  },

  updateSettings: (partial) => {
    set((state) => ({
      settings: deepMerge(state.settings, partial),
    }));
    get().saveSettings();
  },

  setTheme: (theme) => {
    set((state) => ({
      settings: { ...state.settings, theme },
    }));
    get().saveSettings();
  },

  updateTokenStats: (usage) => {
    set((state) => {
      const current = state.settings.tokenStats;
      const inputTokens = current.inputTokens + (usage.inputTokens ?? 0);
      const outputTokens = current.outputTokens + (usage.outputTokens ?? 0);
      return {
        settings: {
          ...state.settings,
          tokenStats: {
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
          },
        },
      };
    });
    get().saveSettings();
  },

  resetTokenStats: () => {
    set((state) => ({
      settings: {
        ...state.settings,
        tokenStats: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      },
    }));
    get().saveSettings();
  },

  loadSettings: async () => {
    try {
      const stored = await tauriStore.get<{ settings: AppSettings }>('hat-settings');
      if (stored) {
        const merged = deepMerge(DEFAULT_SETTINGS, stored.settings ?? {}) as AppSettings;
        // Accent-only themes were removed — fall back to the default full theme.
        if (!VALID_THEMES.includes(merged.theme)) {
          merged.theme = DEFAULT_SETTINGS.theme;
        }
        // Drop the legacy `screenCapture` shortcut field carried over from the
        // removed screen-analysis feature so it doesn't linger in disk storage.
        if ('screenCapture' in merged.shortcuts) {
          delete (merged.shortcuts as Record<string, unknown>).screenCapture;
        }
        set({ settings: merged, _hydrated: true });
      } else {
        set({ _hydrated: true });
      }
    } catch (err) {
      console.error('[SettingsStore] Failed to load settings:', err);
      set({ _hydrated: true });
    }
  },

  saveSettings: async () => {
    if (!get()._hydrated) return; // Don't overwrite persisted data before hydration
    try {
      const { settings } = get();
      await tauriStore.set('hat-settings', { settings });
      await tauriStore.save();
      // Notify other windows to reload settings
      emit('settings-changed').catch(() => {});
    } catch (err) {
      console.error('[SettingsStore] Failed to save settings:', err);
    }
  },
}));

// Cross-window settings sync: reload when another window saves (debounced)
let _syncListenerSetup = false;
export function setupSettingsSync() {
  if (_syncListenerSetup) return;
  _syncListenerSetup = true;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  listen('settings-changed', () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      useSettingsStore.getState().loadSettings();
    }, 300);
  });
}
