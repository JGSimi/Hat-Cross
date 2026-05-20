import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../bridge/hat', () => ({
  hat: {
    settings: {
      get: vi.fn(async () => ({ shortcuts: { clipboard: 'CommandOrControl+Shift+X' } })),
      save: vi.fn(async () => undefined),
    },
    shortcuts: {
      register: vi.fn(async () => undefined),
    },
  },
}));

import { useHatStore } from './hatStore';

describe('hatStore', () => {
  beforeEach(() => {
    useHatStore.setState({
      response: '',
      thinking: '',
      streamID: 1,
      clipboardText: '',
      clipboardImage: null,
    });
  });

  it('keeps stream chunks scoped to the active stream', () => {
    useHatStore.getState().addStreamChunk({
      streamId: 2,
      text: 'ignore',
      isFinished: false,
      inputTokens: null,
      outputTokens: null,
      contentType: 'text',
    });
    expect(useHatStore.getState().response).toBe('');

    useHatStore.getState().addStreamChunk({
      streamId: 1,
      text: 'ok',
      isFinished: false,
      inputTokens: null,
      outputTokens: null,
      contentType: 'text',
    });
    expect(useHatStore.getState().response).toBe('ok');
  });

  it('separates thinking chunks from visible response text', () => {
    useHatStore.getState().addStreamChunk({
      streamId: 1,
      text: 'plan',
      isFinished: false,
      inputTokens: null,
      outputTokens: null,
      contentType: 'thinking',
    });

    expect(useHatStore.getState().thinking).toBe('plan');
    expect(useHatStore.getState().response).toBe('');
  });

  it('loads a saved chat snapshot into the active view', () => {
    useHatStore.setState({ thinking: 'old', clipboardImage: 'data:image/png;base64,old' });

    useHatStore.getState().loadSnapshot('pergunta antiga', 'resposta antiga');

    expect(useHatStore.getState().clipboardText).toBe('pergunta antiga');
    expect(useHatStore.getState().clipboardImage).toBeNull();
    expect(useHatStore.getState().response).toBe('resposta antiga');
    expect(useHatStore.getState().thinking).toBe('');
  });
});
