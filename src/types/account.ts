// Account / credits domain types. The three AI modes mirror exactly what the
// Worker expects in POST /v1/chat — keep these strings in sync with hat-proxy.

export type AIMode = 'mini' | 'standard' | 'plus';

export interface AIModeDefinition {
  id: AIMode;
  label: string;
  description: string;
}

export const AI_MODES: readonly AIModeDefinition[] = [
  { id: 'mini',     label: 'Hat Mini', description: 'Rápido e barato' },
  { id: 'standard', label: 'Hat',      description: 'Equilibrado' },
  { id: 'plus',     label: 'Hat Plus', description: 'Mais capaz, mais caro' },
] as const;

export interface HatUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface Transaction {
  id: string;
  type: 'spend' | 'recharge';
  amount: number;
  modelUsed?: string;
  tokensIn?: number;
  tokensOut?: number;
  createdAt: number;
}
