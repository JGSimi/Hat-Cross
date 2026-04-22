import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { ConversationTurn, StreamChunk } from '../../types';
import type { AIMode } from '../../types/account';
import i18n from '../../i18n';
import { classifyError } from '../../lib/errors/classifyError';

/**
 * Resolve raw backend error strings (wire protocol: `error:<code>:<...>`)
 * or any thrown value into a user-safe title + body pair.
 *
 * Safety contract: **NEVER** returns the raw wire string. Reported
 * 2026-04-23 that a failure was leaking
 *   `error:serverError:500:Gemini 503: { ... }`
 * into a chat bubble — that reveals the upstream model name, HTTP
 * status, and JSON shape, all of which are branding + UX leaks. The
 * fix maps every possible input to an `ErrorKind` and pulls copy from
 * the `errors.json` namespace, with a typed fallback to `unknown`.
 */
export function sanitizeBackendError(raw: unknown): string {
  const kind = classifyError(raw);
  const title = i18n.t(`errors:${kind}.title`, {
    defaultValue: i18n.t('errors:unknown.title', {
      defaultValue: 'Erro inesperado',
    }),
  });
  return title;
}

// Monotonic counter for stream IDs. The backend uses this to route cancel
// requests to the correct stream and to tag emitted chunks so concurrent
// streams never cross-contaminate each other's listeners.
let _nextStreamId = 1;
export function nextStreamId(): number {
  return _nextStreamId++;
}

export async function cancelStream(streamId: number): Promise<void> {
  await invoke('cancel_stream', { streamId });
}

// ----- Hat proxy (credits-based) streaming -----
//
// Post-BYOK, this is the only path to an LLM. Every call must carry a
// Firebase ID token; the Worker validates it, debits credits, and proxies
// the request to Gemini on our server-side key.

export interface HatStreamOptions {
  messages: ConversationTurn[];
  systemPrompt: string;
  mode: AIMode;
  temperature: number;
  maxTokens: number;
  images?: string[];
  idToken: string;
  onChunk: (chunk: StreamChunk) => void;
  onError: (error: string) => void;
  onDone: () => void;
}

export async function startHatStream(options: HatStreamOptions): Promise<() => void> {
  const {
    messages,
    systemPrompt,
    mode,
    temperature,
    maxTokens,
    images = [],
    idToken,
    onChunk,
    onError,
    onDone,
  } = options;

  const streamId = nextStreamId();

  let unlistenError: (() => void) | null = null;
  let done = false;

  const cleanup = () => {
    if (done) return;
    done = true;
    unlisten();
    unlistenError?.();
  };

  const unlisten = await listen<StreamChunk>('chat-stream', (event) => {
    const chunk = event.payload;
    if (chunk.streamId !== streamId) return;

    // Rust side emits transport/HTTP errors on the same channel as
    // chunks, with `text: "error:<code>:..."` and `isFinished: true`.
    // Route those to onError so they never land as assistant content —
    // that was the 2026-04-23 bubble-leak bug.
    if (chunk.text && chunk.text.startsWith('error:')) {
      onError(sanitizeBackendError(chunk.text));
      cleanup();
      return;
    }

    onChunk(chunk);
    if (chunk.isFinished) {
      onDone();
      cleanup();
    }
  });

  unlistenError = await listen<string>('chat-stream-error', (event) => {
    onError(sanitizeBackendError(event.payload));
    cleanup();
  });

  invoke('stream_chat_hat', {
    streamId,
    messages,
    systemPrompt,
    mode,
    temperature,
    maxTokens,
    images,
    idToken,
    idempotencyKey: crypto.randomUUID(),
  }).catch((e) => {
    if (done) return;
    onError(sanitizeBackendError(e));
    cleanup();
  });

  return () => {
    invoke('cancel_stream', { streamId }).catch(() => {});
    cleanup();
  };
}
