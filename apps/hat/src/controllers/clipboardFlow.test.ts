import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockBridge, type MockBridge } from '../bridge/mock';
import type { StreamRequest } from '../bridge/types';
import { buildStreamMessages, startClipboardFlow } from './clipboardFlow';

describe('buildStreamMessages', () => {
  it('texto vira um turno de usuário, sem imagens', () => {
    const built = buildStreamMessages({ kind: 'text', text: 'oi' }, 'IMG');
    expect(built).toEqual({
      messages: [{ role: 'user', textContent: 'oi', images: [] }],
      images: [],
    });
  });

  it('imagem vai em images[], turno carrega só a instrução', () => {
    const built = buildStreamMessages(
      { kind: 'image', base64Png: 'AAAA' },
      'descreva',
    );
    expect(built).toEqual({
      messages: [{ role: 'user', textContent: 'descreva', images: [] }],
      images: ['AAAA'],
    });
  });

  it('empty retorna null', () => {
    expect(buildStreamMessages({ kind: 'empty' }, 'IMG')).toBeNull();
  });
});

describe('startClipboardFlow', () => {
  let bridge: MockBridge;
  let ids: number[];
  let keys: string[];

  function lastStartStream(): StreamRequest {
    const call = [...bridge.calls].reverse().find((c) => c.method === 'startStream');
    if (!call) throw new Error('startStream não foi chamado');
    return call.args[0] as StreamRequest;
  }

  beforeEach(() => {
    bridge = createMockBridge();
    ids = [101, 102];
    keys = ['key-a', 'key-b'];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function wire(overrides: Partial<Parameters<typeof startClipboardFlow>[0]> = {}) {
    return startClipboardFlow({
      bridge,
      getIdToken: () => Promise.resolve('tok'),
      newStreamId: () => ids.shift() ?? 999,
      newIdempotencyKey: () => keys.shift() ?? 'key-z',
      ...overrides,
    });
  }

  it('captura de texto dispara startStream com o token e a mensagem', async () => {
    wire();
    bridge.emit('clipboard:captured', { kind: 'text', text: 'pergunta' });
    await vi.waitFor(() => expect(lastStartStream).not.toThrow());

    const req = lastStartStream();
    expect(req.idToken).toBe('tok');
    expect(req.streamId).toBe(101);
    expect(req.idempotencyKey).toBe('key-a');
    expect(req.mode).toBe('hat');
    expect(req.messages).toEqual([
      { role: 'user', textContent: 'pergunta', images: [] },
    ]);
    expect(req.images).toEqual([]);
  });

  it('captura de imagem manda base64 em images[]', async () => {
    wire();
    bridge.emit('clipboard:captured', { kind: 'image', base64Png: 'PNGB64' });
    await vi.waitFor(() => expect(lastStartStream).not.toThrow());

    const req = lastStartStream();
    expect(req.images).toEqual(['PNGB64']);
    expect(req.messages[0]?.images).toEqual([]);
  });

  it('cada captura gera streamId e Idempotency-Key novos', async () => {
    wire();
    bridge.emit('clipboard:captured', { kind: 'text', text: 'a' });
    bridge.emit('clipboard:captured', { kind: 'text', text: 'b' });
    await vi.waitFor(() => {
      const starts = bridge.calls.filter((c) => c.method === 'startStream');
      expect(starts).toHaveLength(2);
    });
    const starts = bridge.calls
      .filter((c) => c.method === 'startStream')
      .map((c) => c.args[0] as StreamRequest);
    expect(starts.map((r) => r.streamId)).toEqual([101, 102]);
    expect(starts.map((r) => r.idempotencyKey)).toEqual(['key-a', 'key-b']);
  });

  it('clipboard vazio não dispara stream', async () => {
    wire();
    bridge.emit('clipboard:captured', { kind: 'empty' });
    await Promise.resolve();
    expect(bridge.calls.some((c) => c.method === 'startStream')).toBe(false);
  });

  it('falha de auth chama onError e não derruba o fluxo', async () => {
    const onError = vi.fn();
    wire({ getIdToken: () => Promise.reject(new Error('401')), onError });
    bridge.emit('clipboard:captured', { kind: 'text', text: 'x' });
    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
    expect(bridge.calls.some((c) => c.method === 'startStream')).toBe(false);
  });

  it('unsubscribe para de reagir a novas capturas', async () => {
    const off = wire();
    off();
    bridge.emit('clipboard:captured', { kind: 'text', text: 'x' });
    await Promise.resolve();
    expect(bridge.calls.some((c) => c.method === 'startStream')).toBe(false);
  });

  it('respeita mode/systemPrompt/imagePrompt customizados', async () => {
    wire({ mode: 'hat-pro', systemPrompt: 'SP', imagePrompt: 'IP' });
    bridge.emit('clipboard:captured', { kind: 'image', base64Png: 'B' });
    await vi.waitFor(() => expect(lastStartStream).not.toThrow());
    const req = lastStartStream();
    expect(req.mode).toBe('hat-pro');
    expect(req.systemPrompt).toBe('SP');
    expect(req.messages[0]?.textContent).toBe('IP');
  });
});
