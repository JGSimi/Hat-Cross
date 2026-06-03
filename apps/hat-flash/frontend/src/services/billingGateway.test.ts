import { describe, expect, it, vi } from 'vitest';
import {
  createCheckoutSession,
  createCustomerPortalSession,
  getSubscriptionStatus,
} from './billingGateway';

type BillingFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('billingGateway', () => {
  it('creates a Stripe Checkout subscription session with the Firebase token', async () => {
    const fetcher = vi.fn<BillingFetch>()
      .mockResolvedValue(jsonResponse({ url: 'https://checkout.stripe.com/c/pay_123' }));

    const session = await createCheckoutSession({
      planKey: 'pro',
      getIdToken: async () => 'firebase-token',
      fetcher,
      baseURL: 'https://billing.example.test/v1/billing',
    });

    expect(session.url).toBe('https://checkout.stripe.com/c/pay_123');
    expect(fetcher).toHaveBeenCalledWith('https://billing.example.test/v1/billing/checkout', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer firebase-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app: 'hat-flash',
        plan: 'pro',
      }),
    });
  });

  it('creates a Customer Portal session for subscription management', async () => {
    const fetcher = vi.fn<BillingFetch>()
      .mockResolvedValue(jsonResponse({ url: 'https://billing.stripe.com/p/session_123' }));

    await expect(createCustomerPortalSession({
      getIdToken: async () => 'firebase-token',
      fetcher,
      baseURL: 'https://billing.example.test/v1/billing/',
    })).resolves.toEqual({ url: 'https://billing.stripe.com/p/session_123' });

    expect(fetcher).toHaveBeenCalledWith('https://billing.example.test/v1/billing/portal', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer firebase-token' }),
    }));
  });

  it('reads the current subscription status', async () => {
    const fetcher = vi.fn<BillingFetch>()
      .mockResolvedValue(jsonResponse({
        status: 'active',
        plan: 'ultra',
        currentPeriodEnd: 1782936000000,
      }));

    await expect(getSubscriptionStatus({
      getIdToken: async () => 'firebase-token',
      fetcher,
      baseURL: 'https://billing.example.test/v1/billing',
    })).resolves.toEqual({
      status: 'active',
      plan: 'ultra',
      currentPeriodEnd: 1782936000000,
    });

    expect(fetcher).toHaveBeenCalledWith('https://billing.example.test/v1/billing/subscription', {
      method: 'GET',
      headers: { Authorization: 'Bearer firebase-token' },
    });
  });

  it('fails before hitting the network when auth or plan is invalid', async () => {
    const fetcher = vi.fn<BillingFetch>();

    await expect(createCheckoutSession({
      planKey: 'bad-plan',
      getIdToken: async () => 'firebase-token',
      fetcher,
      baseURL: 'https://billing.example.test/v1/billing',
    })).rejects.toThrow('Plano invalido');

    await expect(getSubscriptionStatus({
      getIdToken: async () => '',
      fetcher,
      baseURL: 'https://billing.example.test/v1/billing',
    })).rejects.toThrow('Conecte sua conta Google');

    expect(fetcher).not.toHaveBeenCalled();
  });
});
