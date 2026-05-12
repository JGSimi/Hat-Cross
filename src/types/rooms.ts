import type { AIMode } from './account';

export const ROOM_JOIN_COST = 800;

export type RoomStatus = 'open' | 'locked' | 'ended';
export type RoomRole = 'owner' | 'member';
export type AnswerType = 'multiple_choice' | 'numeric' | 'short_text' | 'open_text' | 'unknown';

export interface Room {
  id: string;
  title: string;
  ownerUid: string;
  status: RoomStatus;
  joinCost: number;
  createdAt: number;
  updatedAt: number;
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
  mode: AIMode;
  createdAt: number;
  sourceMessageId: string;
  clusterId: string;
}

export interface RoomCluster {
  id: string;
  canonicalQuestion: string;
  answerType: AnswerType;
  consensusAnswer: string | number | null;
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
  severity: 'info' | 'warning';
  message: string;
  createdAt: number;
  readAt?: number;
}

export interface RoomJoinResult {
  roomId: string;
  charged: boolean;
  alreadyMember: boolean;
  joinCost: number;
}
