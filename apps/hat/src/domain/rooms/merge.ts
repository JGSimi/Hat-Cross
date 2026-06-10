// Merge puro de coleções sincronizadas das salas (entries, clusters,
// notifications). Sem efeitos colaterais: nunca muta os arrays de entrada.

import type { RoomEntry } from './types';

/**
 * Faz upsert genérico por id: a versão incoming vence, a ordem dos
 * existentes é preservada e itens novos são anexados ao final na ordem
 * em que chegaram. Ids repetidos dentro de `incoming` colapsam para a
 * última ocorrência.
 */
export function upsertById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const incomingById = new Map<string, T>();
  for (const item of incoming) {
    incomingById.set(item.id, item);
  }

  const result: T[] = [];
  const seen = new Set<string>();

  for (const item of existing) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(incomingById.get(item.id) ?? item);
  }

  for (const item of incoming) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    // A última ocorrência do id em incoming vence.
    const winner = incomingById.get(item.id);
    result.push(winner ?? item);
  }

  return result;
}

/**
 * Upsert de entries da sala: dedupe por id (incoming vence) e ordenação
 * por createdAt ascendente. A ordenação é estável — entries com o mesmo
 * createdAt mantêm a ordem relativa (existentes primeiro, depois novas).
 */
export function upsertEntries(existing: RoomEntry[], incoming: RoomEntry[]): RoomEntry[] {
  const merged = upsertById(existing, incoming);
  // Array.prototype.sort é estável (ES2019+), então empates em createdAt
  // preservam a ordem relativa do merge.
  return [...merged].sort((a, b) => a.createdAt - b.createdAt);
}
