import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getVersion } from '@tauri-apps/api/app';
import type { NativeBridge } from './native';
import type { NativeEventMap, NativeEventName } from './types';

/**
 * Implementação real da NativeBridge sobre Tauri. Adapter fino por regra de
 * arquitetura: nenhuma lógica condicional aqui — só tradução de chamadas.
 */
export function createTauriBridge(): NativeBridge {
  return {
    flashHide: () => invoke('flash_hide'),
    flashEnterAdjustMode: () => invoke('flash_enter_adjust_mode'),
    flashSavePosition: (position) => invoke('flash_save_position', { position }),
    flashShowText: (text) => invoke('flash_show_text', { text }),
    setShortcuts: (bindings) => invoke('set_shortcuts', { bindings }),
    getShortcuts: () => invoke('get_shortcuts'),
    getFlashAppearance: () => invoke('get_flash_appearance'),
    setFlashAppearance: (appearance) => invoke('set_flash_appearance', { appearance }),
    checkForUpdate: () => invoke('check_for_update'),
    getAppVersion: () => getVersion(),
    startStream: (request) => invoke('start_stream', { request }),
    cancelStream: (streamId) => invoke('cancel_stream', { streamId }),
    readClipboard: () => invoke('read_clipboard'),
    openExternal: (url) => invoke('open_external', { url }),
    on: <E extends NativeEventName>(
      event: E,
      handler: (payload: NativeEventMap[E]) => void,
    ) => {
      const unlisten = listen<NativeEventMap[E]>(event, (e) => handler(e.payload));
      return () => {
        void unlisten.then((fn) => fn());
      };
    },
  };
}
