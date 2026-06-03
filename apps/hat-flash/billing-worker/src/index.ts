import { verifyFirebaseIDToken, type FirebaseAuthEnv } from './firebaseAuth';
import { createStripeGateway, type StripeEnv } from './stripeRest';
import { applyStripeEvent } from './stripeWebhook';
import { createBillingWorker, type BillingHealth, type BillingStore } from './worker';

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

function hasValue(value: string | undefined) {
  return Boolean(value?.trim());
}

function billingHealth(env: BillingEnv): BillingHealth {
  const checks = {
    billingKV: Boolean(env.BILLING_KV),
    stripeSecret: hasValue(env.STRIPE_SECRET_KEY) && hasValue(env.STRIPE_WEBHOOK_SECRET),
    firebaseProject: hasValue(env.FIREBASE_PROJECT_ID),
    stripePrices: hasValue(env.STRIPE_PRICE_GO) && hasValue(env.STRIPE_PRICE_PRO) && hasValue(env.STRIPE_PRICE_ULTRA),
  };
  return {
    ok: Object.values(checks).every(Boolean),
    checks,
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

export async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  if (!secret?.trim()) throw new Error('STRIPE_WEBHOOK_SECRET nao configurado.');
  const values = Object.fromEntries((signatureHeader ?? '').split(',').map((part) => {
    const [key, value] = part.split('=');
    return [key, value];
  }));
  if (!values.t || !values.v1) throw new Error('Stripe signature ausente.');
  const timestamp = Number(values.t);
  if (!Number.isFinite(timestamp) || Math.abs(nowSeconds - timestamp) > 300) {
    throw new Error('Stripe signature expirada.');
  }

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
    if (request.method === 'OPTIONS') {
      return createBillingWorker().fetch(request);
    }
    if (new URL(request.url).pathname.replace(/\/+$/, '') === '/v1/billing/healthz') {
      return createBillingWorker({ health: () => billingHealth(env) }).fetch(request);
    }

    const store = kvStore(requiredKV(env));
    return createBillingWorker({
      store,
      verifyIDToken: (idToken) => verifyFirebaseIDToken(idToken, env),
      stripe: createStripeGateway(env, store),
      handleWebhook: (webhookRequest) => handleStripeWebhook(webhookRequest, env, store),
      health: () => billingHealth(env),
    }).fetch(request);
  },
};
