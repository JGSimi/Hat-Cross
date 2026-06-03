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
  if (priceID === env.STRIPE_PRICE_GO) return 'go';
  if (priceID === env.STRIPE_PRICE_PRO) return 'pro';
  if (priceID === env.STRIPE_PRICE_ULTRA) return 'ultra';
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
