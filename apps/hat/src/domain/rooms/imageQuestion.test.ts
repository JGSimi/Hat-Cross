import { describe, expect, it } from 'vitest';

import { IMAGE_QUESTION_PREFIX, isImageQuestion } from './imageQuestion';

describe('isImageQuestion', () => {
  it('detecta o prompt padrão de imagem (com sufixo de regras)', () => {
    expect(
      isImageQuestion(`${IMAGE_QUESTION_PREFIX} seguindo as regras de formato (…).`),
    ).toBe(true);
  });

  it('tolera espaços à esquerda', () => {
    expect(isImageQuestion(`  ${IMAGE_QUESTION_PREFIX}`)).toBe(true);
  });

  it('não marca perguntas de texto normais', () => {
    expect(isImageQuestion('Quanto é 2 + 2?')).toBe(false);
    expect(isImageQuestion('')).toBe(false);
    // menção no MEIO do texto não conta — só captura por imagem começa assim
    expect(isImageQuestion(`Sobre a frase "${IMAGE_QUESTION_PREFIX}", analise…`)).toBe(false);
  });
});
