import { describe, expect, it } from 'vitest';
import fixture from '../../../fixtures/flash-area-cases.json';
import {
  DEFAULT_FLASH_AREA,
  MIN_AREA,
  anchorOf,
  areaFromQuadrant,
  areaInQuadrant,
  areaToRect,
  clampArea,
  describeArea,
  moveArea,
  normalizeArea,
  quadrantOf,
  resizeArea,
  scrollPlan,
  type FlashArea,
} from './area';

describe('areaToRect (fixture compartilhada com o Rust)', () => {
  it.each(fixture.rectCases)('$name', ({ area, monitor, rect }) => {
    expect(areaToRect(area, monitor)).toEqual(rect);
  });

  it('o retângulo sempre cabe no monitor', () => {
    for (const { area, monitor } of fixture.rectCases) {
      const r = areaToRect(area, monitor);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(monitor.w);
      expect(r.y + r.height).toBeLessThanOrEqual(monitor.h);
    }
  });
});

describe('areaFromQuadrant (migração do seletor antigo)', () => {
  it.each(fixture.quadrantCases)('$quadrant vira a área no mesmo canto', ({ quadrant, area }) => {
    expect(areaFromQuadrant(quadrant)).toEqual(area);
  });

  it('o padrão é o canto superior esquerdo', () => {
    expect(DEFAULT_FLASH_AREA).toEqual(areaFromQuadrant('top-left'));
  });
});

describe('clampArea', () => {
  it('mantém uma área válida como está', () => {
    const a = { x: 0.1, y: 0.2, w: 0.4, h: 0.3 };
    expect(clampArea(a)).toEqual(a);
  });

  it('nunca deixa a área menor que o mínimo', () => {
    const a = clampArea({ x: 0.1, y: 0.1, w: 0, h: -3 });
    expect(a.w).toBe(MIN_AREA.w);
    expect(a.h).toBe(MIN_AREA.h);
  });

  it('nunca deixa a área sair da tela', () => {
    const a = clampArea({ x: 0.9, y: 2, w: 0.5, h: 0.5 });
    expect(a.x + a.w).toBeLessThanOrEqual(1);
    expect(a.y + a.h).toBeLessThanOrEqual(1);
  });

  it('campo não numérico cai no valor padrão', () => {
    expect(clampArea({ x: Number.NaN, y: Infinity, w: 0.4, h: 0.3 })).toEqual({
      x: DEFAULT_FLASH_AREA.x,
      y: DEFAULT_FLASH_AREA.y,
      w: 0.4,
      h: 0.3,
    });
  });

  it('não muta a área original', () => {
    const a = { x: 2, y: 2, w: 2, h: 2 };
    clampArea(a);
    expect(a).toEqual({ x: 2, y: 2, w: 2, h: 2 });
  });
});

describe('normalizeArea (o que vem do disco)', () => {
  it('lixo vira o padrão', () => {
    expect(normalizeArea(null)).toEqual(DEFAULT_FLASH_AREA);
    expect(normalizeArea('area')).toEqual(DEFAULT_FLASH_AREA);
    expect(normalizeArea([1, 2])).toEqual(DEFAULT_FLASH_AREA);
  });

  it('área parcial completa com o padrão e é limitada', () => {
    expect(normalizeArea({ x: 0.5, w: 0.2 })).toEqual({
      x: 0.5,
      y: DEFAULT_FLASH_AREA.y,
      w: 0.2,
      h: DEFAULT_FLASH_AREA.h,
    });
  });

  it('devolve um objeto novo, sem aliasing com o padrão', () => {
    expect(normalizeArea(null)).not.toBe(DEFAULT_FLASH_AREA);
  });
});

describe('moveArea', () => {
  const a: FlashArea = { x: 0.2, y: 0.2, w: 0.3, h: 0.2 };

  it('move sem mudar o tamanho', () => {
    expect(moveArea(a, 0.1, 0.05)).toEqual({ x: 0.3, y: 0.25, w: 0.3, h: 0.2 });
  });

  it('para na borda da tela', () => {
    expect(moveArea(a, 5, 5)).toEqual({ x: 0.7, y: 0.8, w: 0.3, h: 0.2 });
    expect(moveArea(a, -5, -5)).toEqual({ x: 0, y: 0, w: 0.3, h: 0.2 });
  });
});

