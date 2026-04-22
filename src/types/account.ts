// Account / credits domain types. The two AI modes mirror exactly what the
// Worker expects in POST /v1/chat — keep these strings in sync with hat-proxy.

export type AIMode = 'hat' | 'hat-pro';

export const VALID_MODES: ReadonlySet<AIMode> = new Set(['hat', 'hat-pro']);

export interface AIModeDefinition {
  id: AIMode;
  label: string;
  description: string;
}

export const AI_MODES: readonly AIModeDefinition[] = [
  { id: 'hat',     label: 'Hat',     description: 'Rápido e econômico' },
  { id: 'hat-pro', label: 'Hat Pro', description: 'Mais capaz, ainda rápido' },
] as const;

export interface HatUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

/**
 * Shape do documento Firestore em `users/{uid}`. Mantido em sync com o
 * backend hat-proxy. Campos são todos opcionais no TypeScript porque a
 * migração é gradual — user docs antigos podem não ter creditsSpent /
 * unlockedThemes ainda. Código consumidor deve tratar undefined como
 * valor inicial (0 / []).
 */
export interface UserDoc {
  credits?: number;
  /** Cumulativo: soma dos créditos já descontados ao longo da vida do usuário. */
  creditsSpent?: number;
  /** Temas desbloqueados pelo backend ao cruzar milestones de creditsSpent. */
  unlockedThemes?: string[];
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
