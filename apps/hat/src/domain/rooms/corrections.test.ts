import { describe, expect, it } from 'vitest';
import {
  correctionFlashText,
  nextUnread,
  unreadCount,
} from './corrections';
import type { RoomNotification } from './types';

function notif(over: Partial<RoomNotification> & { id: string }): RoomNotification {
  return {
    uid: 'me',
    entryId: 'e1',
    clusterId: 'c1',
    kind: 'divergence',
    severity: 'error',
    message: 'Resposta correta é (B) para pergunta: Qual a capital?',
    createdAt: 1000,
    ...over,
  };
}

describe('unreadCount', () => {
  it('conta só as não-lidas', () => {
    expect(
      unreadCount([notif({ id: 'a' }), notif({ id: 'b', readAt: 1 }), notif({ id: 'c' })]),
    ).toBe(2);
  });
});

describe('nextUnread', () => {
  it('devolve a mais antiga não-lida (FIFO)', () => {
    const next = nextUnread([
      notif({ id: 'novo', createdAt: 3000 }),
      notif({ id: 'lido', createdAt: 500, readAt: 1 }),
      notif({ id: 'antigo', createdAt: 1000 }),
    ]);
    expect(next?.id).toBe('antigo');
  });

  it('null quando tudo lido', () => {
    expect(nextUnread([notif({ id: 'a', readAt: 1 })])).toBeNull();
    expect(nextUnread([])).toBeNull();
  });
});

describe('correctionFlashText', () => {
  it('prioriza a letra da alternativa + trecho da pergunta', () => {
    const text = correctionFlashText(
      notif({ id: 'a', suggestedCorrectOptionLabel: 'B', questionPreview: 'Qual a capital da França?' }),
    );
    expect(text).toContain('(B)');
    expect(text).toContain('Qual a capital da França?');
    expect(text.toLowerCase()).not.toContain('errad');
  });

  it('usa o texto da resposta quando não é múltipla escolha', () => {
    const text = correctionFlashText(
      notif({ id: 'a', suggestedCorrectAnswer: 'Paris', suggestedCorrectOptionLabel: null, questionPreview: 'Capital?' }),
    );
    expect(text).toContain('Paris');
  });

  it('cai na mensagem do backend quando não há resposta estruturada', () => {
    const n = notif({ id: 'a', suggestedCorrectAnswer: undefined, suggestedCorrectOptionLabel: null, questionPreview: undefined });
    expect(correctionFlashText(n)).toBe(n.message);
  });
});
