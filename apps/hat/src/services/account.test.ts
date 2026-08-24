import { describe, expect, it, vi } from 'vitest';
import { createAccountClient, trialDaysLeft } from './account';

describe('trialDaysLeft', () => {
  const now = 1_000_000_000_000;
  it('arredonda pra cima e nunca fica negativo', () => {
    expect(trialDaysLeft(now + 7 * 86_400_000, now)).toBe(7);
    expect(trialDaysLeft(now + 1, now)).toBe(1);
    expect(trialDaysLeft(now - 1, now)).toBe(0);
    expect(trialDaysLeft(null, now)).toBe(0);
  });
});

describe('createAccountClient', () => {
  function client(fetchFn: typeof fetch) {
    return createAccountClient({
      baseUrl: 'https://proxy.test/',
      getIdToken: () => Promise.resolve('tok'),
      fetchFn,
    });
  }

  it('fetchStatus manda o bearer e parseia', async () => {
    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify({ uid: 'u', entitled: true, trialEndsAt: 123 }), { status: 200 }),
    ) as unknown as typeof fetch;
    const status = await client(fetchFn).fetchStatus();
    expect(status.entitled).toBe(true);
    const call = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(call[0]).toBe('https://proxy.test/v1/me');
    expect((call[1].headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('checkoutUrl pede o plano único e devolve a URL', async () => {
    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify({ url: 'https://checkout.stripe/x' }), { status: 200 }),
    ) as unknown as typeof fetch;
    const url = await client(fetchFn).checkoutUrl();
    expect(url).toBe('https://checkout.stripe/x');
    const body = JSON.parse((fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1].body);
    expect(body.plan).toBe('unlimited');
  });

  it('erro HTTP propaga', async () => {
    const fetchFn = vi.fn(async () => new Response('nope', { status: 500 })) as unknown as typeof fetch;
    await expect(client(fetchFn).fetchStatus()).rejects.toThrow('HTTP 500');
  });

  it('extrai mensagem de erro customizada do JSON', async () => {
    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'Stripe indisponivel.' }), { status: 500 }),
    ) as unknown as typeof fetch;
    await expect(client(fetchFn).checkoutUrl()).rejects.toThrow('Stripe indisponivel.');
  });
});
