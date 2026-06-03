import { describe, expect, it } from 'vitest';
import {
  formatPlanPrice,
  resolveSubscriptionPlan,
  subscriptionPlans,
  type SubscriptionPlanKey,
} from './billingPlans';

describe('subscriptionPlans', () => {
  it('defines the three monthly BRL plans in product order', () => {
    expect(subscriptionPlans.map((plan) => ({
      key: plan.key,
      name: plan.name,
      amountBRL: plan.amountBRL,
      interval: plan.interval,
    }))).toEqual([
      { key: 'go', name: 'Go', amountBRL: 20, interval: 'month' },
      { key: 'pro', name: 'Pro', amountBRL: 50, interval: 'month' },
      { key: 'ultra', name: 'Ultra', amountBRL: 99, interval: 'month' },
    ]);
  });

  it('formats prices for Brazilian monthly subscriptions', () => {
    expect(formatPlanPrice(resolveSubscriptionPlan('ultra'))).toBe('R$ 99/mes');
  });

  it('accepts only known plan keys', () => {
    expect(resolveSubscriptionPlan('go').key).toBe<SubscriptionPlanKey>('go');
    expect(() => resolveSubscriptionPlan('enterprise')).toThrow('Plano invalido');
  });
});
