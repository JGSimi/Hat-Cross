import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { firebaseApp } from '../auth/firebase';
import type { Room, RoomCluster, RoomEntry, RoomMember, RoomNotification } from '../../types/rooms';

const firestore = getFirestore(firebaseApp);

function toMillis(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Date.parse(value) || 0;
  if (value && typeof value === 'object') {
    const maybe = value as { toMillis?: () => number; seconds?: number };
    if (typeof maybe.toMillis === 'function') return maybe.toMillis();
    if (typeof maybe.seconds === 'number') return maybe.seconds * 1000;
  }
  return 0;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function roomFromData(id: string, data: Record<string, unknown>): Room {
  return {
    id,
    title: typeof data.title === 'string' ? data.title : 'Sala sem nome',
    ownerUid: typeof data.ownerUid === 'string' ? data.ownerUid : '',
    status: data.status === 'locked' || data.status === 'ended' ? data.status : 'open',
    joinCost: typeof data.joinCost === 'number' ? data.joinCost : 800,
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
    memberCount: typeof data.memberCount === 'number' ? data.memberCount : 0,
  };
}

function memberFromData(id: string, data: Record<string, unknown>): RoomMember {
  return {
    uid: typeof data.uid === 'string' ? data.uid : id,
    role: data.role === 'owner' ? 'owner' : 'member',
    displayName: typeof data.displayName === 'string' ? data.displayName : null,
    photoURL: typeof data.photoURL === 'string' ? data.photoURL : null,
    paidAt: toMillis(data.paidAt),
    lastSeenAt: toMillis(data.lastSeenAt),
    creditsCharged: typeof data.creditsCharged === 'number' ? data.creditsCharged : 800,
  };
}

function entryFromData(id: string, data: Record<string, unknown>): RoomEntry {
  const mode = data.mode === 'hat-pro' ? 'hat-pro' : 'hat';
  const answerType =
    data.answerType === 'multiple_choice' ||
    data.answerType === 'numeric' ||
    data.answerType === 'short_text' ||
    data.answerType === 'open_text'
      ? data.answerType
      : 'unknown';
  return {
    id,
    uid: typeof data.uid === 'string' ? data.uid : '',
    questionText: typeof data.questionText === 'string' ? data.questionText : '',
    aiAnswer: typeof data.aiAnswer === 'string' ? data.aiAnswer : '',
    extractedAnswer:
      typeof data.extractedAnswer === 'string' || typeof data.extractedAnswer === 'number'
        ? data.extractedAnswer
        : null,
    answerType,
    confidence: typeof data.confidence === 'number' ? data.confidence : 0,
    mode,
    createdAt: toMillis(data.createdAt),
    sourceMessageId: typeof data.sourceMessageId === 'string' ? data.sourceMessageId : id,
    clusterId: typeof data.clusterId === 'string' ? data.clusterId : '',
  };
}

function clusterFromData(id: string, data: Record<string, unknown>): RoomCluster {
  const answerType =
    data.answerType === 'multiple_choice' ||
    data.answerType === 'numeric' ||
    data.answerType === 'short_text' ||
    data.answerType === 'open_text'
      ? data.answerType
      : 'unknown';
  return {
    id,
    canonicalQuestion: typeof data.canonicalQuestion === 'string' ? data.canonicalQuestion : '',
    answerType,
    consensusAnswer:
      typeof data.consensusAnswer === 'string' || typeof data.consensusAnswer === 'number'
        ? data.consensusAnswer
        : null,
    consensusConfidence: typeof data.consensusConfidence === 'number' ? data.consensusConfidence : 0,
    entryIds: stringArray(data.entryIds),
    divergentEntryIds: stringArray(data.divergentEntryIds),
    updatedAt: toMillis(data.updatedAt),
  };
}

function notificationFromData(id: string, data: Record<string, unknown>): RoomNotification {
  return {
    id,
    uid: typeof data.uid === 'string' ? data.uid : '',
    entryId: typeof data.entryId === 'string' ? data.entryId : '',
    clusterId: typeof data.clusterId === 'string' ? data.clusterId : '',
    kind: data.kind === 'consensus_changed' ? 'consensus_changed' : 'divergence',
    severity: data.severity === 'info' ? 'info' : 'warning',
    message: typeof data.message === 'string' ? data.message : '',
    createdAt: toMillis(data.createdAt),
    readAt: data.readAt ? toMillis(data.readAt) : undefined,
  };
}

export function listenRooms(
  uid: string,
  onRooms: (rooms: Room[]) => void,
  onError: (error: Error) => void,
): () => void {
  const roomsQuery = collection(firestore, 'users', uid, 'rooms');
  return onSnapshot(
    roomsQuery,
    (snap) => {
      onRooms(snap.docs.map((item) => roomFromData(item.id, item.data())));
    },
    onError,
  );
}

export function listenRoomData(
  roomId: string,
  uid: string,
  handlers: {
    onRoom: (room: Room | null) => void;
    onMembers: (members: RoomMember[]) => void;
    onEntries: (entries: RoomEntry[]) => void;
    onClusters: (clusters: RoomCluster[]) => void;
    onNotifications: (notifications: RoomNotification[]) => void;
    onError: (error: Error) => void;
  },
): () => void {
  const unsubs = [
    onSnapshot(
      doc(firestore, 'rooms', roomId),
      (snap) => handlers.onRoom(snap.exists() ? roomFromData(snap.id, snap.data()) : null),
      handlers.onError,
    ),
    onSnapshot(
      collection(firestore, 'rooms', roomId, 'members'),
      (snap) => handlers.onMembers(snap.docs.map((item) => memberFromData(item.id, item.data()))),
      handlers.onError,
    ),
    onSnapshot(
      collection(firestore, 'rooms', roomId, 'entries'),
      (snap) => handlers.onEntries(snap.docs.map((item) => entryFromData(item.id, item.data()))),
      handlers.onError,
    ),
    onSnapshot(
      collection(firestore, 'rooms', roomId, 'clusters'),
      (snap) => handlers.onClusters(snap.docs.map((item) => clusterFromData(item.id, item.data()))),
      handlers.onError,
    ),
    onSnapshot(
      query(collection(firestore, 'rooms', roomId, 'notifications'), where('uid', '==', uid)),
      (snap) =>
        handlers.onNotifications(snap.docs.map((item) => notificationFromData(item.id, item.data()))),
      handlers.onError,
    ),
  ];

  return () => {
    for (const unsub of unsubs) unsub();
  };
}
