import { describe, expect, it } from 'vitest';
import { buildGabarito } from './gabarito';
import type { RoomCluster, RoomEntry } from './types';

function cluster(over: Partial<RoomCluster> & { id: string }): RoomCluster {
  return {
    canonicalQuestion: 'Pergunta?',
    answerType: 'multiple_choice',
    consensusAnswer: 'B',
    consensusAnswerText: '(B)',
    consensusConfidence: 0.9,
    entryIds: [],
    divergentEntryIds: [],
    updatedAt: 1,
    ...over,
  };
}

function entry(over: Partial<RoomEntry> & { id: string; uid: string }): RoomEntry {
  return {
    questionText: 'q',
    aiAnswer: 'a',
    extractedAnswer: 'B',
    answerType: 'multiple_choice',
    confidence: 0.9,
    mode: 'hat',
    createdAt: 1,
    sourceMessageId: 'm',
    clusterId: 'c',
    ...over,
  };
}

describe('buildGabarito', () => {
  it('inclui só clusters com resposta apurada', () => {
    const items = buildGabarito(
      [
        cluster({ id: 'c1', canonicalQuestion: 'Q1', consensusAnswerText: '(B)' }),
        cluster({ id: 'c2', consensusAnswer: null, consensusAnswerText: null }),
      ],
      [],
      'me',
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ question: 'Q1', answer: '(B)' });
  });

  it('prefere o texto da alternativa; cai para o valor bruto', () => {
    const items = buildGabarito(
      [cluster({ id: 'c1', consensusAnswerText: null, consensusAnswer: 42, answerType: 'numeric' })],
      [],
      'me',
    );
    expect(items[0]?.answer).toBe('42');
  });

  it('marca diverged quando minha entry está nos divergentes', () => {
    const items = buildGabarito(
      [cluster({ id: 'c1', divergentEntryIds: ['e-mine'] })],
      [entry({ id: 'e-mine', uid: 'me' }), entry({ id: 'e-other', uid: 'outro' })],
      'me',
    );
    expect(items[0]?.diverged).toBe(true);
  });

  it('não marca diverged se quem divergiu foi outro', () => {
    const items = buildGabarito(
      [cluster({ id: 'c1', divergentEntryIds: ['e-other'] })],
      [entry({ id: 'e-mine', uid: 'me' }), entry({ id: 'e-other', uid: 'outro' })],
      'me',
    );
    expect(items[0]?.diverged).toBe(false);
  });
});
