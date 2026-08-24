import { describe, expect, it } from 'vitest';
import { friendlyErrorMessage } from './errorMessages';

describe('friendlyErrorMessage', () => {
  it('texto normal de resposta retorna null', () => {
    expect(friendlyErrorMessage('Paris é a capital da França.')).toBeNull();
    expect(friendlyErrorMessage('error mas sem prefixo dois-pontos')).toBeNull();
  });

  it('mapeia códigos conhecidos para pt-BR', () => {
    expect(friendlyErrorMessage('error:sessionExpired')).toMatch(/sessão expirou/i);
    expect(friendlyErrorMessage('error:insufficientCredits')).toMatch(/assine um plano/i);
    expect(friendlyErrorMessage('error:rateLimited')).toMatch(/muitas perguntas/i);
  });

  it('serverError com Gemini 429 cru vira mensagem limpa (sem JSON)', () => {
    const raw =
      'error:serverError:500:Gemini 429: {"error":{"code":429,"message":"prepayment credits depleted"}}';
    const msg = friendlyErrorMessage(raw);
    expect(msg).toMatch(/indisponível/i);
    expect(msg).not.toContain('{');
    expect(msg).not.toContain('429');
  });

  it('código desconhecido cai no fallback', () => {
    expect(friendlyErrorMessage('error:algoNovo:1:detalhe')).toMatch(/algo deu errado/i);
  });
});
