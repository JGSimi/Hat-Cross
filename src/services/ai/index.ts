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
  onChunk: (chunk: StreamChunk) => void;
  onError: (error: string) => void;
  onDone: () => void;
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

  // Listen for stream events
  let unlistenError: (() => void) | null = null;

  const unlisten = await listen<StreamChunk>('chat-stream', (event) => {
    const chunk = event.payload;
    onChunk(chunk);
    if (chunk.isFinished) {
      onDone();
      unlisten();
      unlistenError?.();
    }
  });

  unlistenError = await listen<string>('chat-stream-error', (event) => {
    onError(event.payload);
    unlisten();
    unlistenError?.();
  });

  try {
    await invoke('stream_chat', {
      messages,
      systemPrompt,
      provider,
      endpoint,
      model,
      temperature,
      maxTokens,
      images,
    });
  } catch (e) {
    onError(String(e));
    unlisten();
    unlistenError?.();
  }

  // Return cancel function
  return () => {
    invoke('cancel_stream').catch(() => {});
    unlisten();
    unlistenError?.();
  };
}

export async function cancelStream(): Promise<void> {
  await invoke('cancel_stream');
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
