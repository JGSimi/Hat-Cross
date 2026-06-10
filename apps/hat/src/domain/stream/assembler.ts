// Domínio puro: monta a resposta final a partir dos chunks emitidos pelo
// shell nativo via evento 'stream:chunk'. Sem dependências de Tauri/React.

import type { StreamChunkPayload } from '../../bridge/types';

export interface StreamUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface ParsedErrorCode {
  code: string;
  status?: number;
  detail?: string;
}

/**
 * Acumula chunks de um único stream. O primeiro streamId visto "trava" o
 * assembler: chunks de qualquer outro streamId são ignorados (proteção contra
 * streams concorrentes/cancelados que ainda emitem eventos).
 */
export class StreamAssembler {
  private streamId: number | null = null;
  private textParts: string[] = [];
  private thinkingParts: string[] = [];
  private finished = false;
  private currentUsage: StreamUsage = {};

  push(chunk: StreamChunkPayload): void {
    if (this.streamId === null) {
      this.streamId = chunk.streamId;
    } else if (chunk.streamId !== this.streamId) {
      return;
    }

    if (chunk.contentType === 'thinking') {
      this.thinkingParts.push(chunk.text);
    } else {
      this.textParts.push(chunk.text);
    }

    if (chunk.inputTokens !== undefined) {
      this.currentUsage.inputTokens = chunk.inputTokens;
    }
    if (chunk.outputTokens !== undefined) {
      this.currentUsage.outputTokens = chunk.outputTokens;
    }

    if (chunk.isFinished) {
      this.finished = true;
    }
  }

  get text(): string {
    return this.textParts.join('');
  }

  get thinking(): string {
    return this.thinkingParts.join('');
  }

  get isFinished(): boolean {
    return this.finished;
  }

  get usage(): StreamUsage {
    return { ...this.currentUsage };
  }
}

const ERROR_PREFIX = 'error:';

/**
 * Parseia o formato `error:<code>[:status[:detail]]` emitido pelo Rust
 * (src-tauri/src/streaming.rs). O detail pode conter ':' livremente.
 * Retorna null se a string não começar com 'error:' ou não tiver código.
 */
export function parseErrorCode(raw: string): ParsedErrorCode | null {
  if (!raw.startsWith(ERROR_PREFIX)) {
    return null;
  }

  const rest = raw.slice(ERROR_PREFIX.length);
  if (rest.length === 0) {
    return null;
  }

  const codeEnd = rest.indexOf(':');
  if (codeEnd === -1) {
    return { code: rest };
  }

  const code = rest.slice(0, codeEnd);
  if (code.length === 0) {
    return null;
  }

  const afterCode = rest.slice(codeEnd + 1);
  const statusEnd = afterCode.indexOf(':');
  const statusSegment = statusEnd === -1 ? afterCode : afterCode.slice(0, statusEnd);
  const status = Number.parseInt(statusSegment, 10);

  // Status sempre é numérico no formato do Rust; se não for, tratamos tudo
  // após o code como detail (defensivo contra formatos inesperados).
  if (!Number.isFinite(status) || String(status) !== statusSegment) {
    return { code, detail: afterCode };
  }

  if (statusEnd === -1) {
    return { code, status };
  }

  return { code, status, detail: afterCode.slice(statusEnd + 1) };
}
