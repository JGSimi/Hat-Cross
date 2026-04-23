import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry } from '../withRetry';

describe('withRetry (EH1)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the value on first success with no retries', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries a failure and returns value on second try', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValue('ok');

    const promise = withRetry(fn, { baseDelayMs: 100, jitter: false });
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws the last error after maxAttempts', async () => {
    const err = new Error('nope');
    const fn = vi.fn().mockRejectedValue(err);

    const promise = withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 100,
      jitter: false,
    }).catch((e) => e);

    await vi.advanceTimersByTimeAsync(100 + 200);
    const caught = await promise;

    expect(caught).toBe(err);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('honors shouldRetry=false and short-circuits', async () => {
    const err = new Error('non-retryable');
    const fn = vi.fn().mockRejectedValue(err);

    const caught = await withRetry(fn, {
      maxAttempts: 5,
      baseDelayMs: 100,
      jitter: false,
      shouldRetry: () => false,
    }).catch((e) => e);

    expect(caught).toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('passes the thrown value and attempt number to shouldRetry', async () => {
    const calls: Array<[unknown, number]> = [];
    const err = new Error('x');
    const fn = vi.fn().mockRejectedValue(err);

    const promise = withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 50,
      jitter: false,
      shouldRetry: (e, attempt) => {
        calls.push([e, attempt]);
        return true;
      },
    }).catch(() => undefined);

    await vi.advanceTimersByTimeAsync(50 + 100);
    await promise;

    expect(calls).toEqual([
      [err, 1],
      [err, 2],
    ]);
  });

  it('invokes onRetry with err, attempt, delay before sleeping', async () => {
    const onRetry = vi.fn();
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('t1'))
      .mockResolvedValue('ok');

    const promise = withRetry(fn, {
      baseDelayMs: 200,
      jitter: false,
      onRetry,
    });
    await vi.advanceTimersByTimeAsync(200);
    await promise;

    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, 200);
  });

  it('uses exponential backoff (100, 200, 400 with no jitter)', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn().mockRejectedValue(new Error('x'));

    const promise = withRetry(fn, {
      maxAttempts: 4,
      baseDelayMs: 100,
      jitter: false,
      onRetry,
    }).catch(() => undefined);

    await vi.advanceTimersByTimeAsync(100 + 200 + 400);
    await promise;

    const delays = onRetry.mock.calls.map((c) => c[2]);
    expect(delays).toEqual([100, 200, 400]);
  });

  it('caps delay at maxDelayMs', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn().mockRejectedValue(new Error('x'));

    const promise = withRetry(fn, {
      maxAttempts: 5,
      baseDelayMs: 1000,
      maxDelayMs: 2500,
      jitter: false,
      onRetry,
    }).catch(() => undefined);

    await vi.advanceTimersByTimeAsync(1000 + 2000 + 2500 + 2500);
    await promise;

    const delays = onRetry.mock.calls.map((c) => c[2]);
    // 1000, 2000, capped at 2500, capped at 2500
    expect(delays).toEqual([1000, 2000, 2500, 2500]);
  });

  it('applies jitter when enabled (values differ from pure exponential)', async () => {
    const onRetry = vi.fn();
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0); // 0.5 + 0 * 0.5 = 0.5
    const fn = vi.fn().mockRejectedValue(new Error('x'));

    const promise = withRetry(fn, {
      maxAttempts: 2,
      baseDelayMs: 200,
      jitter: true,
      onRetry,
    }).catch(() => undefined);

    await vi.advanceTimersByTimeAsync(200);
    await promise;

    // With random=0, jitter multiplier is 0.5 → delay 100
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, 100);
    randomSpy.mockRestore();
  });

  it('aborts when the AbortSignal fires mid-backoff', async () => {
    const controller = new AbortController();
    const fn = vi.fn().mockRejectedValue(new Error('x'));

    const promise = withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 1000,
      jitter: false,
      signal: controller.signal,
    }).catch((e) => e);

    await vi.advanceTimersByTimeAsync(200);
    controller.abort();
    await vi.advanceTimersByTimeAsync(2000);

    const caught = await promise;
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/abort/i);
    // Original error attempted once; retry cancelled during backoff.
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const fn = vi.fn().mockResolvedValue('ok');

    const caught = await withRetry(fn, { signal: controller.signal }).catch(
      (e) => e,
    );
    expect(caught).toBeInstanceOf(Error);
    expect(fn).not.toHaveBeenCalled();
  });
});
