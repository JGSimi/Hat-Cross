// Projeção client-side de clusters de consenso já computados pelo backend.
// Puro: sem tauri, zustand ou react.

import type { AnswerType, RoomCluster, RoomEntry } from './types';

export type ClusterTone = 'consensus' | 'divergence' | 'pending';

export interface ClusterViewModel {
  canonicalQuestion: string;
  consensusAnswer: string | number | null;
  totalEntries: number;
  divergentCount: number;
  myEntryIds: string[];
  iDiverge: boolean;
  tone: ClusterTone;
}

/**
 * Deriva o view-model de um cluster para o usuário atual.
 * - tone 'pending': o backend ainda não computou consenso (consensusAnswer null);
 * - tone 'divergence': alguma entry minha está em divergentEntryIds;
 * - tone 'consensus': caso contrário.
 * Contagens vêm do cluster (fonte de verdade), não das entries carregadas
 * localmente, que podem estar parcialmente sincronizadas.
 */
export function clusterView(
  cluster: RoomCluster,
  entries: RoomEntry[],
  myUid: string,
): ClusterViewModel {
  const clusterEntryIds = new Set(cluster.entryIds);
  const divergentIds = new Set(cluster.divergentEntryIds);

  const myEntryIds = entries
    .filter((entry) => entry.uid === myUid && clusterEntryIds.has(entry.id))
    .map((entry) => entry.id);

  const iDiverge = myEntryIds.some((id) => divergentIds.has(id));

  let tone: ClusterTone;
  if (cluster.consensusAnswer === null) {
    tone = 'pending';
  } else if (iDiverge) {
    tone = 'divergence';
  } else {
    tone = 'consensus';
  }

  return {
    canonicalQuestion: cluster.canonicalQuestion,
    consensusAnswer: cluster.consensusAnswer,
    totalEntries: cluster.entryIds.length,
    divergentCount: cluster.divergentEntryIds.length,
    myEntryIds,
    iDiverge,
    tone,
  };
}

// Regra de produto: para 'open_text' não existe resposta "errada" — questões
// abertas admitem múltiplas perspectivas válidas. A mensagem fala apenas em
// divergência/diferença, nunca em erro.
const DIVERGENCE_MESSAGES: Record<AnswerType, string> = {
  multiple_choice: 'Sua alternativa diverge do consenso da sala. Vale revisar a questão.',
  numeric: 'Seu valor diverge do consenso da sala. Vale conferir o cálculo.',
  short_text: 'Sua resposta diverge do consenso da sala. Vale revisar a questão.',
  open_text:
    'Sua resposta segue um caminho diferente do consenso da sala. Vale comparar as perspectivas.',
  unknown: 'Sua resposta diverge do consenso da sala.',
};

/**
 * Mensagem de divergência em pt-BR por tipo de resposta, pronta para UI.
 */
export function divergenceMessage(answerType: AnswerType): string {
  return DIVERGENCE_MESSAGES[answerType];
}
