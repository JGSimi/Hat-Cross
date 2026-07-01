import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useCountUp } from './useCountUp';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useCountUp', () => {
  it('sem matchMedia (jsdom/ambientes sem motion) devolve o alvo direto', () => {
    const { result } = renderHook(() => useCountUp(1234));
    expect(result.current).toBe(1234);
  });

  it('com prefers-reduced-motion devolve o alvo direto', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    const { result } = renderHook(() => useCountUp(1234));
    expect(result.current).toBe(1234);
  });

  it('com motion habilitado começa em 0 e chega ao alvo', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    const { result } = renderHook(() => useCountUp(500, 50));
    expect(result.current).toBe(0);
    // rAF pode engasgar com a suíte em paralelo — timeout generoso evita flake
    await vi.waitFor(() => expect(result.current).toBe(500), { timeout: 4000 });
  });

  it('alvo 0 não anima', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    const { result } = renderHook(() => useCountUp(0));
    expect(result.current).toBe(0);
  });
});
