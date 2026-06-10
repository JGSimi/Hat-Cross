// Store de configurações: carrega do disco (migrando formatos antigos),
// aplica tema ao DOM, e persiste alterações. Rebind de atalho valida via
// accelerator e re-registra no shell nativo antes de persistir.
//
// Deps injetadas por init() (padrão do roomStore) para testabilidade.

import { create } from 'zustand';

import type { NativeBridge } from '../bridge/native';
import type { SettingsPort } from '../bridge/settings';
import { normalize } from '../domain/shortcuts/accelerator';
import {
  defaultSettings,
  migrate,
  type Settings,
} from '../domain/settings/schema';

type ShortcutKey = keyof Settings['shortcuts'];

export interface SettingsStoreState {
  settings: Settings;
  loaded: boolean;

  init: (deps: { port: SettingsPort; bridge: NativeBridge }) => Promise<void>;
  setTheme: (theme: string) => Promise<void>;
  setLanguage: (language: Settings['language']) => Promise<void>;
  /**
   * Rebind de um atalho. Valida e normaliza; re-registra no nativo; só então
   * persiste. Lança RangeError se o binding for inválido — chamadora exibe erro
   * e mantém o atalho antigo (nada foi alterado).
   */
  setShortcut: (key: ShortcutKey, binding: string) => Promise<void>;
}

function applyTheme(theme: string): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

export const useSettingsStore = create<SettingsStoreState>((set, get) => {
  let port: SettingsPort | null = null;
  let bridge: NativeBridge | null = null;

  async function persist(next: Settings): Promise<void> {
    set({ settings: next });
    await port?.save(next);
  }

  return {
    settings: defaultSettings,
    loaded: false,

    async init(deps): Promise<void> {
      port = deps.port;
      bridge = deps.bridge;
      const raw = await port.load();
      const settings = migrate(raw);
      applyTheme(settings.theme);
      set({ settings, loaded: true });
    },

    async setTheme(theme): Promise<void> {
      applyTheme(theme);
      await persist({ ...get().settings, theme });
    },

    async setLanguage(language): Promise<void> {
      await persist({ ...get().settings, language });
    },

    async setShortcut(key, binding): Promise<void> {
      const normalized = normalize(binding);
      if (normalized === null) {
        throw new RangeError(`Atalho inválido: ${binding}`);
      }
      const current = get().settings;
      const shortcuts = { ...current.shortcuts, [key]: normalized };
      // Re-registra no nativo ANTES de persistir: se o shell rejeitar
      // (ex.: conflito), o erro propaga e nada é salvo.
      await bridge?.setShortcuts(shortcuts);
      await persist({ ...current, shortcuts });
    },
  };
});
