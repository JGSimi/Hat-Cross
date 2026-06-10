import { describe, expect, it } from 'vitest';
import { upsertEntries, upsertById } from './merge';
import type { RoomEntry } from './types';

function makeEntry(overrides: Partial<RoomEntry> & { id: string }): RoomEntry {
  return {
    uid: 'user-1',
    questionText: 'Qual a capital da França?',
    aiAnswer: 'Paris',
    extractedAnswer: 'Paris',
    answerType: 'short_text',
    confidence: 0.9,
    mode: 'hat',
    createdAt: 1000,
    sourceMessageId: 'msg-1',
    ...overrides,
  };
}

describe('upsertEntries', () => {
  it('não duplica entries com mesmo id e a versão incoming vence', () => {
    const existing = [makeEntry({ id: 'a', aiAnswer: 'antiga', createdAt: 1000 })];
    const incoming = [makeEntry({ id: 'a', aiAnswer: 'nova', createdAt: 1000 })];

    const result = upsertEntries(existing, incoming);

    expect(result).toHaveLength(1);
    expect(result[0]?.aiAnswer).toBe('nova');
  });

  it('adiciona entries novas sem perder as existentes', () => {
    const existing = [makeEntry({ id: 'a', createdAt: 1000 })];
    const incoming = [makeEntry({ id: 'b', createdAt: 2000 })];

    const result = upsertEntries(existing, incoming);

    expect(result.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('ordena por createdAt ascendente', () => {
    const existing = [
      makeEntry({ id: 'tarde', createdAt: 3000 }),
      makeEntry({ id: 'cedo', createdAt: 1000 }),
    ];
    const incoming = [makeEntry({ id: 'meio', createdAt: 2000 })];

    const result = upsertEntries(existing, incoming);

    expect(result.map((e) => e.id)).toEqual(['cedo', 'meio', 'tarde']);
  });

  it('mantém ordenação estável para entries com mesmo createdAt', () => {
    const existing = [
      makeEntry({ id: 'primeira', createdAt: 1000 }),
      makeEntry({ id: 'segunda', createdAt: 1000 }),
    ];
    const incoming = [makeEntry({ id: 'terceira', createdAt: 1000 })];

    const result = upsertEntries(existing, incoming);

    expect(result.map((e) => e.id)).toEqual(['primeira', 'segunda', 'terceira']);
  });

  it('não muta os arrays de entrada', () => {
    const existing = [makeEntry({ id: 'a', createdAt: 2000 })];
    const incoming = [makeEntry({ id: 'b', createdAt: 1000 })];
    const existingSnapshot = [...existing];
    const incomingSnapshot = [...incoming];

    upsertEntries(existing, incoming);

    expect(existing).toEqual(existingSnapshot);
    expect(incoming).toEqual(incomingSnapshot);
  });

  it('retorna vazio quando ambos os arrays estão vazios', () => {
    expect(upsertEntries([], [])).toEqual([]);
  });
});

describe('upsertById', () => {
  it('substitui item existente pelo incoming com mesmo id', () => {
    const existing = [{ id: 'c1', label: 'velho' }];
    const incoming = [{ id: 'c1', label: 'novo' }];

    const result = upsertById(existing, incoming);

    expect(result).toHaveLength(1);
    expect(result[0]?.label).toBe('novo');
  });

  it('preserva a ordem dos existentes e anexa novos ao final', () => {
    const existing = [
      { id: 'c1', label: 'um' },
      { id: 'c2', label: 'dois' },
    ];
    const incoming = [
      { id: 'c3', label: 'três' },
      { id: 'c1', label: 'um-atualizado' },
    ];

    const result = upsertById(existing, incoming);

    expect(result.map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
    expect(result[0]?.label).toBe('um-atualizado');
  });

  it('não duplica quando o incoming repete o mesmo id duas vezes', () => {
    const existing: Array<{ id: string; v: number }> = [];
    const incoming = [
      { id: 'n1', v: 1 },
      { id: 'n1', v: 2 },
    ];

    const result = upsertById(existing, incoming);

    expect(result).toHaveLength(1);
    expect(result[0]?.v).toBe(2);
  });
});
