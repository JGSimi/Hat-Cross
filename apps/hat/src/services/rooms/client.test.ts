import { describe, expect, it, vi } from 'vitest';

import { createRoomsClient } from './client';

interface RecordedCall {
  url: string;
  method: string | undefined;
  headers: Record<string, string>;
  body: string | undefined;
}

function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * fetch fake: consome a fila `script` (Response ou Error) a cada chamada e
 * registra url/método/headers/body para asserções.
 */
function makeFetchFake(script: Array<Response | Error>) {
  const calls: RecordedCall[] = [];
  const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method,
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === 'string' ? init.body : undefined,
    });
    const next = script.shift();
    if (next === undefined) throw new Error('fetch fake: fila de respostas vazia');
    if (next instanceof Error) throw next;
    return next;
  });
  return { fetchFn: fetchFn as unknown as typeof fetch, calls };
}

function makeClient(script: Array<Response | Error>, uuids: string[] = ['uuid-1', 'uuid-2']) {
  const { fetchFn, calls } = makeFetchFake(script);
  const getIdToken = vi.fn(async () => 'token-123');
  let uuidIndex = 0;
  const randomUUID = vi.fn(() => uuids[uuidIndex++] ?? `uuid-extra-${uuidIndex}`);
  const client = createRoomsClient({
    baseUrl: 'https://proxy.test',
    getIdToken,
    fetchFn,
    randomUUID,
  });
  return { client, calls, getIdToken, randomUUID };
}

describe('createRoomsClient.joinRoom', () => {
  it('envia POST para /v1/rooms/{id}/join com Bearer token e Idempotency-Key', async () => {
    const { client, calls } = makeClient([jsonResponse(200, { id: 'room-1' })]);

    await client.joinRoom('room-1');

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe('https://proxy.test/v1/rooms/room-1/join');
    expect(call.method).toBe('POST');
    expect(call.headers['Authorization']).toBe('Bearer token-123');
    expect(call.headers['Idempotency-Key']).toBe('uuid-1');
  });

  it('faz retry em 5xx reusando a MESMA Idempotency-Key', async () => {
    const { client, calls } = makeClient([
      jsonResponse(500),
      jsonResponse(200, { id: 'room-1' }),
    ]);

    await client.joinRoom('room-1');

    expect(calls).toHaveLength(2);
    expect(calls[0]!.headers['Idempotency-Key']).toBe('uuid-1');
    expect(calls[1]!.headers['Idempotency-Key']).toBe('uuid-1');
  });

  it('faz retry em erro de rede reusando a mesma Idempotency-Key', async () => {
    const { client, calls } = makeClient([
      new TypeError('network down'),
      jsonResponse(200, { id: 'room-1' }),
    ]);

    await client.joinRoom('room-1');

    expect(calls).toHaveLength(2);
    expect(calls[0]!.headers['Idempotency-Key']).toBe('uuid-1');
    expect(calls[1]!.headers['Idempotency-Key']).toBe('uuid-1');
  });

  it('desiste após no máximo 2 retries (3 tentativas) em 5xx persistente', async () => {
    const { client, calls } = makeClient([
      jsonResponse(500),
      jsonResponse(502),
      jsonResponse(503),
      jsonResponse(200),
    ]);

    await expect(client.joinRoom('room-1')).rejects.toMatchObject({ code: 'roomError' });
    expect(calls).toHaveLength(3);
  });

  it('402 vira erro com code insufficientCredits e não faz retry', async () => {
    const { client, calls } = makeClient([jsonResponse(402), jsonResponse(200)]);

    await expect(client.joinRoom('room-1')).rejects.toMatchObject({
      code: 'insufficientCredits',
    });
    expect(calls).toHaveLength(1);
  });

  it('401 vira erro com code sessionExpired', async () => {
    const { client } = makeClient([jsonResponse(401)]);

    await expect(client.joinRoom('room-1')).rejects.toMatchObject({ code: 'sessionExpired' });
  });

  it('404 vira notFound sem retry', async () => {
    const { client, calls } = makeClient([jsonResponse(404), jsonResponse(200)]);

    await expect(client.joinRoom('room-1')).rejects.toMatchObject({ code: 'notFound' });
    expect(calls).toHaveLength(1);
  });

  it('outros 4xx viram roomError sem retry', async () => {
    const { client, calls } = makeClient([jsonResponse(403), jsonResponse(200)]);

    await expect(client.joinRoom('room-1')).rejects.toMatchObject({ code: 'roomError' });
    expect(calls).toHaveLength(1);
  });

  it('chamadas lógicas distintas de joinRoom usam Idempotency-Keys diferentes', async () => {
    const { client, calls } = makeClient([jsonResponse(200), jsonResponse(200)]);

    await client.joinRoom('room-1');
    await client.joinRoom('room-1');

    expect(calls[0]!.headers['Idempotency-Key']).toBe('uuid-1');
    expect(calls[1]!.headers['Idempotency-Key']).toBe('uuid-2');
  });
});

describe('createRoomsClient.createRoom', () => {
  it('envia POST /v1/rooms com título no corpo JSON e devolve o roomId', async () => {
    const { client, calls } = makeClient([
      jsonResponse(201, { roomId: 'room-9', charged: false }),
    ]);

    const ref = await client.createRoom('Prova de mat');

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe('https://proxy.test/v1/rooms');
    expect(call.method).toBe('POST');
    expect(call.headers['Authorization']).toBe('Bearer token-123');
    expect(call.headers['Content-Type']).toBe('application/json');
    expect(call.headers['Idempotency-Key']).toBe('uuid-1');
    expect(JSON.parse(call.body ?? '{}')).toEqual({ title: 'Prova de mat' });
    expect(ref).toEqual({ roomId: 'room-9' });
  });

  it('402 em createRoom vira insufficientCredits (sem assinatura)', async () => {
    const { client } = makeClient([jsonResponse(402)]);

    await expect(client.createRoom('Sala')).rejects.toMatchObject({
      code: 'insufficientCredits',
    });
  });
});

describe('createRoomsClient.leaveRoom', () => {
  it('envia POST para /v1/rooms/{id}/leave com Bearer token', async () => {
    const { client, calls } = makeClient([jsonResponse(200)]);

    await client.leaveRoom('room-1');

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe('https://proxy.test/v1/rooms/room-1/leave');
    expect(call.method).toBe('POST');
    expect(call.headers['Authorization']).toBe('Bearer token-123');
  });
});

describe('createRoomsClient (config)', () => {
  it('normaliza baseUrl com barra final sem duplicar a barra', async () => {
    const { fetchFn, calls } = makeFetchFake([jsonResponse(200)]);
    const client = createRoomsClient({
      baseUrl: 'https://proxy.test/',
      getIdToken: async () => 'tok',
      fetchFn,
      randomUUID: () => 'uuid-x',
    });

    await client.joinRoom('room-1');

    expect(calls[0]!.url).toBe('https://proxy.test/v1/rooms/room-1/join');
  });
});
