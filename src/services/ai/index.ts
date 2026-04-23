import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { ConversationTurn, StreamChunk } from '../../types';
import type { AIMode } from '../../types/account';
import i18n from '../../i18n';
import { classifyError } from '../../lib/errors/classifyError';
import { NON_RETRYABLE, type ErrorKind } from '../../lib/errors/ErrorKind';
import { withRetry } from '../../lib/errors/withRetry';

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
  /**
   * Fires between attempts when the stream is being auto-retried.
   * `attempt` is the NEXT attempt about to run (2, 3, …). Use it to
   * surface "Tentando de novo ({attempt}/3)…" in the chat UI so the
   * user knows Hat isn't frozen, just negotiating with a flaky upstream.
   */
  onRetry?: (kind: ErrorKind, attempt: number) => void;
}

function isAborted(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === 'AbortError' || err.message === 'aborted')
  );
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
    onRetry,
  } = options;

  // One controller per startHatStream call — aborts the current
  // attempt's Tauri invoke AND any ongoing backoff sleep inside
  // `withRetry`. That keeps the user's "stop" button responsive
  // even while we're waiting to retry a transient 5xx.
  const controller = new AbortController();

  // If ANY attempt streamed real content to the UI, we must not retry
  // — a second attempt would duplicate the assistant message. Confined
  // to genuine `text` chunks (not the synthetic `error:*` strings).
  let anyAttemptReceivedContent = false;
  let currentCancelAttempt: (() => void) | null = null;

  const runOnce = () =>
    new Promise<void>((resolve, reject) => {
      const streamId = nextStreamId();
      let finished = false;
      let unlisten: () => void = () => {};
      let unlistenError: () => void = () => {};

      const localCleanup = () => {
        if (finished) return;
        finished = true;
        unlisten();
        unlistenError();
      };

      currentCancelAttempt = () => {
        invoke('cancel_stream', { streamId }).catch(() => {});
        localCleanup();
        reject(new Error('aborted'));
      };

      (async () => {
        try {
          unlisten = await listen<StreamChunk>('chat-stream', (event) => {
            const chunk = event.payload;
            if (chunk.streamId !== streamId) return;

            // Rust emits transport errors on the same channel —
            // route before anything else so they never become content.
            if (chunk.text && chunk.text.startsWith('error:')) {
              localCleanup();
              reject(new Error(chunk.text));
              return;
            }

            if (chunk.text) anyAttemptReceivedContent = true;
            onChunk(chunk);
            if (chunk.isFinished) {
              localCleanup();
              resolve();
            }
          });

          unlistenError = await listen<string>('chat-stream-error', (event) => {
            localCleanup();
            reject(new Error(event.payload));
          });

          if (controller.signal.aborted) {
            localCleanup();
            reject(new Error('aborted'));
            return;
          }

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
            localCleanup();
            reject(e);
          });
        } catch (listenerErr) {
          localCleanup();
          reject(listenerErr);
        }
      })();
    });

  // Fire and forget — the caller already has the cancel fn back.
  (async () => {
    try {
      await withRetry(runOnce, {
        maxAttempts: 3,
        baseDelayMs: 800,
        maxDelayMs: 4000,
        signal: controller.signal,
        shouldRetry: (err) => {
          if (isAborted(err)) return false;
          // Once content has been streamed, retrying would duplicate
          // the assistant output — hard-stop.
          if (anyAttemptReceivedContent) return false;
          const kind = classifyError(err);
          return !NON_RETRYABLE.has(kind);
        },
        onRetry: (err, attempt) => {
          // `attempt` is the attempt that just failed; tell the caller
          // about the NEXT one (2, 3, …) so the UI copy lines up with
          // what the user will see.
          onRetry?.(classifyError(err), attempt + 1);
        },
      });
      onDone();
    } catch (err) {
      if (isAborted(err)) return;
      onError(sanitizeBackendError(err));
    }
  })();

  return () => {
    controller.abort();
    currentCancelAttempt?.();
  };
}
