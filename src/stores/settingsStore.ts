import { create } from 'zustand';
import { LazyStore } from '@tauri-apps/plugin-store';
import { emit, listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import i18n from '../i18n';
import {
  type AppSettings,
  type AppTheme,
  type AppLanguage,
  type TokenUsage,
  DEFAULT_SETTINGS,
  VALID_THEMES,
} from '../types';
import {
  DEFAULT_SYSTEM_PROMPTS,
  matchesDefaultPrompt,
  SUPPORTED_LANGUAGES,
} from '../i18n/defaults';
import { isTauriRuntime } from '../utils/tauriRuntime';
import { withTimeout } from '../utils/async';
import {
  getWindowsStoreValue,
  isWindowsStoreRuntime,
  setWindowsStoreValue,
} from '../services/windowsStore';

// --- Tauri persistent store ---

const tauriStore = new LazyStore('settings.json');
const STORE_LOAD_TIMEOUT_MS = 4_000;
const STORE_SAVE_TIMEOUT_MS = 4_000;

function canMutateTrayFromFrontend(): boolean {
  if (!isTauriRuntime()) return false;
  if (typeof navigator !== 'undefined' && /win/i.test(navigator.platform)) return false;
  return true;
}

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

type LegacyShortcutSettings = Partial<AppSettings['shortcuts']> & {
  clipboard?: string;
  screenCapture?: string;
  [key: string]: unknown;
};

type LegacyAppSettings = Partial<AppSettings> & {
  shortcuts?: LegacyShortcutSettings;
  [key: string]: unknown;
};

const LEGACY_FLOATING_SHORTCUT = `floating${'Chat'}`;
const LEGACY_CHAT_LIMITS = `chat${'Limits'}`;
const LEGACY_CHAT_RESPONSE_NOTIFICATION = `show${'Chat'}ResponseNotification`;
const LEGACY_POPOVER = `pop${'over'}`;

function normalizeStoredSettings(stored: LegacyAppSettings): AppSettings {
  const merged = deepMerge(DEFAULT_SETTINGS, stored ?? {}) as AppSettings & Record<string, unknown>;
  const legacyShortcuts = (stored.shortcuts ?? {}) as LegacyShortcutSettings;

  merged.shortcuts = {
    ...DEFAULT_SETTINGS.shortcuts,
    ...merged.shortcuts,
    processClipboardFlash:
      typeof legacyShortcuts.processClipboardFlash === 'string'
        ? legacyShortcuts.processClipboardFlash
        : typeof legacyShortcuts.clipboard === 'string'
          ? legacyShortcuts.clipboard
          : DEFAULT_SETTINGS.shortcuts.processClipboardFlash,
    adjustFlashPosition:
      typeof legacyShortcuts.adjustFlashPosition === 'string'
        ? legacyShortcuts.adjustFlashPosition
        : DEFAULT_SETTINGS.shortcuts.adjustFlashPosition,
    emergencyQuit:
      typeof legacyShortcuts.emergencyQuit === 'string'
        ? legacyShortcuts.emergencyQuit
        : DEFAULT_SETTINGS.shortcuts.emergencyQuit,
  };

  const shortcutLegacy = merged.shortcuts as unknown as Record<string, unknown>;
  delete shortcutLegacy.clipboard;
  delete shortcutLegacy[LEGACY_FLOATING_SHORTCUT];
  delete shortcutLegacy.screenCapture;
  delete merged[LEGACY_POPOVER];
  delete merged[LEGACY_CHAT_LIMITS];

  const clipLegacy = merged.clipboard as unknown as Record<string, unknown>;
  delete clipLegacy.customPrompt;
  delete clipLegacy.useCustomPrompt;

  const notifLegacy = merged.notifications as unknown as Record<string, unknown>;
  delete notifLegacy[LEGACY_CHAT_RESPONSE_NOTIFICATION];

  return merged as AppSettings;
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
  _loadedFromDisk: boolean;
  showSettingsPanel: boolean;

  // Actions
  setShowSettingsPanel: (show: boolean) => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
  setTheme: (theme: AppTheme) => void;
  /**
   * Muda o idioma da UI. Se o systemPrompt atual for um default conhecido
   * (não foi customizado), também troca pro default do novo idioma pra IA
   * passar a responder no idioma escolhido. Retorna `true` se o prompt foi
   * auto-trocado, `false` se ficou preservado por ser customizado.
   */
  setLanguage: (lang: AppLanguage) => boolean;
  updateTokenStats: (usage: Partial<TokenUsage>) => void;
  resetTokenStats: () => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  _hydrated: false,
  _loadedFromDisk: false,
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

  setLanguage: (lang) => {
    const { settings } = get();
    const isKnownDefault = matchesDefaultPrompt(settings.systemPrompt) !== null;
    const newPrompt = isKnownDefault
      ? DEFAULT_SYSTEM_PROMPTS[lang]
      : settings.systemPrompt;
    set({
      settings: { ...settings, language: lang, systemPrompt: newPrompt },
    });
    get().saveSettings();
    i18n.changeLanguage(lang).catch(() => {});
    // Rust side: tenta regenerar o tray na nova língua. Silencia erro se
    // o comando ainda não foi registrado (build antigo durante transição).
    if (canMutateTrayFromFrontend()) {
      invoke('set_tray_language', { lang }).catch(() => {});
    }
    return isKnownDefault;
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
    if (!isTauriRuntime()) {
      set({ _hydrated: true });
      i18n.changeLanguage(DEFAULT_SETTINGS.language).catch(() => {});
      return;
    }
    try {
      const stored = isWindowsStoreRuntime()
        ? await withTimeout(
            getWindowsStoreValue<{ settings: AppSettings }>('settings.json', 'hat-settings'),
            STORE_LOAD_TIMEOUT_MS,
            'settings load timed out',
          )
        : await withTimeout(
            tauriStore.get<{ settings: AppSettings }>('hat-settings'),
            STORE_LOAD_TIMEOUT_MS,
            'settings load timed out',
          );
      if (stored) {
        const merged = normalizeStoredSettings((stored.settings ?? {}) as LegacyAppSettings);
        // Accent-only themes were removed — fall back to the default full theme.
        if (!VALID_THEMES.includes(merged.theme)) {
          merged.theme = DEFAULT_SETTINGS.theme;
        }
        // Idioma precisa ser um dos suportados, caso contrário cai em pt-BR
        // pra preservar comportamento de usuários antigos sem o campo.
        if (!SUPPORTED_LANGUAGES.includes(merged.language)) {
          merged.language = 'pt-BR';
        }
        set({ settings: merged, _hydrated: true, _loadedFromDisk: true });
        // Sync i18n + tray com o idioma carregado.
        i18n.changeLanguage(merged.language).catch(() => {});
        if (canMutateTrayFromFrontend()) {
          invoke('set_tray_language', { lang: merged.language }).catch(() => {});
        }
      } else {
        set({ _hydrated: true, _loadedFromDisk: false });
        i18n.changeLanguage(DEFAULT_SETTINGS.language).catch(() => {});
      }
    } catch (err) {
      console.error('[SettingsStore] Failed to load settings:', err);
      i18n.changeLanguage(DEFAULT_SETTINGS.language).catch(() => {});
      set({ _hydrated: true, _loadedFromDisk: false });
    }
  },

  saveSettings: async () => {
    if (!get()._hydrated) return; // Don't overwrite persisted data before hydration
    if (!isTauriRuntime()) return;
    try {
      const { settings } = get();
      if (isWindowsStoreRuntime()) {
        await withTimeout(
          setWindowsStoreValue('settings.json', 'hat-settings', { settings }),
          STORE_SAVE_TIMEOUT_MS,
          'settings save timed out',
        );
      } else {
        await withTimeout(
          tauriStore.set('hat-settings', { settings }),
          STORE_SAVE_TIMEOUT_MS,
          'settings set timed out',
        );
        await withTimeout(
          tauriStore.save(),
          STORE_SAVE_TIMEOUT_MS,
          'settings save timed out',
        );
      }
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
  if (!isTauriRuntime()) return;
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
