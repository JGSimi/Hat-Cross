// Seleção e formatação das correções da IA da sala para exibir no Flash.
// Puro: o controller liga isto ao atalho/flash; a regra de "qual mostrar" e
// "como escrever" fica testável aqui.

import type { RoomNotification } from './types';

/** Correção ainda não mostrada (readAt ausente)? */
export function isUnread(n: RoomNotification): boolean {
  return n.readAt === undefined;
}

/** Quantas correções pendentes (não-lidas) — alimenta o badge. */
export function unreadCount(notifications: RoomNotification[]): number {
  return notifications.filter(isUnread).length;
}

/**
 * Próxima correção a mostrar: a mais ANTIGA não-lida (FIFO — o usuário vê na
 * ordem em que a sala apurou). null se não há pendências.
 */
export function nextUnread(notifications: RoomNotification[]): RoomNotification | null {
  let best: RoomNotification | null = null;
  for (const n of notifications) {
    if (!isUnread(n)) continue;
    if (best === null || n.createdAt < best.createdAt) best = n;
  }
  return best;
}

/**
 * Texto enxuto para o card do Flash. Prioriza a letra da alternativa quando
 * existe (múltipla escolha), com o trecho da pergunta para contexto. Nunca usa
 * "errado" — apenas aponta a resposta correta (regra de produto).
 */
export function correctionFlashText(n: RoomNotification): string {
  const answer = n.suggestedCorrectOptionLabel
    ? `(${n.suggestedCorrectOptionLabel})`
    : (n.suggestedCorrectAnswer ?? '').trim();
  const question = (n.questionPreview ?? '').trim();
  if (answer && question) return `Resposta certa: ${answer}\n${question}`;
  if (answer) return `Resposta certa: ${answer}`;
  // Fallback: a mensagem já vem pronta do backend.
  return n.message;
}
