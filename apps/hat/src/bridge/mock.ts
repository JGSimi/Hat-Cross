import type { NativeBridge } from './native';
import type {
  ClipboardContent,
  NativeEventMap,
  NativeEventName,
} from './types';

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
    setShortcuts: record('setShortcuts'),
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
