import {
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { firestore } from './firebase';

const HAT_PROXY_URL = 'https://hat-proxy.joao02simi.workers.dev';

export type RoomStatus = 'open' | 'locked' | 'ended';
export type RoomRole = 'owner' | 'member';
export type AnswerType = 'multiple_choice' | 'numeric' | 'short_text' | 'open_text' | 'unknown';
export type RoomMode = 'hat' | 'hat-pro';

export interface AnswerOption {
  label: string;
  text: string;
  normalizedText: string;
}

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
  normalizedQuestion: string;
  answerOptions: AnswerOption[];
  selectedOptionLabel: string | null;
  selectedOptionText: string | null;
  canonicalAnswerText: string | null;
  questionPreview: string;
  answerType: AnswerType;
  confidence: number;
  mode: RoomMode;
  createdAt: number;
  sourceMessageId: string;
  clusterId: string;
}

export interface RoomCluster {
  id: string;
  canonicalQuestion: string;
  answerType: AnswerType;
  consensusAnswer: string | number | null;
  consensusAnswerText: string | null;
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
  suggestedCorrectAnswer?: string;
  suggestedCorrectOptionLabel?: string | null;
  questionPreview?: string;
  confidence?: number;
  createdAt: number;
  readAt?: number;
  seenAt?: number;
}

export interface RoomJoinResult {
  roomId: string;
  charged: boolean;
  alreadyMember: boolean;
  joinCost: number;
}

export interface UserRoomState {
  activeRoomId: string | null;
  rooms: Room[];
}

function toMillis(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Date.parse(value) || 0;
  if (value && typeof value === 'object') {
    const maybe = value as { toMillis?: () => number; seconds?: number; _seconds?: number };
    if (typeof maybe.toMillis === 'function') return maybe.toMillis();
    if (typeof maybe.seconds === 'number') return maybe.seconds * 1000;
    if (typeof maybe._seconds === 'number') return maybe._seconds * 1000;
  }
  return 0;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function answerOptions(value: unknown): AnswerOption[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const data = item as Record<string, unknown>;
      const label = typeof data.label === 'string' ? data.label : '';
      const text = typeof data.text === 'string' ? data.text : '';
      const normalizedText = typeof data.normalizedText === 'string' ? data.normalizedText : '';
      return label && text ? { label, text, normalizedText } : null;
    })
    .filter((item): item is AnswerOption => Boolean(item));
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
    normalizedQuestion: typeof data.normalizedQuestion === 'string' ? data.normalizedQuestion : '',
    answerOptions: answerOptions(data.answerOptions),
    selectedOptionLabel: typeof data.selectedOptionLabel === 'string' ? data.selectedOptionLabel : null,
    selectedOptionText: typeof data.selectedOptionText === 'string' ? data.selectedOptionText : null,
    canonicalAnswerText: typeof data.canonicalAnswerText === 'string' ? data.canonicalAnswerText : null,
    questionPreview: typeof data.questionPreview === 'string' ? data.questionPreview : '',
    answerType,
    confidence: typeof data.confidence === 'number' ? data.confidence : 0,
    mode: data.mode === 'hat-pro' ? 'hat-pro' : 'hat',
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
    consensusAnswerText: typeof data.consensusAnswerText === 'string' ? data.consensusAnswerText : null,
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
    severity: data.severity === 'error' ? 'error' : data.severity === 'info' ? 'info' : 'warning',
    message: typeof data.message === 'string' ? data.message : '',
    suggestedCorrectAnswer: typeof data.suggestedCorrectAnswer === 'string' ? data.suggestedCorrectAnswer : undefined,
    suggestedCorrectOptionLabel: typeof data.suggestedCorrectOptionLabel === 'string' ? data.suggestedCorrectOptionLabel : null,
    questionPreview: typeof data.questionPreview === 'string' ? data.questionPreview : undefined,
    confidence: typeof data.confidence === 'number' ? data.confidence : undefined,
    createdAt: toMillis(data.createdAt),
    readAt: data.readAt ? toMillis(data.readAt) : undefined,
    seenAt: data.seenAt ? toMillis(data.seenAt) : undefined,
  };
}

function sortRooms(rooms: Room[]) {
  return [...rooms].sort((a, b) => b.updatedAt - a.updatedAt);
}

