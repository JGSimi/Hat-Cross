// Data model das salas — espelho do contrato Firestore definido em
// docs/plan-salas-questionario.md. Mantido como fonte única no cliente.

export type RoomStatus = 'open' | 'locked' | 'ended';
export type RoomRole = 'owner' | 'member';
export type AnswerType =
  | 'multiple_choice'
  | 'numeric'
  | 'short_text'
  | 'open_text'
  | 'unknown';

export interface Room {
  id: string;
  title: string;
  ownerUid: string;
  status: RoomStatus;
  /** Custo de entrada. Pivot 2026-06: salas grátis → 0. */
  joinCost: number;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
  memberCount: number;
}

export interface RoomMember {
  uid: string;
  role: RoomRole;
  displayName: string | null;
  photoURL: string | null;
  paidAt: number;
  lastSeenAt: number;
  creditsCharged: number;
}

export interface RoomEntry {
  id: string;
  uid: string;
  questionText: string;
  aiAnswer: string;
  extractedAnswer: string | number | null;
  answerType: AnswerType;
  confidence: number;
  mode: 'hat' | 'hat-pro';
  createdAt: number;
  sourceMessageId: string;
  clusterId?: string;
}

export interface RoomCluster {
  id: string;
  canonicalQuestion: string;
  answerType: AnswerType;
  consensusAnswer: string | number | null;
  /** Texto da alternativa correta (preferido na UI sobre a letra). */
  consensusAnswerText?: string | null;
  consensusConfidence: number;
  entryIds: string[];
  divergentEntryIds: string[];
  updatedAt: number;
}

export interface RoomNotification {
  id: string;
  uid: string;
  entryId: string;
  clusterId: string;
  kind: 'divergence' | 'consensus_changed';
  severity: 'info' | 'warning' | 'error';
  message: string;
  /** Resposta correta (texto) — usada no Flash de correção. */
  suggestedCorrectAnswer?: string;
  /** Letra da alternativa correta, quando múltipla escolha. */
  suggestedCorrectOptionLabel?: string | null;
  questionPreview?: string;
  confidence?: number;
  createdAt: number;
  /** Local-only: rules negam escrita do cliente; cada device marca o que já mostrou. */
  readAt?: number;
}
