import type { AuthenticatedUser } from './worker';

export interface FirebaseAuthEnv {
  FIREBASE_PROJECT_ID?: string;
}

interface FirebaseJWK {
  kid?: string;
  kty?: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
}

interface FirebaseJWKS {
  keys?: FirebaseJWK[];
}

type AuthFetch = (input: string, init?: RequestInit) => Promise<Response>;

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

let jwksCache: { expiresAt: number; keys: FirebaseJWK[] } | null = null;

function requiredProjectID(env: FirebaseAuthEnv) {
  if (!env.FIREBASE_PROJECT_ID?.trim()) throw new Error('FIREBASE_PROJECT_ID nao configurado.');
  return env.FIREBASE_PROJECT_ID.trim();
}

function base64URLToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function decodeJSONPart<T>(value: string): T {
  const text = new TextDecoder().decode(base64URLToBytes(value));
  return JSON.parse(text) as T;
}

async function fetchJWKS(fetcher: AuthFetch): Promise<FirebaseJWK[]> {
  const now = Date.now();
  if (jwksCache && jwksCache.expiresAt > now) return jwksCache.keys;

  const response = await fetcher(JWKS_URL);
  if (!response.ok) throw new Error('Nao foi possivel buscar chaves Firebase.');
  const payload = await response.json() as FirebaseJWKS;
  const cacheControl = response.headers.get('Cache-Control') ?? '';
  const maxAge = Number(cacheControl.match(/max-age=(\d+)/)?.[1] ?? 300);
  const keys = payload.keys ?? [];
  jwksCache = { keys, expiresAt: now + maxAge * 1000 };
  return keys;
}

async function importFirebaseKey(jwk: FirebaseJWK): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    {
      ...jwk,
      ext: true,
      key_ops: ['verify'],
    },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
}

function assertFirebaseClaims(payload: Record<string, unknown>, projectID: string): AuthenticatedUser {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expectedIssuer = `https://securetoken.google.com/${projectID}`;
  if (payload.iss !== expectedIssuer) throw new Error('Firebase token issuer invalido.');
  if (payload.aud !== projectID) throw new Error('Firebase token audience invalido.');
  if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('Firebase token sem usuario.');
  if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds) throw new Error('Firebase token expirado.');
  return {
    uid: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
  };
}

export async function verifyFirebaseIDToken(
  idToken: string,
  env: FirebaseAuthEnv,
  fetcher: AuthFetch = fetch,
): Promise<AuthenticatedUser> {
  const projectID = requiredProjectID(env);
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Firebase token invalido.');

  const header = decodeJSONPart<Record<string, unknown>>(parts[0]);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error('Firebase token header invalido.');

  const key = (await fetchJWKS(fetcher)).find((candidate) => candidate.kid === header.kid);
  if (!key) throw new Error('Firebase token key desconhecida.');

  const cryptoKey = await importFirebaseKey(key);
  const valid = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    cryptoKey,
    base64URLToBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!valid) throw new Error('Firebase token assinatura invalida.');

  return assertFirebaseClaims(decodeJSONPart<Record<string, unknown>>(parts[1]), projectID);
}
