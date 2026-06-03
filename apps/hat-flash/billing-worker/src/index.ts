import { verifyFirebaseIDToken, type FirebaseAuthEnv } from './firebaseAuth';
import { createStripeGateway, type StripeEnv } from './stripeRest';
import { applyStripeEvent } from './stripeWebhook';
import { createBillingWorker, type BillingStore } from './worker';

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export interface BillingEnv extends StripeEnv, FirebaseAuthEnv {
  STRIPE_WEBHOOK_SECRET?: string;
  BILLING_KV?: KVNamespace;
}

function requiredKV(env: BillingEnv): KVNamespace {
  if (!env.BILLING_KV) throw new Error('BILLING_KV nao configurado.');
  return env.BILLING_KV;
}

function kvStore(kv: KVNamespace): BillingStore {
  return {
    async getJSON<T>(key: string) {
      const raw = await kv.get(key);
      return raw ? JSON.parse(raw) as T : null;
    },
    async putJSON(key: string, value: unknown) {
      await kv.put(key, JSON.stringify(value));
    },
  };
}

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

async function verifyStripeSignature(rawBody: string, signatureHeader: string | null, secret: string | undefined) {
  if (!secret?.trim()) throw new Error('STRIPE_WEBHOOK_SECRET nao configurado.');
  const values = Object.fromEntries((signatureHeader ?? '').split(',').map((part) => {
    const [key, value] = part.split('=');
    return [key, value];
  }));
  if (!values.t || !values.v1) throw new Error('Stripe signature ausente.');

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expected = hex(await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${values.t}.${rawBody}`),
  ));
  if (!timingSafeEqual(expected, values.v1)) throw new Error('Stripe signature invalida.');
}

async function handleStripeWebhook(request: Request, env: BillingEnv, store: BillingStore) {
  const rawBody = await request.text();
  await verifyStripeSignature(rawBody, request.headers.get('Stripe-Signature'), env.STRIPE_WEBHOOK_SECRET);
  await applyStripeEvent(JSON.parse(rawBody), env, store);
  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request: Request, env: BillingEnv): Promise<Response> {
    const store = kvStore(requiredKV(env));
    return createBillingWorker({
      store,
      verifyIDToken: (idToken) => verifyFirebaseIDToken(idToken, env),
      stripe: createStripeGateway(env, store),
      handleWebhook: (webhookRequest) => handleStripeWebhook(webhookRequest, env, store),
    }).fetch(request);
  },
};
