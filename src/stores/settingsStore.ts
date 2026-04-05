import { create } from 'zustand';
import { LazyStore } from '@tauri-apps/plugin-store';
import { invoke } from '@tauri-apps/api/core';
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

function deepMerge<T extends Record<string, unknown>>(defaults: T, stored: Partial<T>): T {
  const result = { ...defaults };
  for (const key in stored) {
    const storedVal = stored[key];
    const defaultVal = defaults[key];
    if (storedVal !== undefined && storedVal !== null) {
      if (
        typeof defaultVal === 'object' && defaultVal !== null && !Array.isArray(defaultVal) &&
        typeof storedVal === 'object' && storedVal !== null && !Array.isArray(storedVal)
      ) {
        (result as Record<string, unknown>)[key] = deepMerge(
          defaultVal as Record<string, unknown>,
          storedVal as Record<string, unknown>,
        );
      } else {
        (result as Record<string, unknown>)[key] = storedVal;
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
      settings: deepMerge(state.settings, partial as Record<string, unknown>) as AppSettings,
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
          settings: deepMerge(DEFAULT_SETTINGS, (stored.settings ?? {}) as Record<string, unknown>) as AppSettings,
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
    } catch (err) {
      console.error('[SettingsStore] Failed to save settings:', err);
    }
  },
}));
