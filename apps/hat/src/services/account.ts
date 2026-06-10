// Cliente da conta/assinatura (paywall). Lê /v1/me e abre o checkout Stripe.
// Sem firebase aqui: token injetado via getIdToken.

export interface AccountStatus {
  uid: string;
  email: string | null;
  entitled: boolean;
  subscription: { status: string; plan: string | null; currentPeriodEnd: number | null };
  trialEndsAt: number | null;
}

export interface AccountClientDeps {
  baseUrl: string;
  getIdToken: () => Promise<string>;
  fetchFn?: typeof fetch;
}

export interface AccountClient {
  fetchStatus: () => Promise<AccountStatus>;
  /** Cria a sessão de checkout (R$50/mês) e devolve a URL para abrir no browser. */
  checkoutUrl: () => Promise<string>;
  /** URL do portal de gestão da assinatura. */
  portalUrl: () => Promise<string>;
}

export function createAccountClient(deps: AccountClientDeps): AccountClient {
  const baseUrl = deps.baseUrl.replace(/\/+$/, '');
  const fetchFn = deps.fetchFn ?? fetch;

  async function authedFetch(path: string, init?: RequestInit): Promise<unknown> {
    const token = await deps.getIdToken();
    const res = await fetchFn(`${baseUrl}${path}`, {
      ...init,
      headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json().catch(() => null);
  }

  return {
    async fetchStatus(): Promise<AccountStatus> {
      return (await authedFetch('/v1/me')) as AccountStatus;
    },
    async checkoutUrl(): Promise<string> {
      const r = (await authedFetch('/v1/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'unlimited' }),
      })) as { url?: string };
      if (!r?.url) throw new Error('checkout sem URL');
      return r.url;
    },
    async portalUrl(): Promise<string> {
      const r = (await authedFetch('/v1/billing/portal', { method: 'POST' })) as { url?: string };
      if (!r?.url) throw new Error('portal sem URL');
      return r.url;
    },
  };
}

/** Dias inteiros restantes de trial (>= 0). */
export function trialDaysLeft(trialEndsAt: number | null, now = Date.now()): number {
  if (typeof trialEndsAt !== 'number') return 0;
  return Math.max(0, Math.ceil((trialEndsAt - now) / (24 * 60 * 60 * 1000)));
}