describe('resizeArea', () => {
  const a: FlashArea = { x: 0.2, y: 0.2, w: 0.3, h: 0.2 };

  it('quina inferior direita cresce para a direita e para baixo', () => {
    expect(resizeArea(a, 'se', 0.1, 0.1)).toEqual({ x: 0.2, y: 0.2, w: 0.4, h: 0.3 });
  });

  it('quina superior esquerda mantém a quina oposta parada', () => {
    const r = resizeArea(a, 'nw', -0.1, -0.1);
    expect(r).toEqual({ x: 0.1, y: 0.1, w: 0.4, h: 0.3 });
    expect(r.x + r.w).toBeCloseTo(a.x + a.w);
    expect(r.y + r.h).toBeCloseTo(a.y + a.h);
  });

  it('quinas ne e sw mexem nos lados certos', () => {
    expect(resizeArea(a, 'ne', 0.1, -0.1)).toEqual({ x: 0.2, y: 0.1, w: 0.4, h: 0.3 });
    expect(resizeArea(a, 'sw', -0.1, 0.1)).toEqual({ x: 0.1, y: 0.2, w: 0.4, h: 0.3 });
  });

  it('não encolhe abaixo do mínimo', () => {
    const r = resizeArea(a, 'se', -1, -1);
    expect(r.w).toBe(MIN_AREA.w);
    expect(r.h).toBe(MIN_AREA.h);
    expect(r.x).toBe(a.x);
    expect(r.y).toBe(a.y);
  });

  it('não cresce para fora da tela', () => {
    expect(resizeArea(a, 'se', 5, 5)).toEqual({ x: 0.2, y: 0.2, w: 0.8, h: 0.8 });
    expect(resizeArea(a, 'nw', -5, -5)).toEqual({ x: 0, y: 0, w: 0.5, h: 0.4 });
  });

  it('"move" arrasta a área inteira', () => {
    expect(resizeArea(a, 'move', 0.1, 0)).toEqual(moveArea(a, 0.1, 0));
  });
});

describe('quadrantes', () => {
  it('quadrantOf usa o centro da área', () => {
    expect(quadrantOf({ x: 0.02, y: 0.02, w: 0.3, h: 0.22 })).toBe('top-left');
    expect(quadrantOf({ x: 0.6, y: 0.02, w: 0.3, h: 0.22 })).toBe('top-right');
    expect(quadrantOf({ x: 0.02, y: 0.7, w: 0.3, h: 0.22 })).toBe('bottom-left');
    expect(quadrantOf({ x: 0.6, y: 0.7, w: 0.3, h: 0.22 })).toBe('bottom-right');
  });

  it('areaInQuadrant leva a área para o canto mantendo o tamanho', () => {
    const a: FlashArea = { x: 0.3, y: 0.3, w: 0.4, h: 0.3 };
    expect(areaInQuadrant(a, 'bottom-right')).toEqual({ x: 0.58, y: 0.68, w: 0.4, h: 0.3 });
    expect(areaInQuadrant(a, 'top-left')).toEqual({ x: 0.02, y: 0.02, w: 0.4, h: 0.3 });
  });

  it('anchorOf gruda a resposta no lado da borda mais próxima', () => {
    expect(anchorOf({ x: 0.68, y: 0.76, w: 0.3, h: 0.22 })).toEqual({ horizontal: 'right', vertical: 'bottom' });
    expect(anchorOf(DEFAULT_FLASH_AREA)).toEqual({ horizontal: 'left', vertical: 'top' });
  });
});

describe('describeArea (texto para o usuário)', () => {
  it('diz o canto e quanto da tela ocupa, em pt-BR', () => {
    expect(describeArea(DEFAULT_FLASH_AREA)).toBe('Canto superior esquerdo · ocupa 7% da tela');
    expect(describeArea({ x: 0, y: 0, w: 1, h: 1 })).toBe('Canto superior esquerdo · ocupa 100% da tela');
    expect(describeArea({ x: 0.6, y: 0.7, w: 0.3, h: 0.2 })).toBe('Canto inferior direito · ocupa 6% da tela');
  });

  it('nunca diz 0%', () => {
    expect(describeArea({ x: 0, y: 0, w: 0.15, h: 0.1 })).toBe('Canto superior esquerdo · ocupa 2% da tela');
  });
});

describe('scrollPlan (resposta maior que a área)', () => {
  it('sem sobra não rola e usa o tempo normal', () => {
    expect(scrollPlan(0, 100)).toEqual({ scroll: false, delayMs: 0, durationMs: 0, distancePx: 0, holdMs: 3400 });
    expect(scrollPlan(-20, 10)).toMatchObject({ scroll: false, holdMs: 1800 });
  });

  it('com sobra espera um pouco, rola devagar até o fim e segura no final', () => {
    const p = scrollPlan(220, 900);
    expect(p.scroll).toBe(true);
    expect(p.distancePx).toBe(220);
    expect(p.delayMs).toBe(1500);
    expect(p.durationMs).toBe(10000); // 22 px/s
    expect(p.holdMs).toBe(1500 + 10000 + 2000);
  });

  it('rolagem curta ainda leva pelo menos 2 s', () => {
    expect(scrollPlan(10, 400).durationMs).toBe(2000);
  });

  it('nunca segura a resposta por mais de 60 s', () => {
    const p = scrollPlan(50_000, 20_000);
    expect(p.holdMs).toBe(60_000);
    expect(p.delayMs + p.durationMs).toBeLessThanOrEqual(60_000);
  });

  it('o tempo nunca é menor que o normal para o texto', () => {
    expect(scrollPlan(10, 400).holdMs).toBeGreaterThanOrEqual(6500);
  });
});