function sortEntries(entries: RoomEntry[]) {
  return [...entries].sort((a, b) => b.createdAt - a.createdAt);
}

export function listenUserRoomState(
  uid: string,
  onState: (state: UserRoomState) => void,
  onError: (error: Error) => void,
): () => void {
  if (!firestore) {
    onState({ activeRoomId: null, rooms: [] });
    return () => undefined;
  }

  let activeRoomId: string | null = null;
  let rooms: Room[] = [];
  const emit = () => onState({ activeRoomId, rooms: sortRooms(rooms.filter((room) => room.status === 'open')) });

  const unsubUser = onSnapshot(
    doc(firestore, 'users', uid),
    (snapshot) => {
      const data = snapshot.data() ?? {};
      activeRoomId = typeof data.activeRoomId === 'string' ? data.activeRoomId : null;
      emit();
    },
    onError,
  );

  const unsubRooms = onSnapshot(
    query(collection(firestore, 'users', uid, 'rooms'), limit(20)),
    (snapshot) => {
      rooms = snapshot.docs.map((item) => roomFromData(item.id, item.data()));
      emit();
    },
    onError,
  );

  return () => {
    unsubUser();
    unsubRooms();
  };
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
  if (!firestore) {
    handlers.onError(new Error('firebase env missing'));
    return () => undefined;
  }

  const unsubs = [
    onSnapshot(
      doc(firestore, 'rooms', roomId),
      (snapshot) => handlers.onRoom(snapshot.exists() ? roomFromData(snapshot.id, snapshot.data()) : null),
      handlers.onError,
    ),
    onSnapshot(
      query(collection(firestore, 'rooms', roomId, 'members'), limit(50)),
      (snapshot) => handlers.onMembers(snapshot.docs.map((item) => memberFromData(item.id, item.data()))),
      handlers.onError,
    ),
    onSnapshot(
      query(collection(firestore, 'rooms', roomId, 'entries'), limit(100)),
      (snapshot) => handlers.onEntries(sortEntries(snapshot.docs.map((item) => entryFromData(item.id, item.data())))),
      handlers.onError,
    ),
    onSnapshot(
      query(collection(firestore, 'rooms', roomId, 'clusters'), limit(50)),
      (snapshot) =>
        handlers.onClusters(snapshot.docs.map((item) => clusterFromData(item.id, item.data())).sort((a, b) => b.updatedAt - a.updatedAt)),
      handlers.onError,
    ),
    onSnapshot(
      query(collection(firestore, 'rooms', roomId, 'notifications'), where('uid', '==', uid), limit(50)),
      (snapshot) =>
        handlers.onNotifications(snapshot.docs.map((item) => notificationFromData(item.id, item.data())).sort((a, b) => b.createdAt - a.createdAt)),
      handlers.onError,
    ),
  ];

  return () => {
    for (const unsubscribe of unsubs) unsubscribe();
  };
}

async function authedHeaders(idToken: string): Promise<HeadersInit> {
  return {
    Authorization: `Bearer ${idToken}`,
    'Content-Type': 'application/json',
    'Idempotency-Key': crypto.randomUUID(),
  };
}

async function parse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof body.error === 'string' ? body.error : `room:${response.status}`);
  }
  return body as T;
}

export async function createRoom(title: string, idToken: string): Promise<RoomJoinResult> {
  const response = await fetch(`${HAT_PROXY_URL}/v1/rooms`, {
    method: 'POST',
    headers: await authedHeaders(idToken),
    body: JSON.stringify({ title }),
  });
  return parse<RoomJoinResult>(response);
}

export async function joinRoom(roomId: string, idToken: string): Promise<RoomJoinResult> {
  const response = await fetch(`${HAT_PROXY_URL}/v1/rooms/${encodeURIComponent(roomId)}/join`, {
    method: 'POST',
    headers: await authedHeaders(idToken),
    body: JSON.stringify({}),
  });
  return parse<RoomJoinResult>(response);
}

export async function leaveRoom(roomId: string, idToken: string): Promise<void> {
  const response = await fetch(`${HAT_PROXY_URL}/v1/rooms/${encodeURIComponent(roomId)}/leave`, {
    method: 'POST',
    headers: await authedHeaders(idToken),
    body: JSON.stringify({}),
  });
  await parse(response);
}
