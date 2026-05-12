import { describe, expect, it, vi } from 'vitest';
import { withTimeout } from '../async';

describe('withTimeout', () => {
  it('resolves when the work finishes before the timeout', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 100, 'late')).resolves.toBe('ok');
  });

  it('rejects when the work hangs past the timeout', async () => {
    vi.useFakeTimers();
    const pending = new Promise<string>(() => {});
    const result = withTimeout(pending, 100, 'hung');
    const expectation = expect(result).rejects.toMatchObject({
      name: 'TimeoutError',
      message: 'hung',
    });

    await vi.advanceTimersByTimeAsync(100);

    await expectation;
    vi.useRealTimers();
  });
});
