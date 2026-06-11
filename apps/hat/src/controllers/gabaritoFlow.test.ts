import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockBridge, type MockBridge } from '../bridge/mock';
import { startGabaritoFlow } from './gabaritoFlow';
import type { RoomCluster } from '../domain/rooms/types';

function cluster(id: string): RoomCluster {
  return {
    id,
    canonicalQuestion: 'Q',
    answerType: 'multiple_choice',
    consensusAnswer: 'B',
    consensusAnswerText: '(B)',
    consensusConfidence: 0.9,
    entryIds: [],
    divergentEntryIds: [],
    updatedAt: 1,
  };
}

describe('startGabaritoFlow', () => {
  let bridge: MockBridge;
  beforeEach(() => {
    bridge = createMockBridge();
  });

  it('1º atalho mostra (com itens da sala), 2º esconde — alterna', async () => {
    startGabaritoFlow({
      bridge,
      getRoomData: () => ({ clusters: [cluster('c1')], entries: [], myUid: 'me' }),
    });

    bridge.emit('shortcut:toggle-gabarito', undefined);
    await vi.waitFor(() =>
      expect(bridge.calls.some((c) => c.method === 'gabaritoShow')).toBe(true),
    );
    const showCall = bridge.calls.find((c) => c.method === 'gabaritoShow');
    expect((showCall?.args[0] as unknown[]).length).toBe(1);

    bridge.emit('shortcut:toggle-gabarito', undefined);
    await vi.waitFor(() =>
      expect(bridge.calls.some((c) => c.method === 'gabaritoHide')).toBe(true),
    );
  });

  it('sem sala ativa mostra gabarito vazio', async () => {
    startGabaritoFlow({ bridge, getRoomData: () => null });
    bridge.emit('shortcut:toggle-gabarito', undefined);
    await vi.waitFor(() => {
      const call = bridge.calls.find((c) => c.method === 'gabaritoShow');
      expect(call).toBeTruthy();
      expect((call?.args[0] as unknown[]).length).toBe(0);
    });
  });
});
