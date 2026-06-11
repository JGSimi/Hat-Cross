// Contratos de IPC entre o shell nativo (Rust) e o renderer.
// Espelham os payloads emitidos/aceitos em src-tauri/src/*.rs.

export type StreamContentType = 'text' | 'thinking';

export interface StreamChunkPayload {
  streamId: number;
  text: string;
  isFinished: boolean;
  inputTokens?: number;
  outputTokens?: number;
  contentType: StreamContentType;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  textContent: string;
  /** base64 PNG, sem prefixo data: */
  images?: string[];
}

export interface StreamRequest {
  streamId: number;
  messages: ConversationTurn[];
  systemPrompt: string;
  mode: 'hat' | 'hat-pro';
  temperature: number;
  maxTokens: number;
  images: string[];
  roomId?: string;
  roomShare?: boolean;
  sourceMessageId?: string;
  idToken: string;
  idempotencyKey: string;
}

export interface FlashPosition {
  x: number;
  y: number;
  monitorLabel?: string;
}

export type FlashState = 'processing' | 'answer' | 'error';

export interface FlashAppearance {
  /** 0–100. Opacidade do card (stealth: baixíssima por padrão). */
  opacity: number;
  /** Desenhar fundo do card? Se false, só o texto aparece. */
  background: boolean;
  /** Cor do fundo (hex). */
  bgColor: string;
  /** Cor do texto (hex). */
  textColor: string;
}

export interface FlashShowPayload extends Partial<FlashAppearance> {
  state: FlashState;
  text: string;
  position: FlashPosition;
}

export interface UpdateCheck {
  status: 'uptodate' | 'updated' | 'error';
  version?: string | null;
  message?: string | null;
}

export type ClipboardContent =
  | { kind: 'text'; text: string }
  | { kind: 'image'; base64Png: string }
  | { kind: 'empty' };

export interface ShortcutBindings {
  processClipboardFlash: string;
  adjustFlashPosition: string;
  emergencyQuit: string;
  /** Mostra a próxima correção da sala no Flash, sob demanda. */
  showCorrection: string;
}

export type NativeEventMap = {
  'flash:show': FlashShowPayload;
  'flash:hide': void;
  'flash:adjust-mode': void;
  'stream:chunk': StreamChunkPayload;
  /** Conteúdo lido pelo atalho global; a janela main dispara o stream. */
  'clipboard:captured': ClipboardContent;
  'clipboard:failed': { reason: string };
  /** Atalho global pediu a próxima correção da sala no Flash. */
  'shortcut:show-correction': void;
  'shortcut:registration-failed': { binding: string; code: string };
  'settings:changed': void;
};

export type NativeEventName = keyof NativeEventMap;
