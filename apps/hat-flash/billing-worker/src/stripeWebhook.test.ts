import { describe, expect, it } from 'vitest';
import { applyStripeEvent } from './stripeWebhook';
import type { BillingStore } from './worker';
import type { StripeEnv } from './stripeRest';

function memoryStore(seed: Record<string, unknown> = {}): BillingStore & { records: Map<string, string> } {
  const records = new Map(Object.entries(seed).map(([key, value]) => [key, JSON.stringify(value)]));
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
  STRIPE_PRICE_GO: 'price_go',
  STRIPE_PRICE_PRO: 'price_pro',
  STRIPE_PRICE_ULTRA: 'price_ultra',
};

describe('stripe webhook application', () => {
  it('stores subscription status from Stripe customer subscription events', async () => {
    const store = memoryStore({ 'uid-by-customer:cus_123': 'user-123' });

    await applyStripeEvent({
      type: 'customer.subscription.updated',
      data: {
        object: {
          customer: 'cus_123',
          status: 'active',
          current_period_end: 1782936000,
          items: {
            data: [{ price: { id: 'price_ultra' } }],
          },
        },
      },
    }, env, store);

    expect(store.records.get('subscription:user-123')).toBe(JSON.stringify({
      status: 'active',
      plan: 'ultra',
      currentPeriodEnd: 1782936000000,
    }));
  });

  it('keeps a canceled subscription visible after deletion events', async () => {
    const store = memoryStore({ 'uid-by-customer:cus_123': 'user-123' });

    await applyStripeEvent({
      type: 'customer.subscription.deleted',
      data: {
        object: {
          customer: 'cus_123',
          status: 'canceled',
          current_period_end: 1782936000,
          items: {
            data: [{ price: { id: 'price_go' } }],
          },
        },
      },
    }, env, store);

    expect(store.records.get('subscription:user-123')).toBe(JSON.stringify({
      status: 'canceled',
      plan: 'go',
      currentPeriodEnd: 1782936000000,
    }));
  });
});
