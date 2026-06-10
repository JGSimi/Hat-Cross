// Máquina de estados pura do fluxo clipboard → IA → flash.
// Sem efeitos: o shell (bridge/stores) despacha eventos e reage às transições.

import type { ClipboardContent } from '../../bridge/types';

export type PipelineStatus =
  | 'idle'
  | 'reading'
  | 'flashing-processing'
  | 'streaming'
  | 'done'
  | 'error';

export type PipelineEvent =
  | { type: 'SHORTCUT_PRESSED' }
  | { type: 'CLIPBOARD_READ'; content: ClipboardContent }
  | { type: 'CLIPBOARD_EMPTY' }
  | { type: 'STREAM_STARTED'; streamId: number }
  | { type: 'STREAM_CHUNK'; text: string }
  | { type: 'STREAM_DONE' }
  | { type: 'STREAM_ERROR'; code: string }
  | { type: 'RESET' };

export interface PipelineState {
  status: PipelineStatus;
  content?: ClipboardContent;
  streamId?: number;
  answerText: string;
  errorCode?: string;
}

export const initialState: PipelineState = {
  status: 'idle',
  answerText: '',
};

/** Estados em que há um fluxo em andamento (suscetíveis a STREAM_ERROR). */
const ACTIVE_STATUSES: ReadonlySet<PipelineStatus> = new Set([
  'reading',
  'flashing-processing',
  'streaming',
]);

/** Estados a partir dos quais o atalho pode (re)iniciar o fluxo. */
const RESTARTABLE_STATUSES: ReadonlySet<PipelineStatus> = new Set([
  'idle',
  'done',
  'error',
]);

/**
 * Reducer puro do pipeline. Eventos fora de ordem são ignorados
 * devolvendo a MESMA referência de estado, sem mutação.
 */
export function reduce(state: PipelineState, event: PipelineEvent): PipelineState {
  switch (event.type) {
    case 'SHORTCUT_PRESSED': {
      if (!RESTARTABLE_STATUSES.has(state.status)) {
        return state; // sem reentrância durante um fluxo ativo
      }
      return { status: 'reading', answerText: '' };
    }

    case 'CLIPBOARD_READ': {
      if (state.status !== 'reading') {
        return state;
      }
      if (event.content.kind === 'empty') {
        return { status: 'error', answerText: '', errorCode: 'clipboardEmpty' };
      }
      return { ...state, status: 'flashing-processing', content: event.content };
    }

    case 'CLIPBOARD_EMPTY': {
      if (state.status !== 'reading') {
        return state;
      }
      return { status: 'error', answerText: '', errorCode: 'clipboardEmpty' };
    }

    case 'STREAM_STARTED': {
      if (state.status !== 'flashing-processing') {
        return state;
      }
      return { ...state, status: 'streaming', streamId: event.streamId };
    }

    case 'STREAM_CHUNK': {
      if (state.status !== 'streaming') {
        return state;
      }
      return { ...state, answerText: state.answerText + event.text };
    }

    case 'STREAM_DONE': {
      if (state.status !== 'streaming') {
        return state;
      }
      return { ...state, status: 'done' };
    }

    case 'STREAM_ERROR': {
      if (!ACTIVE_STATUSES.has(state.status)) {
        return state;
      }
      return { ...state, status: 'error', errorCode: event.code };
    }

    case 'RESET': {
      return initialState;
    }
  }
}
