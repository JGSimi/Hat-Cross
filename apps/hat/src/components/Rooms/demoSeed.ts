// Dados de DEMONSTRAÇÃO local — permitem ver a UI das salas completa antes
// do backend/credenciais existirem. Nunca tocam a rede; populam só o store.

import { useRoomStore } from '../../stores/roomStore';
import type {
  Room,
  RoomCluster,
  RoomEntry,
  RoomNotification,
} from '../../domain/rooms/types';

export const DEMO_UID = 'demo-eu';
export const DEMO_ROOM_ID = 'demo-prova-anatomia';

const now = Date.now();

const room: Room = {
  id: DEMO_ROOM_ID,
  title: 'Prova de Anatomia · Turma B',
  ownerUid: 'demo-rafa',
  status: 'open',
  joinCost: 800,
  createdAt: now - 42 * 60_000,
  updatedAt: now - 30_000,
  memberCount: 7,
};

const secondRoom: Room = {
  id: 'demo-simulado-oab',
  title: 'Simulado OAB — 2ª fase',
  ownerUid: 'demo-kat',
  status: 'locked',
  joinCost: 800,
  createdAt: now - 3 * 3_600_000,
  updatedAt: now - 50 * 60_000,
  memberCount: 12,
};

const entries: RoomEntry[] = [
  {
    id: 'e1',
    uid: 'demo-rafa',
    questionText:
      'Qual nervo craniano é responsável pela inervação motora da língua?',
    aiAnswer: 'O nervo hipoglosso (XII par craniano).',
    extractedAnswer: 'Hipoglosso (XII)',
    answerType: 'short_text',
    confidence: 0.93,
    mode: 'hat',
    createdAt: now - 18 * 60_000,
    sourceMessageId: 'm1',
    clusterId: 'cl-nervo',
  },
  {
    id: 'e2',
    uid: DEMO_UID,
    questionText: 'Que nervo faz a inervação motora da língua?',
    aiAnswer: 'O nervo glossofaríngeo (IX).',
    extractedAnswer: 'Glossofaríngeo (IX)',
    answerType: 'short_text',
    confidence: 0.71,
    mode: 'hat',
    createdAt: now - 16 * 60_000,
    sourceMessageId: 'm2',
    clusterId: 'cl-nervo',
  },
  {
    id: 'e3',
    uid: 'demo-luiza',
    questionText: 'Inervação motora da língua — qual par craniano?',
    aiAnswer: 'XII — hipoglosso.',
    extractedAnswer: 'Hipoglosso (XII)',
    answerType: 'short_text',
    confidence: 0.95,
    mode: 'hat-pro',
    createdAt: now - 14 * 60_000,
    sourceMessageId: 'm3',
    clusterId: 'cl-nervo',
  },
  {
    id: 'e4',
    uid: 'demo-kat',
    questionText: 'Quantos ossos tem o crânio humano adulto (neurocrânio)?',
    aiAnswer: 'O neurocrânio tem 8 ossos.',
    extractedAnswer: 8,
    answerType: 'numeric',
    confidence: 0.97,
    mode: 'hat',
    createdAt: now - 9 * 60_000,
    sourceMessageId: 'm4',
    clusterId: 'cl-ossos',
  },
  {
    id: 'e5',
    uid: DEMO_UID,
    questionText: 'Número de ossos do neurocrânio?',
    aiAnswer: '8 ossos.',
    extractedAnswer: 8,
    answerType: 'numeric',
    confidence: 0.96,
    mode: 'hat',
    createdAt: now - 7 * 60_000,
    sourceMessageId: 'm5',
    clusterId: 'cl-ossos',
  },
  {
    id: 'e6',
    uid: 'demo-rafa',
    questionText: 'Explique a circulação do líquor.',
    aiAnswer:
      'Produzido nos plexos coroides, circula pelos ventrículos e espaço subaracnóideo…',
    extractedAnswer: null,
    answerType: 'open_text',
    confidence: 0.6,
    mode: 'hat-pro',
    createdAt: now - 3 * 60_000,
    sourceMessageId: 'm6',
    clusterId: 'cl-liquor',
  },
];

const clusters: RoomCluster[] = [
  {
    id: 'cl-nervo',
    canonicalQuestion: 'Qual nervo faz a inervação motora da língua?',
    answerType: 'short_text',
    consensusAnswer: 'Hipoglosso (XII)',
    consensusConfidence: 0.91,
    entryIds: ['e1', 'e2', 'e3'],
    divergentEntryIds: ['e2'],
    updatedAt: now - 13 * 60_000,
  },
  {
    id: 'cl-ossos',
    canonicalQuestion: 'Quantos ossos tem o neurocrânio adulto?',
    answerType: 'numeric',
    consensusAnswer: 8,
    consensusConfidence: 0.97,
    entryIds: ['e4', 'e5'],
    divergentEntryIds: [],
    updatedAt: now - 6 * 60_000,
  },
  {
    id: 'cl-liquor',
    canonicalQuestion: 'Explique a circulação do líquor.',
    answerType: 'open_text',
    consensusAnswer: null,
    consensusConfidence: 0,
    entryIds: ['e6'],
    divergentEntryIds: [],
    updatedAt: now - 2 * 60_000,
  },
];

const notifications: RoomNotification[] = [
  {
    id: 'n1',
    uid: DEMO_UID,
    entryId: 'e2',
    clusterId: 'cl-nervo',
    kind: 'divergence',
    severity: 'warning',
    message:
      'Sua resposta "Glossofaríngeo (IX)" diverge do consenso da sala (Hipoglosso XII).',
    createdAt: now - 12 * 60_000,
  },
];

/** Popula o store com a sala de demonstração e retorna o uid simulado. */
export function seedDemo(): string {
  const store = useRoomStore.getState();
  store.upsertRoom(room);
  store.upsertRoom(secondRoom);
  store.upsertEntries(DEMO_ROOM_ID, entries);
  store.upsertClusters(DEMO_ROOM_ID, clusters);
  store.upsertNotifications(notifications);
  return DEMO_UID;
}
