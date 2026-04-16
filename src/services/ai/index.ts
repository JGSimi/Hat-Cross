import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { ConversationTurn, StreamChunk } from '../../types';
import type { AIMode } from '../../types/account';

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
    onChunk(chunk);
    if (chunk.isFinished) {
      onDone();
      cleanup();
    }
  });

  unlistenError = await listen<string>('chat-stream-error', (event) => {
    onError(event.payload);
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
  }).catch((e) => {
    if (done) return;
    onError(String(e));
    cleanup();
  });

  return () => {
    invoke('cancel_stream', { streamId }).catch(() => {});
    cleanup();
  };
}
