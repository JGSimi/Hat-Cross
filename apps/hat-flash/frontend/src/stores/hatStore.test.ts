import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  save: vi.fn(async () => undefined),
  register: vi.fn(async () => undefined),
}));

vi.mock('../bridge/hat', () => ({
  hat: {
    settings: {
      get: vi.fn(async () => ({ shortcuts: { processClipboardFlash: 'CommandOrControl+Shift+X' } })),
      save: mocks.save,
    },
    shortcuts: {
      register: mocks.register,
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
    mocks.save.mockClear();
    mocks.register.mockReset();
    mocks.register.mockResolvedValue(undefined);
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

  it('does not save shortcut settings when native registration fails', async () => {
    const settings = {
      shortcuts: {
        processClipboardFlash: 'CommandOrControl+Shift+F',
        adjustFlashPosition: 'CommandOrControl+Alt+F',
        emergencyQuit: 'CommandOrControl+Shift+Q',
      },
    };
    mocks.register.mockRejectedValue(new Error('shortcut already in use'));

    await expect(useHatStore.getState().saveSettings(settings as never)).rejects.toThrow('shortcut already in use');

    expect(mocks.save).not.toHaveBeenCalled();
    expect(useHatStore.getState().settings).toBeNull();
  });
});
