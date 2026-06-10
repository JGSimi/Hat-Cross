import { describe, expect, it, vi } from 'vitest';
import { createTokenManager, type RawToken } from './tokenManager';

const MINUTE = 60 * 1000;

/** Relógio falso controlável. */
function fakeClock(start = 0) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe('createTokenManager', () => {
  it('busca o token na primeira chamada e cacheia o resultado', async () => {
    const clock = fakeClock();
    const fetchToken = vi.fn(
      async (): Promise<RawToken> => ({ token: 'a', expiresAtMs: 60 * MINUTE }),
    );
    const tm = createTokenManager({ fetchToken, now: clock.now });

    expect(await tm.getToken()).toBe('a');
    expect(await tm.getToken()).toBe('a');
    expect(fetchToken).toHaveBeenCalledTimes(1); // segunda veio do cache
  });

  it('refresca proativamente dentro da janela de skew', async () => {
    const clock = fakeClock();
    let n = 0;
    const fetchToken = vi.fn(async (): Promise<RawToken> => {
      n += 1;
      return { token: `t${n}`, expiresAtMs: clock.now() + 60 * MINUTE };
    });
    const tm = createTokenManager({
      fetchToken,
      now: clock.now,
      refreshSkewMs: 5 * MINUTE,
    });

    expect(await tm.getToken()).toBe('t1'); // expira em t=60min
    clock.advance(54 * MINUTE); // agora t=54min; 54+5 < 60 → ainda fresco
    expect(await tm.getToken()).toBe('t1');
    clock.advance(2 * MINUTE); // t=56min; 56+5 >= 60 → dentro do skew, refresca
    expect(await tm.getToken()).toBe('t2');
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });

  it('forceRefresh ignora o cache', async () => {
    const clock = fakeClock();
    let n = 0;
    const fetchToken = vi.fn(async (): Promise<RawToken> => {
      n += 1;
      return { token: `t${n}`, expiresAtMs: clock.now() + 60 * MINUTE };
    });
    const tm = createTokenManager({ fetchToken, now: clock.now });

    expect(await tm.getToken()).toBe('t1');
    expect(await tm.getToken(true)).toBe('t2'); // forçado
    expect(fetchToken).toHaveBeenLastCalledWith(true);
  });

  it('dedupe: refreshes concorrentes compartilham uma única chamada', async () => {
    const clock = fakeClock();
    let resolve!: (t: RawToken) => void;
    const fetchToken = vi.fn(
      () =>
        new Promise<RawToken>((r) => {
          resolve = r;
        }),
    );
    const tm = createTokenManager({ fetchToken, now: clock.now });

    const p1 = tm.getToken();
    const p2 = tm.getToken();
    expect(fetchToken).toHaveBeenCalledTimes(1);

    resolve({ token: 'shared', expiresAtMs: 60 * MINUTE });
    expect(await p1).toBe('shared');
    expect(await p2).toBe('shared');
  });

  it('um refresh que falha não trava o próximo (sem in-flight pendurado)', async () => {
    const clock = fakeClock();
    const fetchToken = vi
      .fn<() => Promise<RawToken>>()
      .mockRejectedValueOnce(new Error('rede'))
      .mockResolvedValueOnce({ token: 'ok', expiresAtMs: 60 * MINUTE });
    const tm = createTokenManager({ fetchToken, now: clock.now });

    await expect(tm.getToken()).rejects.toThrow('rede');
    expect(await tm.getToken()).toBe('ok'); // segunda tentativa funciona
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });

  it('clear() força nova busca na próxima chamada', async () => {
    const clock = fakeClock();
    let n = 0;
    const fetchToken = vi.fn(async (): Promise<RawToken> => {
      n += 1;
      return { token: `t${n}`, expiresAtMs: clock.now() + 60 * MINUTE };
    });
    const tm = createTokenManager({ fetchToken, now: clock.now });

    expect(await tm.getToken()).toBe('t1');
    tm.clear();
    expect(await tm.getToken()).toBe('t2');
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });
});
