import { describe, expect, it } from 'vitest';

import type { ClipboardContent } from '../../bridge/types';
import type { PipelineEvent, PipelineState } from './pipeline';
import { initialState, reduce } from './pipeline';

const textContent: ClipboardContent = { kind: 'text', text: 'olá mundo' };
const imageContent: ClipboardContent = { kind: 'image', base64Png: 'aGF0' };

/** Aplica uma sequência de eventos a partir do initialState. */
function run(events: PipelineEvent[], from: PipelineState = initialState): PipelineState {
  return events.reduce((state, event) => reduce(state, event), from);
}

function streamingState(): PipelineState {
  return run([
    { type: 'SHORTCUT_PRESSED' },
    { type: 'CLIPBOARD_READ', content: textContent },
    { type: 'STREAM_STARTED', streamId: 7 },
  ]);
}

describe('initialState', () => {
  it('começa em idle com answerText vazio e sem dados residuais', () => {
    expect(initialState.status).toBe('idle');
    expect(initialState.answerText).toBe('');
    expect(initialState.content).toBeUndefined();
    expect(initialState.streamId).toBeUndefined();
    expect(initialState.errorCode).toBeUndefined();
  });
});

describe('SHORTCUT_PRESSED', () => {
  it('sai de idle para reading', () => {
    const state = reduce(initialState, { type: 'SHORTCUT_PRESSED' });
    expect(state.status).toBe('reading');
  });

  it('reinicia o fluxo a partir de done limpando a resposta anterior', () => {
    const done = run([{ type: 'STREAM_CHUNK', text: 'resposta antiga' }, { type: 'STREAM_DONE' }], streamingState());
    expect(done.status).toBe('done');

    const restarted = reduce(done, { type: 'SHORTCUT_PRESSED' });
    expect(restarted.status).toBe('reading');
    expect(restarted.answerText).toBe('');
    expect(restarted.content).toBeUndefined();
    expect(restarted.streamId).toBeUndefined();
  });

  it('reinicia o fluxo a partir de error limpando o errorCode', () => {
    const errored = run([{ type: 'SHORTCUT_PRESSED' }, { type: 'CLIPBOARD_EMPTY' }]);
    expect(errored.status).toBe('error');

    const restarted = reduce(errored, { type: 'SHORTCUT_PRESSED' });
    expect(restarted.status).toBe('reading');
    expect(restarted.errorCode).toBeUndefined();
  });

  it('não reentra quando já está lendo o clipboard', () => {
    const reading = reduce(initialState, { type: 'SHORTCUT_PRESSED' });
    expect(reduce(reading, { type: 'SHORTCUT_PRESSED' })).toBe(reading);
  });

  it('não reentra quando o flash está processando', () => {
    const processing = run([
      { type: 'SHORTCUT_PRESSED' },
      { type: 'CLIPBOARD_READ', content: textContent },
    ]);
    expect(processing.status).toBe('flashing-processing');
    expect(reduce(processing, { type: 'SHORTCUT_PRESSED' })).toBe(processing);
  });

  it('não reentra durante streaming', () => {
    const streaming = streamingState();
    expect(reduce(streaming, { type: 'SHORTCUT_PRESSED' })).toBe(streaming);
  });
});

describe('leitura do clipboard', () => {
  it('CLIPBOARD_READ em reading guarda o conteúdo e vai para flashing-processing', () => {
    const reading = reduce(initialState, { type: 'SHORTCUT_PRESSED' });
    const state = reduce(reading, { type: 'CLIPBOARD_READ', content: imageContent });
    expect(state.status).toBe('flashing-processing');
    expect(state.content).toEqual(imageContent);
  });

  it('CLIPBOARD_EMPTY em reading vira error com errorCode clipboardEmpty', () => {
    const reading = reduce(initialState, { type: 'SHORTCUT_PRESSED' });
    const state = reduce(reading, { type: 'CLIPBOARD_EMPTY' });
    expect(state.status).toBe('error');
    expect(state.errorCode).toBe('clipboardEmpty');
  });

  it('trata CLIPBOARD_READ com conteúdo kind empty como clipboard vazio', () => {
    const reading = reduce(initialState, { type: 'SHORTCUT_PRESSED' });
    const state = reduce(reading, { type: 'CLIPBOARD_READ', content: { kind: 'empty' } });
    expect(state.status).toBe('error');
    expect(state.errorCode).toBe('clipboardEmpty');
  });
});

describe('streaming', () => {
  it('STREAM_STARTED em flashing-processing guarda o streamId e vai para streaming', () => {
    const processing = run([
      { type: 'SHORTCUT_PRESSED' },
      { type: 'CLIPBOARD_READ', content: textContent },
    ]);
    const state = reduce(processing, { type: 'STREAM_STARTED', streamId: 42 });
    expect(state.status).toBe('streaming');
    expect(state.streamId).toBe(42);
  });

  it('acumula chunks em answerText na ordem de chegada', () => {
    const state = run(
      [
        { type: 'STREAM_CHUNK', text: 'Olá' },
        { type: 'STREAM_CHUNK', text: ', ' },
        { type: 'STREAM_CHUNK', text: 'mundo!' },
      ],
      streamingState(),
    );
    expect(state.answerText).toBe('Olá, mundo!');
    expect(state.status).toBe('streaming');
  });

  it('STREAM_DONE finaliza preservando answerText, content e streamId', () => {
    const state = run(
      [{ type: 'STREAM_CHUNK', text: 'resposta' }, { type: 'STREAM_DONE' }],
      streamingState(),
    );
    expect(state.status).toBe('done');
    expect(state.answerText).toBe('resposta');
    expect(state.content).toEqual(textContent);
    expect(state.streamId).toBe(7);
  });
});

