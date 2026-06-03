import type { SubscriptionStatus, SubscriptionStatusName } from './billingGateway';
import type { SubscriptionPlanKey } from './billingPlans';

export type BillingAccessStatus = SubscriptionStatusName;
export type BillingFeature = 'ai' | 'rooms' | 'hat-pro';

export interface BillingEntitlements {
  activePlan: SubscriptionPlanKey | null;
  canUseAI: boolean;
  canUseSharedRooms: boolean;
  canUseHatProMode: boolean;
  priority: 'standard' | 'ultra';
}

function isPaidStatus(status: SubscriptionStatusName | undefined) {
  return status === 'active' || status === 'trialing';
}

export function billingEntitlements(status: SubscriptionStatus | null): BillingEntitlements {
  const activePlan = isPaidStatus(status?.status) ? status?.plan ?? null : null;
  const tieredPlan = activePlan === 'pro' || activePlan === 'ultra';

  return {
    activePlan,
    canUseAI: Boolean(activePlan),
    canUseSharedRooms: tieredPlan,
    canUseHatProMode: tieredPlan,
    priority: activePlan === 'ultra' ? 'ultra' : 'standard',
  };
}

export function canUseAI(status: SubscriptionStatus | null): boolean {
  return billingEntitlements(status).canUseAI;
}

export function canAccessSharedRooms(status: SubscriptionStatus | null): boolean {
  return billingEntitlements(status).canUseSharedRooms;
}

export function canAccessHatProMode(status: SubscriptionStatus | null): boolean {
  return billingEntitlements(status).canUseHatProMode;
}

export function billingRestrictionMessage(feature: BillingFeature, status: SubscriptionStatus | null): string {
  const entitlements = billingEntitlements(status);
  if (feature === 'ai' && !entitlements.canUseAI) {
    return 'Assine Go, Pro ou Ultra para processar clipboard.';
  }
  if (feature === 'rooms' && !entitlements.canUseSharedRooms) {
    return 'Salas compartilhadas exigem plano Pro ou Ultra.';
  }
  if (feature === 'hat-pro' && !entitlements.canUseHatProMode) {
    return 'Modo Pro exige plano Pro ou Ultra.';
  }
  return '';
}
