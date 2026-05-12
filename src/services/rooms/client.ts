import { HAT_PROXY_URL } from '../config';
import { getIdToken } from '../auth/firebase';
import type { RoomJoinResult } from '../../types/rooms';

export type RoomApiErrorCode =
  | 'auth'
  | 'insufficient'
  | 'membership'
  | 'notFound'
  | 'invalidRoom'
  | 'generic';

export class RoomApiError extends Error {
  code: RoomApiErrorCode;
  status: number;

  constructor(code: RoomApiErrorCode, status: number) {
    super(code);
    this.name = 'RoomApiError';
    this.code = code;
    this.status = status;
  }
}

async function authHeaders(): Promise<HeadersInit> {
  const idToken = await getIdToken();
  if (!idToken) {
    throw new RoomApiError('auth', 401);
  }
  return {
    Authorization: `Bearer ${idToken}`,
    'Content-Type': 'application/json',
    'Idempotency-Key': crypto.randomUUID(),
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    if (response.status === 402) {
      throw new RoomApiError('insufficient', response.status);
    }
    if (response.status === 403) {
      throw new RoomApiError('membership', response.status);
    }
    if (response.status === 404) {
      throw new RoomApiError('notFound', response.status);
    }
    if (response.status === 400 && body.error === 'Invalid roomId') {
      throw new RoomApiError('invalidRoom', response.status);
    }
    throw new RoomApiError('generic', response.status);
  }
  return body as T;
}

export async function createRoom(title: string): Promise<RoomJoinResult> {
  const response = await fetch(`${HAT_PROXY_URL}/v1/rooms`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ title }),
  });
  return parseResponse<RoomJoinResult>(response);
}

export async function joinRoom(roomId: string): Promise<RoomJoinResult> {
  const response = await fetch(`${HAT_PROXY_URL}/v1/rooms/${encodeURIComponent(roomId)}/join`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({}),
  });
  return parseResponse<RoomJoinResult>(response);
}
