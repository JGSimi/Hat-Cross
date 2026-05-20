const HAT_PROXY_URL = 'https://hat-proxy.joao02simi.workers.dev';

export interface RoomJoinResult {
  roomId: string;
  charged: boolean;
  alreadyMember: boolean;
  joinCost: number;
}

async function authedHeaders(idToken: string): Promise<HeadersInit> {
  return {
    Authorization: `Bearer ${idToken}`,
    'Content-Type': 'application/json',
    'Idempotency-Key': crypto.randomUUID(),
  };
}

async function parse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof body.error === 'string' ? body.error : `room:${response.status}`);
  }
  return body as T;
}

export async function createRoom(title: string, idToken: string): Promise<RoomJoinResult> {
  const response = await fetch(`${HAT_PROXY_URL}/v1/rooms`, {
    method: 'POST',
    headers: await authedHeaders(idToken),
    body: JSON.stringify({ title }),
  });
  return parse<RoomJoinResult>(response);
}

export async function joinRoom(roomId: string, idToken: string): Promise<RoomJoinResult> {
  const response = await fetch(`${HAT_PROXY_URL}/v1/rooms/${encodeURIComponent(roomId)}/join`, {
    method: 'POST',
    headers: await authedHeaders(idToken),
    body: JSON.stringify({}),
  });
  return parse<RoomJoinResult>(response);
}

export async function leaveRoom(roomId: string, idToken: string): Promise<void> {
  const response = await fetch(`${HAT_PROXY_URL}/v1/rooms/${encodeURIComponent(roomId)}/leave`, {
    method: 'POST',
    headers: await authedHeaders(idToken),
    body: JSON.stringify({}),
  });
  await parse(response);
}

