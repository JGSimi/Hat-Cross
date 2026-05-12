export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new TimeoutError(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

export function isAbortLikeError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function abortErrorMessage(error: unknown, fallback: string): string {
  if (isAbortLikeError(error)) return fallback;
  return error instanceof Error ? error.message : String(error);
}
