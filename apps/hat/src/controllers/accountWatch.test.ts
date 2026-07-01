import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccountStatus } from '../services/account';
import { startAccountWatch } from './accountWatch';

function status(over: Partial<AccountStatus> = {}): AccountStatus {
  return {
    uid: 'u1',
    email: 'a@b.c',
    entitled: true,
    subscription: { status: 'active', plan: 'unlimited', currentPeriodEnd: null },
    trialEndsAt: null,
    ...over,
  };
}

/** Alvo de eventos mínimo (window/document fake) para testes determinísticos. */
function makeTarget(visibilityState: DocumentVisibilityState = 'visible') {
  const listeners = new Map<string, Set<() => void>>();
  return {
    visibilityState,
    addEventListener: (type: string, fn: () => void) => {
      const set = listeners.get(type) ?? new Set();
      set.add(fn);
      listeners.set(type, set);
    },
    removeEventListener: (type: string, fn: () => void) => {
      listeners.get(type)?.delete(fn);
    },
    fire: (type: string) => {
      for (const fn of listeners.get(type) ?? []) fn();
    },
    count: (type: string) => listeners.get(type)?.size ?? 0,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('startAccountWatch', () => {
  it('busca imediatamente e repassa o status', async () => {
    const onStatus = vi.fn();
    const fetchStatus = vi.fn().mockResolvedValue(status());
    const win = makeTarget();
    const doc = makeTarget();

    const stop = startAccountWatch({ fetchStatus, onStatus, windowRef: win, documentRef: doc });
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchStatus).toHaveBeenCalledOnce();
    expect(onStatus).toHaveBeenCalledWith(status());
    stop();
  });

  it('faz polling no intervalo configurado', async () => {
    const fetchStatus = vi.fn().mockResolvedValue(status());
    const stop = startAccountWatch({
      fetchStatus,
      onStatus: vi.fn(),
      intervalMs: 1000,
      windowRef: makeTarget(),
      documentRef: makeTarget(),
    });
    await vi.advanceTimersByTimeAsync(3100);
    expect(fetchStatus).toHaveBeenCalledTimes(4); // imediato + 3 ticks
    stop();
  });

  it('refetch instantâneo quando a janela ganha foco (volta do portal Stripe)', async () => {
    const onStatus = vi.fn();
    const fetchStatus = vi
      .fn()
      .mockResolvedValueOnce(status())
      .mockResolvedValueOnce(
        status({ entitled: false, subscription: { status: 'canceled', plan: null, currentPeriodEnd: null } }),
      );
    const win = makeTarget();
    const stop = startAccountWatch({
      fetchStatus,
      onStatus,
      windowRef: win,
      documentRef: makeTarget(),
    });
    await vi.advanceTimersByTimeAsync(0);

    win.fire('focus');
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchStatus).toHaveBeenCalledTimes(2);
    expect(onStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({ entitled: false }),
    );
    stop();
  });

  it('visibilitychange só refaz o fetch quando fica visível', async () => {
    const fetchStatus = vi.fn().mockResolvedValue(status());
    const doc = makeTarget('hidden');
    const stop = startAccountWatch({
      fetchStatus,
      onStatus: vi.fn(),
      windowRef: makeTarget(),
      documentRef: doc,
    });
    await vi.advanceTimersByTimeAsync(0);

    doc.fire('visibilitychange'); // ainda hidden — nada
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchStatus).toHaveBeenCalledOnce();

    doc.visibilityState = 'visible';
    doc.fire('visibilitychange');
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchStatus).toHaveBeenCalledTimes(2);
    stop();
  });

  it('erro de rede chama onError e NÃO emite status (mantém o último bom)', async () => {
    const onStatus = vi.fn();
    const onError = vi.fn();
    const fetchStatus = vi.fn().mockRejectedValue(new Error('offline'));
    const stop = startAccountWatch({
      fetchStatus,
      onStatus,
      onError,
      windowRef: makeTarget(),
      documentRef: makeTarget(),
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(onError).toHaveBeenCalledOnce();
    expect(onStatus).not.toHaveBeenCalled();
    stop();
  });

  it('fetches não se sobrepõem (disparo durante voo é ignorado)', async () => {
    let resolveFirst: (s: AccountStatus) => void = () => {};
    const fetchStatus = vi
      .fn()
      .mockImplementationOnce(() => new Promise<AccountStatus>((r) => (resolveFirst = r)))
      .mockResolvedValue(status());
    const win = makeTarget();
    const stop = startAccountWatch({
      fetchStatus,
      onStatus: vi.fn(),
      windowRef: win,
      documentRef: makeTarget(),
    });

    win.fire('focus'); // primeiro fetch ainda em voo
    win.fire('focus');
    expect(fetchStatus).toHaveBeenCalledOnce();

    resolveFirst(status());
    await vi.advanceTimersByTimeAsync(0);
    win.fire('focus');
    expect(fetchStatus).toHaveBeenCalledTimes(2);
    stop();
  });

  it('stop() remove listeners, cancela o timer e descarta resultados tardios', async () => {
    const onStatus = vi.fn();
    let resolveLate: (s: AccountStatus) => void = () => {};
    const fetchStatus = vi
      .fn()
      .mockImplementationOnce(() => new Promise<AccountStatus>((r) => (resolveLate = r)));
    const win = makeTarget();
    const doc = makeTarget();
    const stop = startAccountWatch({
      fetchStatus,
      onStatus,
      intervalMs: 1000,
      windowRef: win,
      documentRef: doc,
    });

    stop();
    resolveLate(status());
    await vi.advanceTimersByTimeAsync(5000);

    expect(onStatus).not.toHaveBeenCalled();
    expect(fetchStatus).toHaveBeenCalledOnce(); // nenhum tick após o stop
    expect(win.count('focus')).toBe(0);
    expect(doc.count('visibilitychange')).toBe(0);
  });
});
