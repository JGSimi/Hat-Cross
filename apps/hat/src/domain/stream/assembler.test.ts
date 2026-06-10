import { describe, expect, it } from 'vitest';
import type { StreamChunkPayload } from '../../bridge/types';
import { StreamAssembler, parseErrorCode } from './assembler';

function chunk(overrides: Partial<StreamChunkPayload> = {}): StreamChunkPayload {
  return {
    streamId: 1,
    text: '',
    isFinished: false,
    contentType: 'text',
    ...overrides,
  };
}

describe('StreamAssembler', () => {
  it('começa vazio, sem fim e sem usage', () => {
    const asm = new StreamAssembler();
    expect(asm.text).toBe('');
    expect(asm.thinking).toBe('');
    expect(asm.isFinished).toBe(false);
    expect(asm.usage).toEqual({});
  });

  it('concatena chunks de texto na ordem recebida', () => {
    const asm = new StreamAssembler();
    asm.push(chunk({ text: 'Olá, ' }));
    asm.push(chunk({ text: 'mundo' }));
    asm.push(chunk({ text: '!' }));
    expect(asm.text).toBe('Olá, mundo!');
  });

  it('separa text e thinking mesmo intercalados', () => {
    const asm = new StreamAssembler();
    asm.push(chunk({ text: 'pensando ', contentType: 'thinking' }));
    asm.push(chunk({ text: 'resposta ' }));
    asm.push(chunk({ text: 'ainda...', contentType: 'thinking' }));
    asm.push(chunk({ text: 'final' }));
    expect(asm.thinking).toBe('pensando ainda...');
    expect(asm.text).toBe('resposta final');
  });

  it('captura usage emitido no meio do stream e mescla input/output de chunks distintos', () => {
    const asm = new StreamAssembler();
    asm.push(chunk({ text: 'a', inputTokens: 120 }));
    asm.push(chunk({ text: 'b' }));
    asm.push(chunk({ text: '', isFinished: true, outputTokens: 42 }));
    expect(asm.usage).toEqual({ inputTokens: 120, outputTokens: 42 });
  });

  it('mantém o último valor de usage quando reemitido', () => {
    const asm = new StreamAssembler();
    asm.push(chunk({ text: 'a', outputTokens: 5 }));
    asm.push(chunk({ text: 'b', outputTokens: 17 }));
    expect(asm.usage).toEqual({ outputTokens: 17 });
  });

  it('marca isFinished quando chega o chunk final', () => {
    const asm = new StreamAssembler();
    asm.push(chunk({ text: 'corpo' }));
    expect(asm.isFinished).toBe(false);
    asm.push(chunk({ text: '', isFinished: true }));
    expect(asm.isFinished).toBe(true);
  });

  it('ignora chunks de streamId diferente do primeiro visto', () => {
    const asm = new StreamAssembler();
    asm.push(chunk({ streamId: 7, text: 'meu ' }));
    asm.push(chunk({ streamId: 99, text: 'intruso' }));
    asm.push(chunk({ streamId: 7, text: 'stream' }));
    expect(asm.text).toBe('meu stream');
  });

  it('não finaliza nem registra usage por chunk final de outro stream', () => {
    const asm = new StreamAssembler();
    asm.push(chunk({ streamId: 7, text: 'a' }));
    asm.push(chunk({ streamId: 99, text: '', isFinished: true, inputTokens: 999, outputTokens: 999 }));
    expect(asm.isFinished).toBe(false);
    expect(asm.usage).toEqual({});
  });
});

describe('parseErrorCode', () => {
  it('parseia código simples sem status nem detail', () => {
    expect(parseErrorCode('error:sessionExpired')).toEqual({ code: 'sessionExpired' });
    expect(parseErrorCode('error:insufficientCredits')).toEqual({ code: 'insufficientCredits' });
  });

  it('parseia código com status e detail', () => {
    expect(parseErrorCode('error:serverError:503:boom')).toEqual({
      code: 'serverError',
      status: 503,
      detail: 'boom',
    });
  });

  it('parseia código com status sem detail', () => {
    expect(parseErrorCode('error:rateLimited:429')).toEqual({
      code: 'rateLimited',
      status: 429,
    });
  });

  it('preserva ":" dentro do detail', () => {
    expect(parseErrorCode('error:unknownError:400:bad: request: weird')).toEqual({
      code: 'unknownError',
      status: 400,
      detail: 'bad: request: weird',
    });
  });

  it('retorna null para string que não começa com "error:"', () => {
    expect(parseErrorCode('texto normal de resposta')).toBeNull();
    expect(parseErrorCode('erro:sessionExpired')).toBeNull();
    expect(parseErrorCode('')).toBeNull();
  });

  it('retorna null para "error:" sem código', () => {
    expect(parseErrorCode('error:')).toBeNull();
  });

  it('trata segmento de status não numérico como parte do detail', () => {
    expect(parseErrorCode('error:serverError:oops:extra')).toEqual({
      code: 'serverError',
      detail: 'oops:extra',
    });
  });
});
