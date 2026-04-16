import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { ConversationTurn, StreamChunk, CloudProvider } from '../../types';

export interface StreamOptions {
  messages: ConversationTurn[];
  systemPrompt: string;
  provider: CloudProvider | 'ollama';
  endpoint: string;
  model: string;
  temperature: number;
  maxTokens: number;
  images?: string[];
  thinkingEnabled?: boolean;
  thinkingBudget?: number;
  onChunk: (chunk: StreamChunk) => void;
  onError: (error: string) => void;
  onDone: () => void;
}

// Monotonic counter for stream IDs. The backend uses this to route cancel
// requests to the correct stream and to tag emitted chunks so concurrent
// streams never cross-contaminate each other's listeners.
let _nextStreamId = 1;
export function nextStreamId(): number {
  return _nextStreamId++;
}

export async function startStream(options: StreamOptions): Promise<() => void> {
  const {
    messages,
    systemPrompt,
    provider,
    endpoint,
    model,
    temperature,
    maxTokens,
    images = [],
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
    // Filter by streamId so concurrent streams don't cross-feed each other.
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

  // Fire the invoke WITHOUT awaiting — stream_chat only resolves when the
  // whole stream completes, and we need to return the cancel function
  // immediately so the UI can cancel mid-stream.
  invoke('stream_chat', {
    streamId,
    messages,
    systemPrompt,
    provider,
    endpoint,
    model,
    temperature,
    maxTokens,
    images,
    thinkingEnabled: options.thinkingEnabled ?? false,
    thinkingBudget: options.thinkingBudget ?? 10000,
  }).catch((e) => {
    // Backend error (connection, HTTP status, etc.) — surface to caller.
    if (done) return;
    onError(String(e));
    cleanup();
  });

  // Cancel function: set the backend flag and tear down listeners.
  return () => {
    invoke('cancel_stream', { streamId }).catch(() => {});
    cleanup();
  };
}

export async function cancelStream(streamId: number): Promise<void> {
  await invoke('cancel_stream', { streamId });
}

export async function fetchModels(
  provider: CloudProvider,
  endpoint: string,
): Promise<string[]> {
  try {
    const models = await invoke<string[]>('fetch_models', {
      provider,
      endpoint,
    });
    return models;
  } catch {
    return [];
  }
}
