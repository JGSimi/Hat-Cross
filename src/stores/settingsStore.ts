import { create } from 'zustand';
import { LazyStore } from '@tauri-apps/plugin-store';
import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import {
  type AppSettings,
  type AppTheme,
  type CloudProvider,
  type TokenUsage,
  DEFAULT_SETTINGS,
  PROVIDER_DEFAULTS,
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

// --- Provider config helpers ---

export interface ProviderConfigEntry {
  apiKey: string;
  endpoint: string;
  model: string;
}

function defaultProviderConfigs(): Record<CloudProvider, ProviderConfigEntry> {
  const providers: CloudProvider[] = [
    'google',
    'openai',
    'anthropic',
    'inception',
    'openrouter',
    'custom',
  ];
  const configs = {} as Record<CloudProvider, ProviderConfigEntry>;
  for (const p of providers) {
    configs[p] = {
      apiKey: '',
      endpoint: PROVIDER_DEFAULTS[p].defaultEndpoint,
      model: '',
    };
  }
  return configs;
}

// --- Store interface ---

interface SettingsState {
  settings: AppSettings;
  providerConfigs: Record<CloudProvider, ProviderConfigEntry>;
  _hydrated: boolean;
  showSettingsPanel: boolean;

  // Actions
  setShowSettingsPanel: (show: boolean) => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
  setTheme: (theme: AppTheme) => void;
  setProvider: (provider: CloudProvider) => void;
  setApiKey: (provider: CloudProvider, key: string) => void;
  setModel: (provider: CloudProvider, model: string) => void;
  setEndpoint: (provider: CloudProvider, endpoint: string) => void;
  updateTokenStats: (usage: Partial<TokenUsage>) => void;
  resetTokenStats: () => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  providerConfigs: defaultProviderConfigs(),
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

  setProvider: (provider) => {
    set((state) => ({
      settings: { ...state.settings, cloudProvider: provider },
    }));
    get().saveSettings();
  },

  setApiKey: (provider, key) => {
    set((state) => ({
      providerConfigs: {
        ...state.providerConfigs,
        [provider]: { ...state.providerConfigs[provider], apiKey: key },
      },
    }));
    invoke('set_provider_key', { provider, key }).catch(console.error);
    get().saveSettings();
  },

  setEndpoint: (provider, endpoint) => {
    set((state) => ({
      providerConfigs: {
        ...state.providerConfigs,
        [provider]: { ...state.providerConfigs[provider], endpoint },
      },
    }));
    get().saveSettings();
  },

  setModel: (provider, model) => {
    set((state) => ({
      providerConfigs: {
        ...state.providerConfigs,
        [provider]: { ...state.providerConfigs[provider], model },
      },
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
      const stored = await tauriStore.get<{
        settings: AppSettings;
        providerConfigs: Record<CloudProvider, ProviderConfigEntry>;
      }>('hat-settings');

      if (stored) {
        // Deep merge provider configs (per-provider field merge)
        const defaults = defaultProviderConfigs();
        const mergedConfigs = { ...defaults };
        if (stored.providerConfigs) {
          for (const provider of Object.keys(defaults) as CloudProvider[]) {
            if (stored.providerConfigs[provider]) {
              mergedConfigs[provider] = { ...defaults[provider], ...stored.providerConfigs[provider] };
            }
          }
        }
        set({
          settings: deepMerge(DEFAULT_SETTINGS, stored.settings ?? {}),
          providerConfigs: mergedConfigs,
          _hydrated: true,
        });
        // Sync all stored API keys to the Rust backend
        const syncPromises = Object.entries(mergedConfigs)
          .filter(([, config]) => config.apiKey)
          .map(([provider, config]) =>
            invoke('set_provider_key', { provider, key: config.apiKey })
          );
        await Promise.all(syncPromises).catch((err) =>
          console.error('[SettingsStore] Failed to sync keys to backend:', err)
        );
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
      const { settings, providerConfigs } = get();
      await tauriStore.set('hat-settings', { settings, providerConfigs });
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
