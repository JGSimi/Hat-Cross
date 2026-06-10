// Porta de autenticação: o que o app precisa de um provedor de identidade,
// sem acoplar a Firebase. O adaptador real (services/auth/firebase.ts) será
// plugado quando as credenciais existirem; testes usam um fake.

import type { RawToken } from '../domain/auth/tokenManager';

export interface AuthSession {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export interface AuthPort {
  signInWithGoogle(): Promise<AuthSession>;
  signOut(): Promise<void>;
  /** Token cru + vencimento, consumido pelo TokenManager. */
  fetchIdToken(forceRefresh: boolean): Promise<RawToken>;
  /** Sessão atual (null se deslogado). */
  currentSession(): AuthSession | null;
  /** Observa mudanças de sessão; retorna unsubscribe. */
  onAuthChange(handler: (session: AuthSession | null) => void): () => void;
}
