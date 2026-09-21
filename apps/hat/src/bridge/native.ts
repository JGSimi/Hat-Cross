import type {
  ClipboardContent,
  FlashAppearance,
  FlashPosition,
  GabaritoItem,
  NativeEventMap,
  NativeEventName,
  ShortcutBindings,
  StreamRequest,
  ScreenCapture,
  UpdateCheck,
} from './types';

/**
 * Porta única entre o renderer e o shell nativo. Stores e serviços dependem
 * desta interface — nunca de `@tauri-apps/*` diretamente. Em testes, use
 * `createMockBridge()` de ./mock.
 */
export interface NativeBridge {
  getCaptureProtection(): Promise<boolean>;
  setCaptureProtection(enabled: boolean): Promise<void>;
  flashHide(): Promise<void>;
  flashEnterAdjustMode(): Promise<void>;
  flashSavePosition(position: FlashPosition): Promise<void>;
  getFlashPosition(): Promise<FlashPosition>;
  /** Mostra o Flash com um texto arbitrário (correção da sala, sob demanda). */
  flashShowText(text: string): Promise<void>;
  /** Mostra feedback persistente de progresso até nova atualização/hide. */
  flashShowProgress(text: string): Promise<void>;
  /** Mostra o gabarito (overlay abaixo do flash) com os itens dados. */
  gabaritoShow(items: GabaritoItem[]): Promise<void>;
  gabaritoHide(): Promise<void>;
  setShortcuts(bindings: ShortcutBindings): Promise<void>;
  getShortcuts(): Promise<ShortcutBindings>;
  getFlashAppearance(): Promise<FlashAppearance>;
  setFlashAppearance(appearance: FlashAppearance): Promise<void>;
  /** Verifica/instala atualização sob demanda (aplica no próximo start). */
  checkForUpdate(): Promise<UpdateCheck>;
  /** Reinicia o app para aplicar a atualização já baixada (não retorna). */
  relaunchApp(): Promise<void>;
  /** Versão do app (ex.: "2.0.0"). */
  getAppVersion(): Promise<string>;
  startStream(request: StreamRequest): Promise<void>;
  /** Executa o mesmo stream do backend sem emitir chunks para o Flash. Beta only. */
  completeStream(request: StreamRequest): Promise<string>;
  requestAccessibility(): Promise<boolean>;
  captureScreen(): Promise<ScreenCapture>;
  clickScreen(x: number, y: number): Promise<void>;
  pasteScreenText(x: number, y: number, text: string): Promise<void>;
  cancelStream(streamId: number): Promise<void>;
  readClipboard(): Promise<ClipboardContent>;
  /** Escreve texto no clipboard (resposta da IA, para colar). */
  writeClipboard(text: string): Promise<void>;
  /** Ajusta a altura da janela do flash ao conteúdo. */
  flashResize(height: number): Promise<void>;
  /** Abre uma URL no navegador do sistema (checkout, assinatura). */
  openExternal(url: string): Promise<void>;
  /** Registra listener; retorna função de unsubscribe. */
  on<E extends NativeEventName>(
    event: E,
    handler: (payload: NativeEventMap[E]) => void,
  ): () => void;
}
