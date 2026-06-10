import type {
  ClipboardContent,
  FlashPosition,
  NativeEventMap,
  NativeEventName,
  ShortcutBindings,
  StreamRequest,
} from './types';

/**
 * Porta única entre o renderer e o shell nativo. Stores e serviços dependem
 * desta interface — nunca de `@tauri-apps/*` diretamente. Em testes, use
 * `createMockBridge()` de ./mock.
 */
export interface NativeBridge {
  flashHide(): Promise<void>;
  flashEnterAdjustMode(): Promise<void>;
  flashSavePosition(position: FlashPosition): Promise<void>;
  /** Mostra o Flash com um texto arbitrário (correção da sala, sob demanda). */
  flashShowText(text: string): Promise<void>;
  setShortcuts(bindings: ShortcutBindings): Promise<void>;
  startStream(request: StreamRequest): Promise<void>;
  cancelStream(streamId: number): Promise<void>;
  readClipboard(): Promise<ClipboardContent>;
  /** Abre uma URL no navegador do sistema (checkout, assinatura). */
  openExternal(url: string): Promise<void>;
  /** Registra listener; retorna função de unsubscribe. */
  on<E extends NativeEventName>(
    event: E,
    handler: (payload: NativeEventMap[E]) => void,
  ): () => void;
}
