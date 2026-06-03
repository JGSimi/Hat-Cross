import { describe, expect, it, vi } from 'vitest';
import { createStripeGateway, type StripeEnv } from './stripeRest';
import type { BillingStore } from './worker';

type StripeFetch = (input: string, init?: RequestInit) => Promise<Response>;

function response(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function memoryStore(): BillingStore & { records: Map<string, string> } {
  const records = new Map<string, string>();
  return {
    records,
    async getJSON<T>(key: string) {
      const value = records.get(key);
      return value ? JSON.parse(value) as T : null;
    },
    async putJSON(key: string, value: unknown) {
      records.set(key, JSON.stringify(value));
    },
  };
}

const env: StripeEnv = {
  STRIPE_SECRET_KEY: 'sk_test_123',
  STRIPE_PRICE_GO: 'price_go',
  STRIPE_PRICE_PRO: 'price_pro',
  STRIPE_PRICE_ULTRA: 'price_ultra',
  STRIPE_CHECKOUT_SUCCESS_URL: 'https://hat.example.test/billing/success',
  STRIPE_CHECKOUT_CANCEL_URL: 'https://hat.example.test/billing/cancel',
  STRIPE_PORTAL_RETURN_URL: 'https://hat.example.test/billing',
};

describe('stripe REST gateway', () => {
  it('creates a customer and a subscription Checkout Session', async () => {
    const calls: Array<{ url: string; body: URLSearchParams; auth: string | null }> = [];
    const fetcher = vi.fn<StripeFetch>(async (url, init) => {
      calls.push({
        url,
        body: new URLSearchParams(String(init?.body ?? '')),
        auth: init?.headers instanceof Headers ? init.headers.get('Authorization') : null,
      });
      if (url.endsWith('/v1/customers')) return response({ id: 'cus_123' });
      if (url.endsWith('/v1/checkout/sessions')) return response({ url: 'https://checkout.stripe.com/c/session_123' });
      return response({});
    });
    const store = memoryStore();
    const gateway = createStripeGateway(env, store, fetcher);

    await expect(gateway.createCheckoutSession({
      uid: 'user-123',
      email: 'joao@example.test',
      planKey: 'pro',
      app: 'hat-flash',
    })).resolves.toEqual({ url: 'https://checkout.stripe.com/c/session_123' });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(calls[0].auth).toBe('Bearer sk_test_123');
    expect(calls[0].body.get('email')).toBe('joao@example.test');
    expect(calls[0].body.get('metadata[firebase_uid]')).toBe('user-123');
    expect(calls[1].body.get('mode')).toBe('subscription');
    expect(calls[1].body.get('customer')).toBe('cus_123');
    expect(calls[1].body.get('line_items[0][price]')).toBe('price_pro');
    expect(calls[1].body.get('subscription_data[metadata][plan]')).toBe('pro');
    expect(store.records.get('customer:user-123')).toBe(JSON.stringify('cus_123'));
  });

  it('opens the Customer Portal using the cached customer', async () => {
    const store = memoryStore();
    await store.putJSON('customer:user-123', 'cus_123');
    const fetcher = vi.fn<StripeFetch>(async (url, init) => {
      const body = new URLSearchParams(String(init?.body ?? ''));
      expect(url).toBe('https://api.stripe.com/v1/billing_portal/sessions');
      expect(body.get('customer')).toBe('cus_123');
      expect(body.get('return_url')).toBe('https://hat.example.test/billing');
      return response({ url: 'https://billing.stripe.com/p/session_123' });
    });
    const gateway = createStripeGateway(env, store, fetcher);

    await expect(gateway.createPortalSession!({
      uid: 'user-123',
      app: 'hat-flash',
    })).resolves.toEqual({ url: 'https://billing.stripe.com/p/session_123' });
  });
});
