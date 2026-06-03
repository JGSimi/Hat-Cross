import { describe, expect, it, vi } from 'vitest';
import { createBillingWorker, type BillingStore, type FirebaseVerifier, type StripeGateway } from './worker';

function authRequest(path: string, init: RequestInit = {}) {
  return new Request(`https://billing.example.test${path}`, {
    ...init,
    headers: {
      Authorization: 'Bearer firebase-token',
      ...(init.headers ?? {}),
    },
  });
}

function memoryStore(seed: Record<string, unknown> = {}): BillingStore {
  const records = new Map(Object.entries(seed).map(([key, value]) => [key, JSON.stringify(value)]));
  return {
    async getJSON<T>(key: string) {
      const value = records.get(key);
      return value ? JSON.parse(value) as T : null;
    },
    async putJSON(key: string, value: unknown) {
      records.set(key, JSON.stringify(value));
    },
  };
}

describe('billing worker', () => {
  it('returns a public health response without requiring auth', async () => {
    const worker = createBillingWorker({
      health: () => ({
        ok: true,
        checks: {
          billingKV: true,
          stripeSecret: true,
          firebaseProject: true,
          stripePrices: true,
        },
      }),
    });

    const response = await worker.fetch(new Request('https://billing.example.test/v1/billing/healthz'));

    await expect(response.json()).resolves.toEqual({
      ok: true,
      checks: {
        billingKV: true,
        stripeSecret: true,
        firebaseProject: true,
        stripePrices: true,
      },
    });
    expect(response.status).toBe(200);
  });

  it('returns CORS preflight headers', async () => {
    const worker = createBillingWorker();

    const response = await worker.fetch(new Request('https://billing.example.test/v1/billing/checkout', {
      method: 'OPTIONS',
    }));

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
  });

  it('creates a Stripe Checkout subscription session for a valid plan', async () => {
    const stripe: StripeGateway = {
      createCheckoutSession: vi.fn(async () => ({ url: 'https://checkout.stripe.com/c/session_123' })),
      createPortalSession: vi.fn(),
    };
    const verifyIDToken: FirebaseVerifier = vi.fn(async () => ({
      uid: 'user-123',
      email: 'joao@example.test',
    }));
    const worker = createBillingWorker({ stripe, verifyIDToken, store: memoryStore() });

    const response = await worker.fetch(authRequest('/v1/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app: 'hat-flash', plan: 'pro' }),
    }));

    await expect(response.json()).resolves.toEqual({ url: 'https://checkout.stripe.com/c/session_123' });
    expect(response.status).toBe(200);
    expect(stripe.createCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({
      uid: 'user-123',
      email: 'joao@example.test',
      planKey: 'pro',
      app: 'hat-flash',
    }));
  });

  it('rejects invalid plans before calling Stripe', async () => {
    const stripe: StripeGateway = {
      createCheckoutSession: vi.fn(),
      createPortalSession: vi.fn(),
    };
    const worker = createBillingWorker({
      stripe,
      verifyIDToken: async () => ({ uid: 'user-123' }),
      store: memoryStore(),
    });

    const response = await worker.fetch(authRequest('/v1/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app: 'hat-flash', plan: 'enterprise' }),
    }));

    await expect(response.json()).resolves.toEqual({ error: 'Plano invalido.' });
    expect(response.status).toBe(400);
    expect(stripe.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('returns the stored subscription status for the signed-in user', async () => {
    const worker = createBillingWorker({
      verifyIDToken: async () => ({ uid: 'user-123' }),
      store: memoryStore({
        'subscription:user-123': {
          status: 'active',
          plan: 'ultra',
          currentPeriodEnd: 1782936000000,
        },
      }),
    });

    const response = await worker.fetch(authRequest('/v1/billing/subscription', { method: 'GET' }));

    await expect(response.json()).resolves.toEqual({
      status: 'active',
      plan: 'ultra',
      currentPeriodEnd: 1782936000000,
    });
  });
});
