// Perguntas capturadas como IMAGEM viram entries cujo questionText é a
// instrução padrão do clipboardFlow (o backend grava o texto do último turno).
// Este módulo é a fonte única desse marcador: o clipboardFlow monta o prompt
// a partir do prefixo e a UI das salas o detecta para não exibir a instrução
// crua no feed/consenso.

export const IMAGE_QUESTION_PREFIX = 'Resolva a questão desta imagem';

/** Rótulo humano exibido no lugar da instrução técnica. */
export const IMAGE_QUESTION_LABEL = 'pergunta enviada por imagem';

/** A entry/cluster nasceu de uma captura de imagem (sem texto)? */
export function isImageQuestion(questionText: string): boolean {
  return questionText.trimStart().startsWith(IMAGE_QUESTION_PREFIX);
}
