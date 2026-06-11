/**
 * Schema das configurações persistidas em disco + migração de versões antigas.
 * Módulo de domínio PURO: sem imports de Tauri, zustand ou React.
 */

export interface Settings {
  version: number;
  language: 'pt-BR' | 'en';
  theme: string;
  shortcuts: {
    processClipboardFlash: string;
    adjustFlashPosition: string;
    emergencyQuit: string;
    showCorrection: string;
    toggleGabarito: string;
  };
  flash: {
    position: { x: number; y: number; monitorLabel?: string };
    /** 0–100. Default baixíssimo: o card é quase invisível (stealth). */
    opacity: number;
  };
}

export const CURRENT_SETTINGS_VERSION = 2;

export const defaultSettings: Settings = {
  version: CURRENT_SETTINGS_VERSION,
  language: 'pt-BR',
  theme: 'indigo',
  shortcuts: {
    processClipboardFlash: 'CommandOrControl+Shift+F',
    adjustFlashPosition: 'CommandOrControl+Alt+F',
    emergencyQuit: 'CommandOrControl+Shift+Q',
    showCorrection: 'CommandOrControl+Shift+D',
    toggleGabarito: 'CommandOrControl+Shift+G',
  },
  flash: {
    position: { x: 24, y: 24 },
    // Quase invisível por padrão (stealth): só o usuário sabe onde está.
    opacity: 16,
  },
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function asFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : fallback;
}

function migrateLanguage(value: unknown): Settings['language'] {
  return value === 'pt-BR' || value === 'en'
    ? value
    : defaultSettings.language;
}

function migrateShortcuts(value: unknown): Settings['shortcuts'] {
  const raw = isRecord(value) ? value : {};
  const defaults = defaultSettings.shortcuts;

  // v1 legado: a chave 'clipboard' virou 'processClipboardFlash'.
  // O nome novo, quando presente e válido, tem precedência sobre o legado.
  const legacyClipboard =
    typeof raw['clipboard'] === 'string' ? raw['clipboard'] : undefined;
  const processClipboardFlash = asString(
    raw['processClipboardFlash'],
    legacyClipboard ?? defaults.processClipboardFlash,
  );

  return {
    processClipboardFlash,
    adjustFlashPosition: asString(
      raw['adjustFlashPosition'],
      defaults.adjustFlashPosition,
    ),
    emergencyQuit: asString(raw['emergencyQuit'], defaults.emergencyQuit),
    showCorrection: asString(raw['showCorrection'], defaults.showCorrection),
    toggleGabarito: asString(raw['toggleGabarito'], defaults.toggleGabarito),
  };
}

function migrateFlash(value: unknown): Settings['flash'] {
  const raw = isRecord(value) ? value : {};
  const defaults = defaultSettings.flash;

  const rawPosition = isRecord(raw['position']) ? raw['position'] : {};
  const monitorLabel =
    typeof rawPosition['monitorLabel'] === 'string'
      ? rawPosition['monitorLabel']
      : undefined;

  const position: Settings['flash']['position'] = {
    x: asFiniteNumber(rawPosition['x'], defaults.position.x),
    y: asFiniteNumber(rawPosition['y'], defaults.position.y),
  };
  if (monitorLabel !== undefined) {
    position.monitorLabel = monitorLabel;
  }

  return {
    position,
    opacity: asFiniteNumber(raw['opacity'], defaults.opacity),
  };
}

/**
 * Converte qualquer JSON vindo do disco em Settings válidas:
 * - null/undefined/lixo → defaults completos;
 * - v1 legado (shortcuts.clipboard) → shortcuts.processClipboardFlash;
 * - campos faltantes ou com tipo errado → defaults, por seção;
 * - valores válidos existentes são preservados.
 * Sempre retorna um objeto novo (sem aliasing com defaultSettings).
 */
export function migrate(raw: unknown): Settings {
  const source = isRecord(raw) ? raw : {};

  return {
    version: CURRENT_SETTINGS_VERSION,
    language: migrateLanguage(source['language']),
    theme: asString(source['theme'], defaultSettings.theme),
    shortcuts: migrateShortcuts(source['shortcuts']),
    flash: migrateFlash(source['flash']),
  };
}
