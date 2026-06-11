// Monta o "gabarito" da sala: as respostas corrigidas (consenso da IA) por
// questão. Puro e testável. `diverged` marca onde a minha resposta divergiu
// do consenso (para destaque no overlay).

import type { RoomCluster, RoomEntry } from './types';

export interface GabaritoItem {
  question: string;
  answer: string;
  diverged: boolean;
}

/**
 * Itens do gabarito a partir dos clusters com resposta de consenso definida.
 * Ordena por pergunta resolvida primeiro; ignora clusters ainda sem consenso.
 * `diverged` = alguma entry minha está nos divergentes do cluster.
 */
export function buildGabarito(
  clusters: RoomCluster[],
  entries: RoomEntry[],
  myUid: string,
): GabaritoItem[] {
  const myEntryIds = new Set(entries.filter((e) => e.uid === myUid).map((e) => e.id));
  return clusters
    .filter((c) => c.consensusAnswer !== null || c.consensusAnswerText)
    .map((c) => {
      const answer =
        (c.consensusAnswerText && c.consensusAnswerText.trim()) ||
        (c.consensusAnswer === null || c.consensusAnswer === undefined
          ? ''
          : String(c.consensusAnswer));
      const diverged = c.divergentEntryIds.some((id) => myEntryIds.has(id));
      return {
        question: c.canonicalQuestion,
        answer,
        diverged,
      };
    })
    .filter((item) => item.answer.length > 0);
}
