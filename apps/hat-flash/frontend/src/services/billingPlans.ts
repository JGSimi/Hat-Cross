export type SubscriptionPlanKey = 'go' | 'pro' | 'ultra';
export type BillingInterval = 'month';

export interface SubscriptionPlan {
  key: SubscriptionPlanKey;
  name: string;
  amountBRL: number;
  interval: BillingInterval;
  badge: string;
  included: string[];
}

export const subscriptionPlans = [
  {
    key: 'go',
    name: 'Go',
    amountBRL: 20,
    interval: 'month',
    badge: 'Essencial',
    included: ['Uso pessoal', 'Clipboard + Flash', 'Historico local'],
  },
  {
    key: 'pro',
    name: 'Pro',
    amountBRL: 50,
    interval: 'month',
    badge: 'Mais usado',
    included: ['Tudo do Go', 'Salas compartilhadas', 'Modo Pro'],
  },
  {
    key: 'ultra',
    name: 'Ultra',
    amountBRL: 99,
    interval: 'month',
    badge: 'Completo',
    included: ['Tudo do Pro', 'Prioridade no proxy', 'Uso intensivo'],
  },
] as const satisfies readonly SubscriptionPlan[];

export function resolveSubscriptionPlan(value: string): SubscriptionPlan {
  const plan = subscriptionPlans.find((candidate) => candidate.key === value);
  if (!plan) throw new Error('Plano invalido.');
  return plan;
}

export function formatPlanPrice(plan: Pick<SubscriptionPlan, 'amountBRL' | 'interval'>): string {
  const currency = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(plan.amountBRL).replace(/\s+/g, ' ');
  return `${currency}/mes`;
}
