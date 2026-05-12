import { beforeEach, describe, expect, it } from 'vitest';
import { useRoomStore } from '../roomStore';
import type { RoomEntry } from '../../types/rooms';

function makeEntry(id: string, createdAt: number): RoomEntry {
  return {
    id,
    uid: `user-${id}`,
    questionText: 'Pergunta',
    aiAnswer: 'Resposta correta e B',
    extractedAnswer: 'B',
    answerType: 'multiple_choice',
    confidence: 0.9,
    mode: 'hat',
    createdAt,
    sourceMessageId: id,
    clusterId: 'cluster-a',
  };
}

describe('roomStore', () => {
  beforeEach(() => {
    useRoomStore.setState({
      rooms: [],
      activeRoomId: null,
      members: [],
      entries: [],
      clusters: [],
      notifications: [],
      isLoading: false,
      error: null,
    });
  });

  it('upserts entries without duplicating and keeps chronological order', () => {
    const store = useRoomStore.getState();
    store.upsertEntry(makeEntry('b', 20));
    store.upsertEntry(makeEntry('a', 10));
    store.upsertEntry({ ...makeEntry('b', 30), extractedAnswer: 'C' });

    const entries = useRoomStore.getState().entries;
    expect(entries.map((entry) => entry.id)).toEqual(['a', 'b']);
    expect(entries[1].extractedAnswer).toBe('C');
  });

  it('marks notifications as read locally', () => {
    useRoomStore.setState({
      notifications: [
        {
          id: 'n1',
          uid: 'u1',
          entryId: 'e1',
          clusterId: 'c1',
          kind: 'divergence',
          severity: 'warning',
          message: 'Divergiu',
          createdAt: 1,
        },
      ],
    });

    useRoomStore.getState().markNotificationRead('n1');
    expect(useRoomStore.getState().notifications[0].readAt).toEqual(expect.any(Number));
  });
});
