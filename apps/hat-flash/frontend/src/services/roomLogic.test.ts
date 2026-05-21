import { describe, expect, it } from 'vitest';
import type { ClipboardHistoryEntry } from '../types/clipboard';
import type { Room, RoomEntry } from './rooms';
import { canShareClipboardToRoom, reconcileClipboardRoomShares, visibleMemberCount } from './roomLogic';

const room: Room = {
  id: 'HF-1',
  title: 'Sala',
  ownerUid: 'u1',
  status: 'open',
  joinCost: 800,
  createdAt: 1,
  updatedAt: 2,
  memberCount: 1,
};

const historyEntry: ClipboardHistoryEntry = {
  id: 'local-1',
  createdAt: 1,
  text: 'Pergunta',
  image: null,
  response: 'Resposta',
  roomId: 'HF-1',
  roomTitle: 'Sala',
  sourceMessageId: 'local-1',
  sharedToRoom: false,
  roomSharePending: true,
  status: 'done',
  flashShown: false,
};

const roomEntry: RoomEntry = {
  id: 'remote-1',
  uid: 'u1',
  questionText: 'Pergunta',
  aiAnswer: 'Resposta',
  extractedAnswer: null,
  normalizedQuestion: 'pergunta',
  answerOptions: [],
  selectedOptionLabel: null,
  selectedOptionText: null,
  canonicalAnswerText: null,
  questionPreview: 'Pergunta',
  answerType: 'unknown',
  confidence: 0,
  mode: 'hat',
  createdAt: 2,
  sourceMessageId: 'local-1',
  clusterId: 'cluster-1',
};

describe('roomLogic', () => {
  it('shares clipboard to an open active room even before comparison starts', () => {
    expect(canShareClipboardToRoom(room, visibleMemberCount(room, 1))).toBe(true);
    expect(canShareClipboardToRoom({ ...room, memberCount: 2 }, visibleMemberCount({ ...room, memberCount: 2 }, 0))).toBe(true);
    expect(canShareClipboardToRoom({ ...room, status: 'ended', memberCount: 2 }, 2)).toBe(false);
  });

  it('marks local clipboard as shared only after matching remote room entry exists', () => {
    const unchanged = reconcileClipboardRoomShares([historyEntry], []);
    expect(unchanged[0].sharedToRoom).toBe(false);
    expect(unchanged[0].roomSharePending).toBe(true);

    const reconciled = reconcileClipboardRoomShares([historyEntry], [roomEntry]);
    expect(reconciled[0].sharedToRoom).toBe(true);
    expect(reconciled[0].roomSharePending).toBe(false);
    expect(reconciled[0].roomShareError).toBe(false);
  });
});
