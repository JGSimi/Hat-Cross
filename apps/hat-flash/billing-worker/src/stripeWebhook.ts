import type { StripeEnv } from './stripeRest';
import type { BillingStore, SubscriptionPlanKey, SubscriptionStatusName } from './worker';
import { subscriptionKey } from './worker';

interface StripeEvent {
  type?: string;
  data?: {
    object?: unknown;
  };
}

interface StripeSubscription {
  customer?: unknown;
  status?: unknown;
  current_period_end?: unknown;
  items?: {
    data?: Array<{
      price?: {
        id?: unknown;
      };
    }>;
  };
}

function uidByCustomerKey(customerID: string) {
  return `uid-by-customer:${customerID}`;
}

function planFromPriceID(env: StripeEnv, priceID: unknown): SubscriptionPlanKey | null {
  if (typeof priceID !== 'string' || !priceID) return null;
  if (env.STRIPE_PRICE_UNLIMITED && priceID === env.STRIPE_PRICE_UNLIMITED) return 'unlimited';
  if (env.STRIPE_PRICE_GO && priceID === env.STRIPE_PRICE_GO) return 'go';
  if (env.STRIPE_PRICE_PRO && priceID === env.STRIPE_PRICE_PRO) return 'pro';
  if (env.STRIPE_PRICE_ULTRA && priceID === env.STRIPE_PRICE_ULTRA) return 'ultra';
  if (env.STRIPE_PRICE_MONTHLY && priceID === env.STRIPE_PRICE_MONTHLY) return 'unlimited';
  // Fallback: any active configured price resolves to unlimited
  const knownPrices = [
    env.STRIPE_PRICE_UNLIMITED,
    env.STRIPE_PRICE_GO,
    env.STRIPE_PRICE_PRO,
    env.STRIPE_PRICE_ULTRA,
    env.STRIPE_PRICE_MONTHLY,
  ].filter(Boolean);
  if (knownPrices.includes(priceID)) return 'unlimited';
  return null;
}

function normalizeStatus(status: unknown): SubscriptionStatusName {
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

function subscriptionFromEventObject(value: unknown): StripeSubscription | null {
  if (!value || typeof value !== 'object') return null;
  return value as StripeSubscription;
}

export async function applyStripeEvent(event: StripeEvent, env: StripeEnv, store: BillingStore): Promise<void> {
  if (
    event.type !== 'customer.subscription.created' &&
    event.type !== 'customer.subscription.updated' &&
    event.type !== 'customer.subscription.deleted'
  ) return;

  const subscription = subscriptionFromEventObject(event.data?.object);
  if (!subscription) return;
  const customerID = typeof subscription.customer === 'string' ? subscription.customer : '';
  if (!customerID) return;

  const uid = await store.getJSON<string>(uidByCustomerKey(customerID));
  if (!uid) return;

  const priceID = subscription.items?.data?.[0]?.price?.id;
  await store.putJSON(subscriptionKey(uid), {
    status: normalizeStatus(subscription.status),
    plan: planFromPriceID(env, priceID),
    currentPeriodEnd: typeof subscription.current_period_end === 'number'
      ? subscription.current_period_end * 1000
      : null,
  });
}
