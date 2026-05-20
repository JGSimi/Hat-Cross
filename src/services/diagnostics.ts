import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauriRuntime } from '../utils/tauriRuntime';

type DiagnosticFields = Record<string, unknown>;

function baseFields(): DiagnosticFields {
  return {
    platform: typeof navigator === 'undefined' ? 'unknown' : navigator.platform,
    userAgent: typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent,
    windowLabel: isTauriRuntime() ? getCurrentWindow().label : 'browser',
  };
}

export function logDiagnostic(event: string, fields: DiagnosticFields = {}): void {
  const payload = {
    ...baseFields(),
    ...fields,
  };

  if (!isTauriRuntime()) {
    console.info('[diagnostic]', event, payload);
    return;
  }

  invoke('diagnostic_log', { event, fields: payload }).catch((error) => {
    console.warn('[diagnostic] write failed:', error);
  });
}

export async function withDiagnostic<T>(
  event: string,
  fields: DiagnosticFields,
  operation: () => Promise<T>,
): Promise<T> {
  const startedAt = performance.now();
  logDiagnostic(`${event}_start`, fields);
  try {
    const result = await operation();
    logDiagnostic(`${event}_ok`, {
      ...fields,
      durationMs: Math.round(performance.now() - startedAt),
    });
    return result;
  } catch (error) {
    logDiagnostic(`${event}_error`, {
      ...fields,
      durationMs: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
