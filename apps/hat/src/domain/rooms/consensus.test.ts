import { describe, expect, it } from 'vitest';
import { clusterView, divergenceMessage } from './consensus';
import type { RoomCluster, RoomEntry, AnswerType } from './types';

function makeEntry(overrides: Partial<RoomEntry> & { id: string; uid: string }): RoomEntry {
  return {
    questionText: 'Quanto é 2 + 2?',
    aiAnswer: '4',
    extractedAnswer: 4,
    answerType: 'numeric',
    confidence: 0.95,
    mode: 'hat',
    createdAt: 1000,
    sourceMessageId: 'msg-1',
    clusterId: 'cl-1',
    ...overrides,
  };
}

function makeCluster(overrides: Partial<RoomCluster> = {}): RoomCluster {
  return {
    id: 'cl-1',
    canonicalQuestion: 'Quanto é 2 + 2?',
    answerType: 'numeric',
    consensusAnswer: 4,
    consensusConfidence: 0.9,
    entryIds: ['e1', 'e2', 'e3'],
    divergentEntryIds: [],
    updatedAt: 5000,
    ...overrides,
  };
}

describe('clusterView', () => {
  it('retorna tone pending quando o cluster ainda não tem consenso', () => {
    const cluster = makeCluster({ consensusAnswer: null });
    const entries = [makeEntry({ id: 'e1', uid: 'me' })];

    const view = clusterView(cluster, entries, 'me');

    expect(view.tone).toBe('pending');
    expect(view.consensusAnswer).toBeNull();
  });

  it('retorna tone divergence quando uma entry minha está entre as divergentes', () => {
    const cluster = makeCluster({ divergentEntryIds: ['e2'] });
    const entries = [
      makeEntry({ id: 'e1', uid: 'outro' }),
      makeEntry({ id: 'e2', uid: 'me' }),
      makeEntry({ id: 'e3', uid: 'outro' }),
    ];

    const view = clusterView(cluster, entries, 'me');

    expect(view.tone).toBe('divergence');
    expect(view.iDiverge).toBe(true);
    expect(view.myEntryIds).toEqual(['e2']);
  });

  it('retorna tone consensus quando minha entry está alinhada ao consenso', () => {
    const cluster = makeCluster({ divergentEntryIds: ['e3'] });
    const entries = [
      makeEntry({ id: 'e1', uid: 'me' }),
      makeEntry({ id: 'e3', uid: 'outro' }),
    ];

    const view = clusterView(cluster, entries, 'me');

    expect(view.tone).toBe('consensus');
    expect(view.iDiverge).toBe(false);
    expect(view.myEntryIds).toEqual(['e1']);
  });

  it('pending tem precedência sobre divergence quando não há consenso', () => {
    const cluster = makeCluster({ consensusAnswer: null, divergentEntryIds: ['e1'] });
    const entries = [makeEntry({ id: 'e1', uid: 'me' })];

    const view = clusterView(cluster, entries, 'me');

    expect(view.tone).toBe('pending');
    expect(view.iDiverge).toBe(true);
  });

  it('conta totalEntries e divergentCount a partir do cluster, não das entries carregadas', () => {
    const cluster = makeCluster({
      entryIds: ['e1', 'e2', 'e3', 'e4'],
      divergentEntryIds: ['e2', 'e4'],
    });
    const entries = [makeEntry({ id: 'e1', uid: 'me' })];

    const view = clusterView(cluster, entries, 'me');

    expect(view.totalEntries).toBe(4);
    expect(view.divergentCount).toBe(2);
  });

  it('ignora entries minhas que não pertencem ao cluster', () => {
    const cluster = makeCluster({ entryIds: ['e1'], divergentEntryIds: [] });
    const entries = [
      makeEntry({ id: 'e1', uid: 'me' }),
      makeEntry({ id: 'fora-do-cluster', uid: 'me' }),
    ];

    const view = clusterView(cluster, entries, 'me');

    expect(view.myEntryIds).toEqual(['e1']);
  });

  it('expõe a pergunta canônica e a resposta de consenso do cluster', () => {
    const cluster = makeCluster({ canonicalQuestion: 'Capital da França?', consensusAnswer: 'Paris' });

    const view = clusterView(cluster, [], 'me');

    expect(view.canonicalQuestion).toBe('Capital da França?');
    expect(view.consensusAnswer).toBe('Paris');
  });
});

describe('divergenceMessage', () => {
  it('para open_text nunca usa as palavras errado ou incorreto', () => {
    const message = divergenceMessage('open_text');

    expect(message.toLowerCase()).not.toContain('errad');
    expect(message.toLowerCase()).not.toContain('incorret');
    expect(message.length).toBeGreaterThan(0);
  });

  it('retorna mensagem em pt-BR para cada tipo de resposta', () => {
    const types: AnswerType[] = ['multiple_choice', 'numeric', 'short_text', 'open_text', 'unknown'];

    for (const type of types) {
      const message = divergenceMessage(type);
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    }
  });

  it('mensagem de open_text é diferente das mensagens de tipos objetivos', () => {
    expect(divergenceMessage('open_text')).not.toBe(divergenceMessage('multiple_choice'));
    expect(divergenceMessage('open_text')).not.toBe(divergenceMessage('numeric'));
  });
});
