import { describe, expect, it } from 'vitest';
import worker, { verifyStripeSignature } from './index';

async function stripeSignature(rawBody: string, secret: string, timestamp: number) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${rawBody}`),
  );
  const hex = Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `t=${timestamp},v1=${hex}`;
}

describe('billing worker entrypoint', () => {
  it('reports production readiness without exposing secret values', async () => {
    const env = {
      BILLING_KV: {
        get: async () => null,
        put: async () => undefined,
      },
      STRIPE_SECRET_KEY: 'sk_test_secret',
      STRIPE_WEBHOOK_SECRET: 'whsec_secret',
      FIREBASE_PROJECT_ID: 'hat-cross',
      STRIPE_PRICE_GO: 'price_go',
      STRIPE_PRICE_PRO: 'price_pro',
      STRIPE_PRICE_ULTRA: 'price_ultra',
    };

    const response = await worker.fetch(new Request('https://billing.example.test/v1/billing/healthz'), env);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      ok: true,
      checks: {
        billingKV: true,
        stripeSecret: true,
        firebaseProject: true,
        stripePrices: true,
      },
    });
    expect(JSON.stringify(payload)).not.toContain('sk_test_secret');
    expect(JSON.stringify(payload)).not.toContain('price_go');
  });

  it('answers CORS preflight even when required production bindings are not configured yet', async () => {
    const response = await worker.fetch(new Request('https://billing.example.test/v1/billing/checkout', {
      method: 'OPTIONS',
    }), {});

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('rejects stale Stripe webhook signatures', async () => {
    const rawBody = JSON.stringify({ id: 'evt_123' });
    const staleTimestamp = Math.floor(Date.now() / 1000) - 301;
    const header = await stripeSignature(rawBody, 'whsec_test', staleTimestamp);

    await expect(verifyStripeSignature(rawBody, header, 'whsec_test')).rejects.toThrow('expirada');
  });
});
