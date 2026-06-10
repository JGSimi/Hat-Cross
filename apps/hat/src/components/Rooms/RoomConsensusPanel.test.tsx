import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RoomConsensusPanel } from './RoomConsensusPanel';
import type { RoomCluster, RoomEntry } from '../../domain/rooms/types';

function makeEntry(overrides: Partial<RoomEntry> & { id: string; uid: string }): RoomEntry {
  return {
    questionText: 'Pergunta?',
    aiAnswer: 'Resposta',
    extractedAnswer: 'B',
    answerType: 'multiple_choice',
    confidence: 0.9,
    mode: 'hat',
    createdAt: 1000,
    sourceMessageId: 'm',
    clusterId: 'cl-1',
    ...overrides,
  };
}

function makeCluster(overrides: Partial<RoomCluster> = {}): RoomCluster {
  return {
    id: 'cl-1',
    canonicalQuestion: 'Qual alternativa está correta?',
    answerType: 'multiple_choice',
    consensusAnswer: 'B',
    consensusConfidence: 0.87,
    entryIds: ['e1', 'e2', 'e3'],
    divergentEntryIds: [],
    updatedAt: 1,
    ...overrides,
  };
}

describe('RoomConsensusPanel', () => {
  it('mostra estado vazio sem clusters', () => {
    render(<RoomConsensusPanel clusters={[]} entries={[]} myUid="eu" />);
    expect(screen.getByTestId('consensus-empty')).toBeInTheDocument();
  });

  it('renderiza resposta de consenso, contagem e confiança', () => {
    render(
      <RoomConsensusPanel
        clusters={[makeCluster()]}
        entries={[makeEntry({ id: 'e1', uid: 'outro' })]}
        myUid="eu"
      />,
    );
    expect(screen.getByTestId('cluster-answer')).toHaveTextContent('B');
    expect(screen.getByText(/3 respostas/)).toBeInTheDocument();
    expect(screen.getByText(/87%/)).toBeInTheDocument();
  });

  it('cluster sem consenso fica em estado pendente', () => {
    render(
      <RoomConsensusPanel
        clusters={[makeCluster({ consensusAnswer: null })]}
        entries={[]}
        myUid="eu"
      />,
    );
    expect(screen.getByTestId('cluster-pending')).toBeInTheDocument();
    expect(screen.queryByTestId('cluster-answer')).toBeNull();
  });

  it('quando minha entry diverge, mostra a mensagem de divergência (sem "errado")', () => {
    render(
      <RoomConsensusPanel
        clusters={[makeCluster({ divergentEntryIds: ['e2'] })]}
        entries={[
          makeEntry({ id: 'e1', uid: 'outro' }),
          makeEntry({ id: 'e2', uid: 'eu', extractedAnswer: 'C' }),
        ]}
        myUid="eu"
      />,
    );
    const message = screen.getByTestId('cluster-divergence-message');
    expect(message).toHaveTextContent(/diverge do consenso/i);
    expect(message.textContent?.toLowerCase()).not.toContain('errad');
  });

  it('divergência de outra pessoa não me acusa', () => {
    render(
      <RoomConsensusPanel
        clusters={[makeCluster({ divergentEntryIds: ['e1'] })]}
        entries={[
          makeEntry({ id: 'e1', uid: 'outro', extractedAnswer: 'C' }),
          makeEntry({ id: 'e2', uid: 'eu' }),
        ]}
        myUid="eu"
      />,
    );
    expect(screen.queryByTestId('cluster-divergence-message')).toBeNull();
    expect(screen.getByText(/1 diverge/)).toBeInTheDocument();
  });
});
