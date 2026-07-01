// Count-up para números de display (ex.: total de uso no Perfil).
// Sem motion (prefers-reduced-motion, ambiente sem matchMedia como jsdom,
// ou alvo <= 0), devolve o alvo direto — testes e acessibilidade primeiro.

import { useEffect, useState } from 'react';

function shouldAnimate(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Sobe de 0 até `target` com ease-out (rAF). Re-anima quando o alvo muda. */
export function useCountUp(target: number, durationMs = 900): number {
  const animate = shouldAnimate() && target > 0;
  const [value, setValue] = useState(animate ? 0 : target);

  useEffect(() => {
    if (!animate) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 4); // casa com --ease-out-expo
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, animate]);

  return value;
}
