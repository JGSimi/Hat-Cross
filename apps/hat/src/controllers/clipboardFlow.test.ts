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

  it('sala ativa: request leva roomId, roomShare e sourceMessageId', async () => {
    wire({
      getRoomContext: () => ({ roomId: 'room-7', roomShare: true }),
      newSourceMessageId: () => 'src-1',
    });
    bridge.emit('clipboard:captured', { kind: 'text', text: 'pergunta' });
    await vi.waitFor(() => expect(lastStartStream).not.toThrow());

    const req = lastStartStream();
    expect(req.roomId).toBe('room-7');
    expect(req.roomShare).toBe(true);
    expect(req.sourceMessageId).toBe('src-1');
  });

  it('sem sala ativa: nada de roomId/sourceMessageId nem thumbnail', async () => {
    const onRoomImageShared = vi.fn();
    wire({ getRoomContext: () => null, onRoomImageShared });
    bridge.emit('clipboard:captured', { kind: 'image', base64Png: 'PNG' });
    await vi.waitFor(() => expect(lastStartStream).not.toThrow());

    const req = lastStartStream();
    expect(req.roomId).toBeUndefined();
    expect(req.sourceMessageId).toBeUndefined();
    expect(onRoomImageShared).not.toHaveBeenCalled();
  });

  it('imagem + sala: entrega o thumbnail local com o mesmo sourceMessageId', async () => {
    const onRoomImageShared = vi.fn();
    wire({
      getRoomContext: () => ({ roomId: 'room-7', roomShare: true }),
      newSourceMessageId: () => 'src-img',
      onRoomImageShared,
    });
    bridge.emit('clipboard:captured', { kind: 'image', base64Png: 'PNGB64' });
    await vi.waitFor(() => expect(lastStartStream).not.toThrow());

    expect(onRoomImageShared).toHaveBeenCalledOnce();
    expect(onRoomImageShared).toHaveBeenCalledWith('src-img', 'PNGB64');
    expect(lastStartStream().sourceMessageId).toBe('src-img');
  });

  it('texto + sala: não chama onRoomImageShared', async () => {
    const onRoomImageShared = vi.fn();
    wire({
      getRoomContext: () => ({ roomId: 'room-7', roomShare: true }),
      onRoomImageShared,
    });
    bridge.emit('clipboard:captured', { kind: 'text', text: 'pergunta' });
    await vi.waitFor(() => expect(lastStartStream).not.toThrow());
    expect(onRoomImageShared).not.toHaveBeenCalled();
  });

  it('acesso cortado: mostra a despedida no Flash e NÃO inicia stream', async () => {
    wire({ getBlockedMessage: () => 'Sua assinatura terminou — foi bom ter você.' });
    bridge.emit('clipboard:captured', { kind: 'text', text: 'pergunta' });

    await vi.waitFor(() => {
      const flash = bridge.calls.find((c) => c.method === 'flashShowText');
      expect(flash?.args[0]).toBe('Sua assinatura terminou — foi bom ter você.');
    });
    expect(bridge.calls.some((c) => c.method === 'startStream')).toBe(false);
  });

  it('acesso cortado vale também para captura de imagem', async () => {
    const onRoomImageShared = vi.fn();
    wire({
      getBlockedMessage: () => 'bloqueado',
      getRoomContext: () => ({ roomId: 'room-7', roomShare: true }),
      onRoomImageShared,
    });
    bridge.emit('clipboard:captured', { kind: 'image', base64Png: 'PNG' });

    await vi.waitFor(() =>
      expect(bridge.calls.some((c) => c.method === 'flashShowText')).toBe(true),
    );
    expect(bridge.calls.some((c) => c.method === 'startStream')).toBe(false);
    expect(onRoomImageShared).not.toHaveBeenCalled();
  });

  it('getBlockedMessage devolvendo null não bloqueia nada', async () => {
    wire({ getBlockedMessage: () => null });
    bridge.emit('clipboard:captured', { kind: 'text', text: 'pergunta' });
    await vi.waitFor(() => expect(lastStartStream).not.toThrow());
    expect(bridge.calls.some((c) => c.method === 'flashShowText')).toBe(false);
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
