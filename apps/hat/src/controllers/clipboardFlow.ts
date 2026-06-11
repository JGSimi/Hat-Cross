// Orquestrador do caminho quente, na janela main: o atalho global (Rust) lê
// o clipboard e emite 'clipboard:captured'; aqui montamos o StreamRequest com
// o token de auth e disparamos o stream. O Rust streama de volta via
// 'stream:chunk', que a FlashPage consome. Auth/token vivem na main porque é
// a janela com sessão Firebase — a flash é só display.
//
// Testável de ponta a ponta com o MockBridge (sem Tauri).

import type { NativeBridge } from '../bridge/native';
import type {
  ClipboardContent,
  ConversationTurn,
  StreamRequest,
} from '../bridge/types';

export interface RoomContext {
  roomId: string;
  roomShare: boolean;
}

export interface ClipboardFlowDeps {
  bridge: NativeBridge;
  /** Token Firebase fresco; deve refrescar proativamente (gap do legado). */
  getIdToken: () => Promise<string>;
  newStreamId: () => number;
  newIdempotencyKey: () => string;
  systemPrompt?: string;
  mode?: 'hat' | 'hat-pro';
  temperature?: number;
  maxTokens?: number;
  /** Instrução usada quando o clipboard é uma imagem (sem texto). */
  imagePrompt?: string;
  /**
   * Sala ativa no momento da captura — quando presente com roomShare,
   * a resposta vira entry compartilhada na sala (núcleo do produto).
   * Lido a cada captura (não no setup) para refletir a sala atual.
   */
  getRoomContext?: () => RoomContext | null;
  /** Reporta falhas (auth, build do request) para a UI. */
  onError?: (error: unknown) => void;
}

// A resposta aparece num overlay PEQUENO e discreto. Regras de formato pensadas
// para leitura rápida (e economia de tokens):
// - múltipla escolha → só a letra + início curto da alternativa ("B) ...");
// - dissertativa → texto humano, corrido, direto, sem markdown.
const DEFAULT_SYSTEM_PROMPT = [
  'Você responde questões que aparecem num overlay pequeno; a pessoa precisa',
  'ler a resposta numa olhada. Responda em português do Brasil.',
  'Se for questão de múltipla escolha (tem alternativas A, B, C…), responda',
  'APENAS com a letra correta seguida do começo curto da alternativa, ex.:',
  '"B) início da alternativa". Nada além disso.',
  'Se for dissertativa/aberta, responda em texto corrido, humano e direto, no',
  'máximo 3 frases curtas. NUNCA use markdown (sem **negrito**, listas, títulos,',
  'blocos de código ou emojis). Seja o mais conciso possível.',
].join(' ');
const DEFAULT_IMAGE_PROMPT =
  'Resolva a questão desta imagem seguindo as regras de formato (múltipla escolha: só a letra e início curto; dissertativa: texto humano curto, sem markdown).';

/**
 * Monta as mensagens a partir do conteúdo do clipboard. Imagem vai em
 * request.images (o Rust a combina no último turno); o turno carrega só a
 * instrução textual para não duplicar o payload base64.
 */
export function buildStreamMessages(
  content: ClipboardContent,
  imagePrompt: string,
): { messages: ConversationTurn[]; images: string[] } | null {
  if (content.kind === 'text') {
    return {
      messages: [{ role: 'user', textContent: content.text, images: [] }],
      images: [],
    };
  }
  if (content.kind === 'image') {
    return {
      messages: [{ role: 'user', textContent: imagePrompt, images: [] }],
      images: [content.base64Png],
    };
  }
  return null; // 'empty' nunca deveria chegar aqui
}

/**
 * Registra o listener de 'clipboard:captured' e devolve uma função de
 * unsubscribe. Cada captura gera streamId + Idempotency-Key próprios.
 */
export function startClipboardFlow(deps: ClipboardFlowDeps): () => void {
  const imagePrompt = deps.imagePrompt ?? DEFAULT_IMAGE_PROMPT;

  return deps.bridge.on('clipboard:captured', (content) => {
    const built = buildStreamMessages(content, imagePrompt);
    if (built === null) return;

    void (async () => {
      try {
        const idToken = await deps.getIdToken();
        const room = deps.getRoomContext?.() ?? null;
        const request: StreamRequest = {
          streamId: deps.newStreamId(),
          messages: built.messages,
          systemPrompt: deps.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
          mode: deps.mode ?? 'hat',
          temperature: deps.temperature ?? 0.7,
          maxTokens: deps.maxTokens ?? 2048,
          images: built.images,
          idToken,
          idempotencyKey: deps.newIdempotencyKey(),
          ...(room && room.roomShare && room.roomId
            ? { roomId: room.roomId, roomShare: true }
            : {}),
        };
        await deps.bridge.startStream(request);
      } catch (error) {
        deps.onError?.(error);
      }
    })();
  });
}
