// Cliente HTTP do hat-proxy para salas. Sem firebase: o token de auth é
// injetado via getIdToken. joinRoom usa Idempotency-Key estável por chamada
// lógica com retry interno em 5xx/erro de rede (máx 2 retries).

export type RoomsClientErrorCode =
  | 'insufficientCredits'
  | 'sessionExpired'
  | 'roomError'
  | 'notFound'
  | 'activeRoomExists';

/** O Worker devolve identificadores; o documento completo vem pelo realtime. */
export interface RoomRef {
  roomId: string;
}

export class RoomsClientError extends Error {
  readonly code: RoomsClientErrorCode;
  readonly status: number | undefined;

  constructor(code: RoomsClientErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'RoomsClientError';
    this.code = code;
    this.status = status;
  }
}

export interface RoomsClientDeps {
  baseUrl: string;
  getIdToken: () => Promise<string>;
  fetchFn?: typeof fetch;
  randomUUID?: () => string;
}

export interface RoomsClient {
  createRoom: (title: string) => Promise<RoomRef>;
  joinRoom: (roomId: string) => Promise<RoomRef>;
  leaveRoom: (roomId: string) => Promise<void>;
}

/** Retries adicionais após a primeira tentativa (total = 1 + MAX_RETRIES). */
const MAX_RETRIES = 2;

function errorFromStatus(status: number): RoomsClientError {
  // 402 no pivot = sem assinatura/trial (não mais "créditos"); mantemos o code
  // para a UI rotear ao paywall.
  if (status === 402) {
    return new RoomsClientError('insufficientCredits', 'Assine para usar salas', status);
  }
  if (status === 401) {
    return new RoomsClientError('sessionExpired', 'Sessão expirada', status);
  }
  if (status === 404) {
    return new RoomsClientError('notFound', 'Sala não encontrada', status);
  }
  if (status === 409) {
    return new RoomsClientError('activeRoomExists', 'Você já está em outra sala', status);
  }
  return new RoomsClientError('roomError', `Falha na operação da sala (HTTP ${status})`, status);
}

export function createRoomsClient(deps: RoomsClientDeps): RoomsClient {
  const baseUrl = deps.baseUrl.replace(/\/+$/, '');
  const fetchFn = deps.fetchFn ?? fetch;
  const randomUUID = deps.randomUUID ?? (() => crypto.randomUUID());

  interface PostOptions {
    idempotencyKey?: string;
    body?: unknown;
    /** Quando true, refaz a tentativa em 5xx/erro de rede (máx MAX_RETRIES). */
    retry?: boolean;
  }

  async function post(path: string, options: PostOptions = {}): Promise<unknown> {
    const token = await deps.getIdToken();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (options.idempotencyKey !== undefined) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }
    let body: string | undefined;
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }

    const maxAttempts = options.retry === true ? 1 + MAX_RETRIES : 1;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      let response: Response;
      try {
        response = await fetchFn(`${baseUrl}${path}`, { method: 'POST', headers, body });
      } catch (networkError) {
        // Erro de rede: vale retry com a MESMA Idempotency-Key.
        lastError = networkError;
        continue;
      }

      if (response.ok) {
        return response.json().catch(() => null);
      }

      if (response.status >= 500) {
        // 5xx: vale retry com a MESMA Idempotency-Key.
        lastError = errorFromStatus(response.status);
        continue;
      }

      // 4xx: erro definitivo, nunca refaz.
      throw errorFromStatus(response.status);
    }

    if (lastError instanceof RoomsClientError) throw lastError;
    throw new RoomsClientError(
      'roomError',
      `Falha de rede ao chamar o hat-proxy: ${String(lastError)}`,
    );
  }

  function toRoomRef(result: unknown, fallbackId = ''): RoomRef {
    const roomId =
      result && typeof result === 'object' && typeof (result as RoomRef).roomId === 'string'
        ? (result as RoomRef).roomId
        : fallbackId;
    return { roomId };
  }

  return {
    async createRoom(title: string): Promise<RoomRef> {
      const result = await post('/v1/rooms', { idempotencyKey: randomUUID(), body: { title } });
      return toRoomRef(result);
    },

    async joinRoom(roomId: string): Promise<RoomRef> {
      // Uma key por chamada lógica: retries internos reusam a mesma key,
      // chamadas distintas de joinRoom geram keys novas.
      const idempotencyKey = randomUUID();
      const result = await post(`/v1/rooms/${encodeURIComponent(roomId)}/join`, {
        idempotencyKey,
        retry: true,
      });
      return toRoomRef(result, roomId);
    },

    async leaveRoom(roomId: string): Promise<void> {
      await post(`/v1/rooms/${encodeURIComponent(roomId)}/leave`);
    },
  };
}
