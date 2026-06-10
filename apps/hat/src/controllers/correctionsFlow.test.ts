import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockBridge, type MockBridge } from '../bridge/mock';
import { startCorrectionsFlow } from './correctionsFlow';
import type { RoomNotification } from '../domain/rooms/types';

function notif(over: Partial<RoomNotification> & { id: string }): RoomNotification {
  return {
    uid: 'me',
    entryId: 'e1',
    clusterId: 'c1',
    kind: 'divergence',
    severity: 'error',
    message: 'msg',
    suggestedCorrectOptionLabel: 'B',
    questionPreview: 'Capital da França?',
    createdAt: 1000,
    ...over,
  };
}

describe('startCorrectionsFlow', () => {
  let bridge: MockBridge;
  beforeEach(() => {
    bridge = createMockBridge();
  });

  it('mostra a próxima correção no flash e marca como lida', async () => {
    const markRead = vi.fn();
    let list = [notif({ id: 'a' })];
    startCorrectionsFlow({ bridge, getNotifications: () => list, markRead });

    bridge.emit('shortcut:show-correction', undefined);
    await vi.waitFor(() => {
      expect(bridge.calls.some((c) => c.method === 'flashShowText')).toBe(true);
    });
    const call = bridge.calls.find((c) => c.method === 'flashShowText');
    expect(String(call?.args[0])).toContain('(B)');
    expect(markRead).toHaveBeenCalledWith('a');
  });

  it('sem pendência: onEmpty e nada de flash', async () => {
    const onEmpty = vi.fn();
    startCorrectionsFlow({
      bridge,
      getNotifications: () => [notif({ id: 'a', readAt: 1 })],
      markRead: vi.fn(),
      onEmpty,
    });
    bridge.emit('shortcut:show-correction', undefined);
    await Promise.resolve();
    expect(onEmpty).toHaveBeenCalledOnce();
    expect(bridge.calls.some((c) => c.method === 'flashShowText')).toBe(false);
  });

  it('lê o snapshot no momento do atalho (não no setup)', async () => {
    const markRead = vi.fn();
    let list: RoomNotification[] = [];
    startCorrectionsFlow({ bridge, getNotifications: () => list, markRead });

    bridge.emit('shortcut:show-correction', undefined); // vazio
    list = [notif({ id: 'tardia' })];
    bridge.emit('shortcut:show-correction', undefined); // agora tem
    await vi.waitFor(() => expect(markRead).toHaveBeenCalledWith('tardia'));
  });
});
