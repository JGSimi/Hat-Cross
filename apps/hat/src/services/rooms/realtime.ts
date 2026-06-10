// Listeners Firestore realtime → roomStore. Adapter fino (não testado em
// unidade, como bridge/tauri.ts): mapeia docs do Firestore para os tipos de
// domínio e empurra para o store. A lógica pura (merge, consenso) já é testada.

import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  type Firestore,
  type Timestamp,
} from 'firebase/firestore';

import type { AuthConfig } from '../auth/config';
import { getDb } from '../firebase/app';
import { useRoomStore } from '../../stores/roomStore';
import type {
  AnswerType,
  Room,
  RoomCluster,
  RoomEntry,
  RoomNotification,
  RoomStatus,
} from '../../domain/rooms/types';

type Doc = Record<string, unknown>;

function ms(value: unknown): number {
  if (value && typeof (value as Timestamp).toMillis === 'function') {
    return (value as Timestamp).toMillis();
  }
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function mapRoom(id: string, d: Doc): Room {
  return {
    id,
    title: str(d.title, 'Sala'),
    ownerUid: str(d.ownerUid),
    status: (str(d.status, 'open') as RoomStatus),
    joinCost: 0,
    createdAt: ms(d.createdAt),
    updatedAt: ms(d.updatedAt),
    memberCount: num(d.memberCount, 1),
  };
}

function mapEntry(id: string, d: Doc): RoomEntry {
  const extracted = d.extractedAnswer;
  return {
    id,
    uid: str(d.uid),
    questionText: str(d.questionText),
    aiAnswer: str(d.aiAnswer),
    extractedAnswer:
      typeof extracted === 'number' || typeof extracted === 'string' ? extracted : null,
    answerType: (str(d.answerType, 'unknown') as AnswerType),
    confidence: num(d.confidence),
    mode: d.mode === 'hat-pro' ? 'hat-pro' : 'hat',
    createdAt: ms(d.createdAt),
    sourceMessageId: str(d.sourceMessageId, id),
    clusterId: str(d.clusterId),
  };
}

function mapCluster(id: string, d: Doc): RoomCluster {
  const consensus = d.consensusAnswer;
  return {
    id,
    canonicalQuestion: str(d.canonicalQuestion),
    answerType: (str(d.answerType, 'unknown') as AnswerType),
    consensusAnswer:
      typeof consensus === 'number' || typeof consensus === 'string' ? consensus : null,
    consensusAnswerText: typeof d.consensusAnswerText === 'string' ? d.consensusAnswerText : null,
    consensusConfidence: num(d.consensusConfidence),
    entryIds: strArray(d.entryIds),
    divergentEntryIds: strArray(d.divergentEntryIds),
    updatedAt: ms(d.updatedAt),
  };
}

function mapNotification(id: string, d: Doc): RoomNotification {
  return {
    id,
    uid: str(d.uid),
    entryId: str(d.entryId),
    clusterId: str(d.clusterId),
    kind: d.kind === 'consensus_changed' ? 'consensus_changed' : 'divergence',
    severity: d.severity === 'error' ? 'error' : d.severity === 'warning' ? 'warning' : 'info',
    message: str(d.message),
    suggestedCorrectAnswer: typeof d.suggestedCorrectAnswer === 'string' ? d.suggestedCorrectAnswer : undefined,
    suggestedCorrectOptionLabel:
      typeof d.suggestedCorrectOptionLabel === 'string' ? d.suggestedCorrectOptionLabel : null,
    questionPreview: typeof d.questionPreview === 'string' ? d.questionPreview : undefined,
    confidence: typeof d.confidence === 'number' ? d.confidence : undefined,
    createdAt: ms(d.createdAt),
  };
}

/**
 * Assina a lista de salas do usuário (espelho users/{uid}/rooms) → roomStore.
 * O espelho carrega todos os campos de Room, suficiente para a lista.
 */
export function subscribeMyRooms(config: AuthConfig['firebase'], myUid: string): () => void {
  const db = getDb(config);
  const store = useRoomStore.getState();
  return onSnapshot(collection(db, 'users', myUid, 'rooms'), (snap) => {
    for (const d of snap.docs) {
      store.upsertRoom(mapRoom(str((d.data() as Doc).roomId, d.id), d.data() as Doc));
    }
  });
}

/**
 * Assina o realtime de UMA sala (doc + entries + clusters + minhas
 * notificações) e alimenta o roomStore. Retorna unsubscribe.
 */
export function subscribeRoom(
  config: AuthConfig['firebase'],
  roomId: string,
  myUid: string,
): () => void {
  const db: Firestore = getDb(config);
  const store = useRoomStore.getState();

  const offRoom = onSnapshot(doc(db, 'rooms', roomId), (snap) => {
    if (snap.exists()) store.upsertRoom(mapRoom(snap.id, snap.data() as Doc));
  });

  const offEntries = onSnapshot(collection(db, 'rooms', roomId, 'entries'), (snap) => {
    const entries = snap.docs.map((d) => mapEntry(d.id, d.data() as Doc));
    if (entries.length) store.upsertEntries(roomId, entries);
  });

  const offClusters = onSnapshot(collection(db, 'rooms', roomId, 'clusters'), (snap) => {
    const clusters = snap.docs.map((d) => mapCluster(d.id, d.data() as Doc));
    if (clusters.length) store.upsertClusters(roomId, clusters);
  });

  // Só as minhas correções (rules também exigem isso).
  const offNotifs = onSnapshot(
    query(collection(db, 'rooms', roomId, 'notifications'), where('uid', '==', myUid)),
    (snap) => {
      const notifications = snap.docs.map((d) => mapNotification(d.id, d.data() as Doc));
      if (notifications.length) store.upsertNotifications(notifications);
    },
  );

  return () => {
    offRoom();
    offEntries();
    offClusters();
    offNotifs();
  };
}
