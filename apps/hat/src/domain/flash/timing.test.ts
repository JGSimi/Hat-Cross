import { describe, expect, it } from 'vitest';
import fixture from '../../../fixtures/flash-timing-cases.json';
import { clampPosition, holdMsFor } from './timing';

describe('holdMsFor', () => {
  it.each(fixture.cases)(
    'retorna $holdMs ms para texto de tamanho $textLength (fixture compartilhada)',
    ({ textLength, holdMs }) => {
      expect(holdMsFor(textLength)).toBe(holdMs);
    },
  );

  it('nunca retorna abaixo do piso de 1800ms para texto vazio', () => {
    expect(holdMsFor(0)).toBe(1800);
  });

  it('nunca ultrapassa o teto de 6500ms mesmo para textos enormes', () => {
    expect(holdMsFor(1_000_000)).toBe(6500);
  });
});

describe('clampPosition', () => {
  const card = { w: 300, h: 120 };
  const monitor = { w: 1920, h: 1080 };

  it('mantém posição inalterada quando o card já está dentro do monitor', () => {
    expect(clampPosition({ x: 100, y: 200 }, card, monitor)).toEqual({
      x: 100,
      y: 200,
    });
  });

  it('mantém posição no limite exato sem alterá-la', () => {
    expect(
      clampPosition({ x: monitor.w - card.w, y: monitor.h - card.h }, card, monitor),
    ).toEqual({ x: 1620, y: 960 });
  });

  it('traz coordenadas negativas de volta para zero', () => {
    expect(clampPosition({ x: -50, y: -10 }, card, monitor)).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('puxa o card de volta quando vaza pela borda direita/inferior', () => {
    expect(clampPosition({ x: 1900, y: 1070 }, card, monitor)).toEqual({
      x: 1620,
      y: 960,
    });
  });

  it('clampa cada eixo de forma independente', () => {
    expect(clampPosition({ x: -5, y: 1070 }, card, monitor)).toEqual({
      x: 0,
      y: 960,
    });
  });

  it('retorna {x:0, y:0} quando o card é mais largo que o monitor', () => {
    expect(
      clampPosition({ x: 100, y: 100 }, { w: 2000, h: 100 }, monitor),
    ).toEqual({ x: 0, y: 0 });
  });

  it('retorna {x:0, y:0} quando o card é mais alto que o monitor', () => {
    expect(
      clampPosition({ x: 100, y: 100 }, { w: 100, h: 2000 }, monitor),
    ).toEqual({ x: 0, y: 0 });
  });

  it('retorna {x:0, y:0} quando o card tem exatamente o tamanho do monitor e a posição vaza', () => {
    expect(
      clampPosition({ x: 10, y: 10 }, { w: monitor.w, h: monitor.h }, monitor),
    ).toEqual({ x: 0, y: 0 });
  });

  it('não muta o objeto de posição original', () => {
    const pos = { x: -50, y: 5000 };
    clampPosition(pos, card, monitor);
    expect(pos).toEqual({ x: -50, y: 5000 });
  });
});
