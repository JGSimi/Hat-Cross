import { describe, expect, it } from 'vitest';
import {
  billingEntitlements,
  billingRestrictionMessage,
  canAccessHatProMode,
  canAccessSharedRooms,
  canUseAI,
  type BillingAccessStatus,
} from './billingEntitlements';

const inactiveStatuses: BillingAccessStatus[] = ['none', 'canceled', 'past_due', 'incomplete', 'paused'];

describe('billing entitlements', () => {
  it('blocks paid AI access without an active subscription', () => {
    for (const status of inactiveStatuses) {
      expect(canUseAI({ status, plan: null, currentPeriodEnd: null })).toBe(false);
    }
  });

  it('allows paid AI access for every active plan', () => {
    expect(canUseAI({ status: 'active', plan: 'go', currentPeriodEnd: null })).toBe(true);
    expect(canUseAI({ status: 'trialing', plan: 'ultra', currentPeriodEnd: null })).toBe(true);
  });

  it('keeps Go personal and unlocks shared rooms plus Hat Pro for Pro and Ultra', () => {
    const go = billingEntitlements({ status: 'active', plan: 'go', currentPeriodEnd: null });
    const pro = billingEntitlements({ status: 'active', plan: 'pro', currentPeriodEnd: null });
    const ultra = billingEntitlements({ status: 'active', plan: 'ultra', currentPeriodEnd: null });

    expect(go).toMatchObject({ canUseAI: true, canUseSharedRooms: false, canUseHatProMode: false });
    expect(pro).toMatchObject({ canUseAI: true, canUseSharedRooms: true, canUseHatProMode: true });
    expect(ultra).toMatchObject({ canUseAI: true, canUseSharedRooms: true, canUseHatProMode: true, priority: 'ultra' });
  });

  it('normalizes unknown or missing subscription status as locked', () => {
    expect(billingEntitlements(null)).toMatchObject({
      canUseAI: false,
      canUseSharedRooms: false,
      canUseHatProMode: false,
      activePlan: null,
    });
  });

  it('explains the first violated feature gate in user-facing Portuguese', () => {
    const go = { status: 'active', plan: 'go', currentPeriodEnd: null } as const;
    const none = { status: 'none', plan: null, currentPeriodEnd: null } as const;

    expect(billingRestrictionMessage('ai', none)).toContain('Assine');
    expect(billingRestrictionMessage('rooms', go)).toContain('Pro ou Ultra');
    expect(billingRestrictionMessage('hat-pro', go)).toContain('Pro ou Ultra');
  });

  it('exposes focused predicates for UI gates', () => {
    const pro = { status: 'active', plan: 'pro', currentPeriodEnd: null } as const;
    const go = { status: 'active', plan: 'go', currentPeriodEnd: null } as const;

    expect(canAccessSharedRooms(pro)).toBe(true);
    expect(canAccessHatProMode(pro)).toBe(true);
    expect(canAccessSharedRooms(go)).toBe(false);
    expect(canAccessHatProMode(go)).toBe(false);
  });
});
