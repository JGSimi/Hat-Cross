import type { NativeBridge } from './native';
import type {
  ClipboardContent,
  FlashAppearance,
  NativeEventMap,
  NativeEventName,
  ShortcutBindings,
} from './types';

const DEFAULT_APPEARANCE: FlashAppearance = {
  opacity: 16,
  background: true,
  bgColor: '#090908',
  textColor: '#f6f6f4',
};

const DEFAULT_BINDINGS: ShortcutBindings = {
  processClipboardFlash: 'CommandOrControl+Shift+F',
  adjustFlashPosition: 'CommandOrControl+Alt+F',
  emergencyQuit: 'CommandOrControl+Shift+Q',
  showCorrection: 'CommandOrControl+Shift+D',
  toggleGabarito: 'CommandOrControl+Shift+G',
};

export interface MockBridge extends NativeBridge {
  /** Histórico de chamadas, por método. */
  calls: { method: string; args: unknown[] }[];
  /** Emite um evento nativo falso para os listeners registrados. */
  emit<E extends NativeEventName>(event: E, payload: NativeEventMap[E]): void;
  /** Define o que readClipboard() devolve. */
  setClipboard(content: ClipboardContent): void;
}

export function createMockBridge(): MockBridge {
  const listeners = new Map<string, Set<(payload: never) => void>>();
  let clipboard: ClipboardContent = { kind: 'empty' };
  const calls: { method: string; args: unknown[] }[] = [];

  const record =
    <A extends unknown[]>(method: string) =>
    (...args: A): Promise<void> => {
      calls.push({ method, args });
      return Promise.resolve();
    };

  return {
    calls,
    flashHide: record('flashHide'),
    flashEnterAdjustMode: record('flashEnterAdjustMode'),
    flashSavePosition: record('flashSavePosition'),
    flashShowText: record('flashShowText'),
    gabaritoShow: record('gabaritoShow'),
    gabaritoHide: record('gabaritoHide'),
    setShortcuts: record('setShortcuts'),
    getShortcuts: () => {
      calls.push({ method: 'getShortcuts', args: [] });
      return Promise.resolve({ ...DEFAULT_BINDINGS });
    },
    getFlashAppearance: () => {
      calls.push({ method: 'getFlashAppearance', args: [] });
      return Promise.resolve({ ...DEFAULT_APPEARANCE });
    },
    setFlashAppearance: record('setFlashAppearance'),
    checkForUpdate: () => {
      calls.push({ method: 'checkForUpdate', args: [] });
      return Promise.resolve({ status: 'uptodate' as const });
    },
    getAppVersion: () => {
      calls.push({ method: 'getAppVersion', args: [] });
      return Promise.resolve('0.0.0-test');
    },
    startStream: record('startStream'),
    cancelStream: record('cancelStream'),
    readClipboard: () => {
      calls.push({ method: 'readClipboard', args: [] });
      return Promise.resolve(clipboard);
    },
    openExternal: record('openExternal'),
    setClipboard: (content) => {
      clipboard = content;
    },
    writeClipboard: record('writeClipboard'),
    flashResize: record('flashResize'),
    on: (event, handler) => {
      const set = listeners.get(event) ?? new Set();
      set.add(handler as (payload: never) => void);
      listeners.set(event, set);
      return () => {
        set.delete(handler as (payload: never) => void);
      };
    },
    emit: (event, payload) => {
      for (const handler of listeners.get(event) ?? []) {
        (handler as (p: unknown) => void)(payload);
      }
    },
  };
}
