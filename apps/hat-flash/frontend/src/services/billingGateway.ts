import { resolveSubscriptionPlan, type SubscriptionPlanKey } from './billingPlans';

const DEFAULT_BILLING_BASE_URL = 'https://hat-proxy.joao02simi.workers.dev/v1/billing';

export type SubscriptionStatusName =
  | 'none'
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'incomplete'
  | 'canceled'
  | 'paused';

export interface BillingSession {
  url: string;
}

export interface SubscriptionStatus {
  status: SubscriptionStatusName;
  plan: SubscriptionPlanKey | null;
  currentPeriodEnd: number | null;
}

interface BillingGatewayOptions {
  getIdToken: () => Promise<string>;
  fetcher?: typeof fetch;
  baseURL?: string;
}

interface CheckoutOptions extends BillingGatewayOptions {
  planKey: string;
}

async function idToken(options: BillingGatewayOptions): Promise<string> {
  const token = (await options.getIdToken()).trim();
  if (!token) throw new Error('Conecte sua conta Google para continuar.');
  return token;
}

function billingBaseURL(baseURL = import.meta.env.VITE_HAT_BILLING_BASE_URL || DEFAULT_BILLING_BASE_URL): string {
  const normalized = baseURL.trim().replace(/\/+$/, '');
  if (!normalized) throw new Error('Billing backend nao configurado.');
  return normalized;
}

function defaultFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, init);
}

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('Content-Type') ?? '';
  if (contentType.includes('application/json')) return response.json();
  return response.text();
}

function messageFromPayload(payload: unknown): string {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const message = record.message ?? record.error;
    if (typeof message === 'string' && message.trim()) return message;
  }
  if (typeof payload === 'string' && payload.trim()) return payload;
  return 'Billing indisponivel.';
}

async function requestJSON<T>(path: string, options: BillingGatewayOptions, init: RequestInit): Promise<T> {
  const token = await idToken(options);
  const fetcher = options.fetcher ?? defaultFetch;
  const response = await fetcher(`${billingBaseURL(options.baseURL)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  const payload = await parseResponse(response);
  if (!response.ok) {
    throw new Error(messageFromPayload(payload));
  }
  return payload as T;
}

function ensureSessionURL(payload: unknown): BillingSession {
  if (!payload || typeof payload !== 'object') throw new Error('Stripe nao retornou URL.');
  const url = (payload as { url?: unknown }).url;
  if (typeof url !== 'string' || !url.startsWith('https://')) {
    throw new Error('Stripe nao retornou URL segura.');
  }
  return { url };
}

function normalizePlan(value: unknown): SubscriptionPlanKey | null {
  if (typeof value !== 'string' || !value) return null;
  return resolveSubscriptionPlan(value).key;
}

function normalizeStatus(value: unknown): SubscriptionStatusName {
  const status = typeof value === 'string' ? value : 'none';
  if (
    status === 'active' ||
    status === 'trialing' ||
    status === 'past_due' ||
    status === 'incomplete' ||
    status === 'canceled' ||
    status === 'paused'
  ) return status;
  return 'none';
}

export async function createCheckoutSession(options: CheckoutOptions): Promise<BillingSession> {
  const plan = resolveSubscriptionPlan(options.planKey);
  const payload = await requestJSON<unknown>('/checkout', options, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app: 'hat-flash',
      plan: plan.key,
    }),
  });
  return ensureSessionURL(payload);
}

export async function createCustomerPortalSession(options: BillingGatewayOptions): Promise<BillingSession> {
  const payload = await requestJSON<unknown>('/portal', options, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return ensureSessionURL(payload);
}

export async function getSubscriptionStatus(options: BillingGatewayOptions): Promise<SubscriptionStatus> {
  const payload = await requestJSON<Record<string, unknown>>('/subscription', options, {
    method: 'GET',
  });
  return {
    status: normalizeStatus(payload.status),
    plan: normalizePlan(payload.plan),
    currentPeriodEnd: typeof payload.currentPeriodEnd === 'number' ? payload.currentPeriodEnd : null,
  };
}