describe('STREAM_ERROR', () => {
  it('vira error a partir de streaming guardando o code', () => {
    const state = reduce(streamingState(), { type: 'STREAM_ERROR', code: 'networkDown' });
    expect(state.status).toBe('error');
    expect(state.errorCode).toBe('networkDown');
  });

  it('vira error a partir de reading', () => {
    const reading = reduce(initialState, { type: 'SHORTCUT_PRESSED' });
    const state = reduce(reading, { type: 'STREAM_ERROR', code: 'readFailed' });
    expect(state.status).toBe('error');
    expect(state.errorCode).toBe('readFailed');
  });

  it('vira error a partir de flashing-processing', () => {
    const processing = run([
      { type: 'SHORTCUT_PRESSED' },
      { type: 'CLIPBOARD_READ', content: textContent },
    ]);
    const state = reduce(processing, { type: 'STREAM_ERROR', code: 'authExpired' });
    expect(state.status).toBe('error');
    expect(state.errorCode).toBe('authExpired');
  });

  it('é ignorado em idle', () => {
    expect(reduce(initialState, { type: 'STREAM_ERROR', code: 'fantasma' })).toBe(initialState);
  });

  it('é ignorado em done sem apagar a resposta', () => {
    const done = run([{ type: 'STREAM_CHUNK', text: 'ok' }, { type: 'STREAM_DONE' }], streamingState());
    const after = reduce(done, { type: 'STREAM_ERROR', code: 'tarde demais' });
    expect(after).toBe(done);
    expect(after.answerText).toBe('ok');
  });
});

describe('RESET', () => {
  it('volta a initialState a partir de streaming', () => {
    const state = reduce(streamingState(), { type: 'RESET' });
    expect(state).toEqual(initialState);
  });

  it('volta a initialState a partir de error', () => {
    const errored = run([{ type: 'SHORTCUT_PRESSED' }, { type: 'CLIPBOARD_EMPTY' }]);
    expect(reduce(errored, { type: 'RESET' })).toEqual(initialState);
  });

  it('volta a initialState a partir de done', () => {
    const done = run([{ type: 'STREAM_CHUNK', text: 'x' }, { type: 'STREAM_DONE' }], streamingState());
    expect(reduce(done, { type: 'RESET' })).toEqual(initialState);
  });

  it('em idle continua equivalente ao initialState', () => {
    expect(reduce(initialState, { type: 'RESET' })).toEqual(initialState);
  });
});

describe('eventos fora de ordem', () => {
  it('ignora STREAM_CHUNK em idle sem corromper o estado', () => {
    const state = reduce(initialState, { type: 'STREAM_CHUNK', text: 'lixo' });
    expect(state).toBe(initialState);
    expect(state.answerText).toBe('');
  });

  it('ignora STREAM_CHUNK em reading (stream ainda não começou)', () => {
    const reading = reduce(initialState, { type: 'SHORTCUT_PRESSED' });
    expect(reduce(reading, { type: 'STREAM_CHUNK', text: 'cedo demais' })).toBe(reading);
  });

  it('ignora STREAM_CHUNK depois de done', () => {
    const done = run([{ type: 'STREAM_CHUNK', text: 'fim' }, { type: 'STREAM_DONE' }], streamingState());
    const after = reduce(done, { type: 'STREAM_CHUNK', text: 'atrasado' });
    expect(after).toBe(done);
    expect(after.answerText).toBe('fim');
  });

  it('ignora CLIPBOARD_READ em idle', () => {
    expect(reduce(initialState, { type: 'CLIPBOARD_READ', content: textContent })).toBe(initialState);
  });

  it('ignora CLIPBOARD_EMPTY em idle', () => {
    expect(reduce(initialState, { type: 'CLIPBOARD_EMPTY' })).toBe(initialState);
  });

  it('ignora STREAM_STARTED em idle', () => {
    expect(reduce(initialState, { type: 'STREAM_STARTED', streamId: 99 })).toBe(initialState);
  });

  it('ignora STREAM_STARTED durante streaming (não troca de stream no meio)', () => {
    const streaming = streamingState();
    const after = reduce(streaming, { type: 'STREAM_STARTED', streamId: 999 });
    expect(after).toBe(streaming);
    expect(after.streamId).toBe(7);
  });

  it('ignora STREAM_DONE em idle', () => {
    expect(reduce(initialState, { type: 'STREAM_DONE' })).toBe(initialState);
  });

  it('ignora CLIPBOARD_READ durante streaming sem sobrescrever o conteúdo', () => {
    const streaming = streamingState();
    const after = reduce(streaming, { type: 'CLIPBOARD_READ', content: imageContent });
    expect(after).toBe(streaming);
    expect(after.content).toEqual(textContent);
  });
});

describe('pureza do reducer', () => {
  it('não muta o estado de entrada em nenhuma transição', () => {
    const frozen = Object.freeze({ ...streamingState() });
    expect(() => reduce(frozen, { type: 'STREAM_CHUNK', text: 'abc' })).not.toThrow();
    expect(frozen.answerText).toBe('');
  });

  it('fluxo completo feliz: idle → reading → flashing-processing → streaming → done', () => {
    const trail: PipelineState['status'][] = [];
    const events: PipelineEvent[] = [
      { type: 'SHORTCUT_PRESSED' },
      { type: 'CLIPBOARD_READ', content: textContent },
      { type: 'STREAM_STARTED', streamId: 1 },
      { type: 'STREAM_CHUNK', text: '42' },
      { type: 'STREAM_DONE' },
    ];
    let state = initialState;
    for (const event of events) {
      state = reduce(state, event);
      trail.push(state.status);
    }
    expect(trail).toEqual(['reading', 'flashing-processing', 'streaming', 'streaming', 'done']);
    expect(state.answerText).toBe('42');
  });
});
