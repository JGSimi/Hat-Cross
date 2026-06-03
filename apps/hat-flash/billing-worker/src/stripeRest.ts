import type { BillingSession, BillingStore, CheckoutCommand, PortalCommand, StripeGateway, SubscriptionPlanKey } from './worker';

export interface StripeEnv {
  STRIPE_SECRET_KEY?: string;
  STRIPE_PRICE_GO?: string;
  STRIPE_PRICE_PRO?: string;
  STRIPE_PRICE_ULTRA?: string;
  STRIPE_CHECKOUT_SUCCESS_URL?: string;
  STRIPE_CHECKOUT_CANCEL_URL?: string;
  STRIPE_PORTAL_RETURN_URL?: string;
}

type StripeFetch = (input: string, init?: RequestInit) => Promise<Response>;

const STRIPE_API_BASE_URL = 'https://api.stripe.com';

function required(value: string | undefined, name: string): string {
  if (!value?.trim()) throw new Error(`${name} nao configurado.`);
  return value.trim();
}

function customerKey(uid: string) {
  return `customer:${uid}`;
}

function customerUIDKey(customerID: string) {
  return `uid-by-customer:${customerID}`;
}

function priceIDForPlan(env: StripeEnv, planKey: SubscriptionPlanKey) {
  if (planKey === 'go') return required(env.STRIPE_PRICE_GO, 'STRIPE_PRICE_GO');
  if (planKey === 'pro') return required(env.STRIPE_PRICE_PRO, 'STRIPE_PRICE_PRO');
  return required(env.STRIPE_PRICE_ULTRA, 'STRIPE_PRICE_ULTRA');
}

async function stripePost<T>(
  env: StripeEnv,
  fetcher: StripeFetch,
  path: string,
  params: URLSearchParams,
): Promise<T> {
  const response = await fetcher(`${STRIPE_API_BASE_URL}${path}`, {
    method: 'POST',
    headers: new Headers({
      Authorization: `Bearer ${required(env.STRIPE_SECRET_KEY, 'STRIPE_SECRET_KEY')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    }),
    body: params.toString(),
  });
  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    const message = typeof payload.error === 'object' && payload.error
      ? (payload.error as { message?: string }).message
      : null;
    throw new Error(message || 'Stripe indisponivel.');
  }
  return payload as T;
}

async function findOrCreateCustomer(
  env: StripeEnv,
  store: BillingStore,
  fetcher: StripeFetch,
  command: CheckoutCommand | PortalCommand,
): Promise<string> {
  const existing = await store.getJSON<string>(customerKey(command.uid));
  if (existing) return existing;

  const params = new URLSearchParams({
    'metadata[firebase_uid]': command.uid,
    'metadata[app]': command.app,
  });
  if (command.email) params.set('email', command.email);

  const customer = await stripePost<{ id?: string }>(env, fetcher, '/v1/customers', params);
  if (!customer.id) throw new Error('Stripe nao retornou customer.');
  await Promise.all([
    store.putJSON(customerKey(command.uid), customer.id),
    store.putJSON(customerUIDKey(customer.id), command.uid),
  ]);
  return customer.id;
}

function checkoutParams(command: CheckoutCommand, customerID: string, priceID: string, env: StripeEnv) {
  const params = new URLSearchParams({
    mode: 'subscription',
    customer: customerID,
    success_url: required(env.STRIPE_CHECKOUT_SUCCESS_URL, 'STRIPE_CHECKOUT_SUCCESS_URL'),
    cancel_url: required(env.STRIPE_CHECKOUT_CANCEL_URL, 'STRIPE_CHECKOUT_CANCEL_URL'),
    client_reference_id: command.uid,
    'line_items[0][price]': priceID,
    'line_items[0][quantity]': '1',
    'metadata[firebase_uid]': command.uid,
    'metadata[app]': command.app,
    'metadata[plan]': command.planKey,
    'subscription_data[metadata][firebase_uid]': command.uid,
    'subscription_data[metadata][app]': command.app,
    'subscription_data[metadata][plan]': command.planKey,
  });
  return params;
}

function ensureSession(payload: { url?: string }): BillingSession {
  if (!payload.url?.startsWith('https://')) throw new Error('Stripe nao retornou URL segura.');
  return { url: payload.url };
}

export function createStripeGateway(
  env: StripeEnv,
  store: BillingStore,
  fetcher: StripeFetch = fetch,
): StripeGateway {
  return {
    async createCheckoutSession(command: CheckoutCommand) {
      const customerID = await findOrCreateCustomer(env, store, fetcher, command);
      const priceID = priceIDForPlan(env, command.planKey);
      return ensureSession(await stripePost<{ url?: string }>(
        env,
        fetcher,
        '/v1/checkout/sessions',
        checkoutParams(command, customerID, priceID, env),
      ));
    },

    async createPortalSession(command: PortalCommand) {
      const customerID = await findOrCreateCustomer(env, store, fetcher, command);
      return ensureSession(await stripePost<{ url?: string }>(
        env,
        fetcher,
        '/v1/billing_portal/sessions',
        new URLSearchParams({
          customer: customerID,
          return_url: required(env.STRIPE_PORTAL_RETURN_URL, 'STRIPE_PORTAL_RETURN_URL'),
        }),
      ));
    },
  };
}
