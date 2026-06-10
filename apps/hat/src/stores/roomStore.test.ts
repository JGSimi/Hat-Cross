import { beforeEach, describe, expect, it } from 'vitest';

import type { Room, RoomEntry, RoomNotification } from '../domain/rooms/types';
import { useRoomStore } from './roomStore';

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: 'room-1',
    title: 'Sala de teste',
    ownerUid: 'uid-owner',
    status: 'open',
    joinCost: 800,
    createdAt: 1000,
    updatedAt: 1000,
    memberCount: 1,
    ...overrides,
  };
}

function makeEntry(overrides: Partial<RoomEntry> = {}): RoomEntry {
  return {
    id: 'entry-1',
    uid: 'uid-member',
    questionText: 'Quanto é 2 + 2?',
    aiAnswer: '4',
    extractedAnswer: 4,
    answerType: 'numeric',
    confidence: 0.9,
    mode: 'hat',
    createdAt: 100,
    sourceMessageId: 'msg-1',
    ...overrides,
  };
}

function makeNotification(overrides: Partial<RoomNotification> = {}): RoomNotification {
  return {
    id: 'notif-1',
    uid: 'uid-member',
    entryId: 'entry-1',
    clusterId: 'cluster-1',
    kind: 'divergence',
    severity: 'warning',
    message: 'Sua resposta diverge do consenso',
    createdAt: 500,
    ...overrides,
  };
}

beforeEach(() => {
  useRoomStore.setState({
    activeRoomId: null,
    rooms: {},
    entries: {},
    clusters: {},
    notifications: [],
  });
});

describe('roomStore clusters e notificações', () => {
  it('upsertClusters deduplica por id (incoming vence)', () => {
    const cluster = {
      id: 'cl-1',
      canonicalQuestion: 'Pergunta?',
      answerType: 'numeric' as const,
      consensusAnswer: 4,
      consensusConfidence: 0.8,
      entryIds: ['e1'],
      divergentEntryIds: [],
      updatedAt: 1,
    };
    useRoomStore.getState().upsertClusters('room-1', [cluster]);
    useRoomStore
      .getState()
      .upsertClusters('room-1', [{ ...cluster, consensusConfidence: 0.95 }]);

    const clusters = useRoomStore.getState().clusters['room-1'];
    expect(clusters).toHaveLength(1);
    expect(clusters?.[0]?.consensusConfidence).toBe(0.95);
  });

  it('upsertNotifications deduplica por id preservando readAt aplicado depois', () => {
    useRoomStore.getState().upsertNotifications([makeNotification()]);
    useRoomStore.getState().upsertNotifications([makeNotification()]);
    expect(useRoomStore.getState().notifications).toHaveLength(1);

    useRoomStore.getState().markNotificationRead('notif-1');
    expect(useRoomStore.getState().notifications[0]?.readAt).toBeDefined();
  });
});

describe('roomStore', () => {
  it('começa sem sala ativa, sem salas, sem entries e sem notificações', () => {
    const state = useRoomStore.getState();
    expect(state.activeRoomId).toBeNull();
    expect(state.rooms).toEqual({});
    expect(state.entries).toEqual({});
    expect(state.notifications).toEqual([]);
  });

  it('setActiveRoom define e limpa a sala ativa', () => {
    useRoomStore.getState().setActiveRoom('room-1');
    expect(useRoomStore.getState().activeRoomId).toBe('room-1');

    useRoomStore.getState().setActiveRoom(null);
    expect(useRoomStore.getState().activeRoomId).toBeNull();
  });

  it('upsertRoom adiciona sala nova e atualiza existente sem duplicar', () => {
    useRoomStore.getState().upsertRoom(makeRoom({ title: 'Original' }));
    useRoomStore.getState().upsertRoom(makeRoom({ title: 'Atualizada', memberCount: 3 }));

    const { rooms } = useRoomStore.getState();
    expect(Object.keys(rooms)).toEqual(['room-1']);
    expect(rooms['room-1']?.title).toBe('Atualizada');
    expect(rooms['room-1']?.memberCount).toBe(3);
  });

  it('upsertEntries não duplica entry com mesmo id e a versão nova vence', () => {
    useRoomStore.getState().upsertEntries('room-1', [makeEntry({ aiAnswer: 'velha' })]);
    useRoomStore.getState().upsertEntries('room-1', [makeEntry({ aiAnswer: 'nova' })]);

    const entries = useRoomStore.getState().entries['room-1'];
    expect(entries).toHaveLength(1);
    expect(entries?.[0]?.aiAnswer).toBe('nova');
  });

  it('upsertEntries mantém entries ordenadas por createdAt ascendente', () => {
    useRoomStore.getState().upsertEntries('room-1', [
      makeEntry({ id: 'b', createdAt: 200 }),
      makeEntry({ id: 'c', createdAt: 300 }),
    ]);
    useRoomStore.getState().upsertEntries('room-1', [makeEntry({ id: 'a', createdAt: 100 })]);

    const ids = (useRoomStore.getState().entries['room-1'] ?? []).map((e) => e.id);
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('upsertEntries de uma sala não afeta entries de outra sala', () => {
    useRoomStore.getState().upsertEntries('room-1', [makeEntry({ id: 'r1-e1' })]);
    useRoomStore.getState().upsertEntries('room-2', [makeEntry({ id: 'r2-e1' })]);

    const { entries } = useRoomStore.getState();
    expect(entries['room-1']?.map((e) => e.id)).toEqual(['r1-e1']);
    expect(entries['room-2']?.map((e) => e.id)).toEqual(['r2-e1']);
  });

  it('markNotificationRead seta readAt apenas na notificação alvo', () => {
    useRoomStore.setState({
      notifications: [makeNotification({ id: 'n1' }), makeNotification({ id: 'n2' })],
    });

    useRoomStore.getState().markNotificationRead('n1');

    const { notifications } = useRoomStore.getState();
    const n1 = notifications.find((n) => n.id === 'n1');
    const n2 = notifications.find((n) => n.id === 'n2');
    expect(typeof n1?.readAt).toBe('number');
    expect(n2?.readAt).toBeUndefined();
  });

  it('markNotificationRead não sobrescreve readAt de notificação já lida', () => {
    useRoomStore.setState({
      notifications: [makeNotification({ id: 'n1', readAt: 111 })],
    });

    useRoomStore.getState().markNotificationRead('n1');

    expect(useRoomStore.getState().notifications[0]?.readAt).toBe(111);
  });

  it('markNotificationRead com id desconhecido não altera as notificações', () => {
    const original = [makeNotification({ id: 'n1' })];
    useRoomStore.setState({ notifications: original });

    useRoomStore.getState().markNotificationRead('inexistente');

    expect(useRoomStore.getState().notifications).toEqual(original);
    expect(useRoomStore.getState().notifications[0]?.readAt).toBeUndefined();
  });
});
