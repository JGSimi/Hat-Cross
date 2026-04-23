export interface RetryOptions {
  /** Maximum total attempts including the first (default 3). */
  maxAttempts?: number;
  /** Delay after the first failure, in ms. Default 500. */
  baseDelayMs?: number;
  /** Upper bound on any single delay, in ms. Default 8000. */
  maxDelayMs?: number;
  /** Multiply exponential delay by 0.5 + 0.5*rand() to avoid thundering herd. Default true. */
  jitter?: boolean;
  /** Gate: return false to stop retrying for this error. Default `() => true`. */
  shouldRetry?: (err: unknown, attempt: number) => boolean;
  /** Called before sleeping for a retry. Useful to surface "Tentando de novo..." UI. */
  onRetry?: (err: unknown, attempt: number, delayMs: number) => void;
  /** External cancel — aborts mid-backoff so the user's "stop" button is responsive. */
  signal?: AbortSignal;
}

class AbortError extends Error {
  constructor() {
    super('aborted');
    this.name = 'AbortError';
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AbortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(new AbortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Run `fn` with exponential-backoff retries.
 *
 * - `shouldRetry(err, attempt)` controls whether to retry — pair with
 *   `NON_RETRYABLE` from `ErrorKind.ts` to keep auth/credit errors
 *   from spinning.
 * - `onRetry(err, attempt, delayMs)` fires BEFORE sleeping — use it to
 *   render "Tentando de novo (2/3)..." UX.
 * - `signal` aborts both the current sleep and any further attempts.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 500,
    maxDelayMs = 8000,
    jitter = true,
    shouldRetry = () => true,
    onRetry,
    signal,
  } = opts;

  if (signal?.aborted) {
    throw new AbortError();
  }

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt >= maxAttempts) break;
      if (!shouldRetry(err, attempt)) break;

      const pureDelay = Math.min(
        baseDelayMs * 2 ** (attempt - 1),
        maxDelayMs,
      );
      const delayMs = jitter
        ? Math.round(pureDelay * (0.5 + Math.random() * 0.5))
        : pureDelay;

      onRetry?.(err, attempt, delayMs);
      await sleep(delayMs, signal);
    }
  }
  throw lastErr;
}
