export interface Position {
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

const HOLD_MS_MIN = 1800;
const HOLD_MS_MAX = 6500;
const HOLD_MS_PER_CHAR = 34;

/**
 * Tempo (ms) que o card de flash permanece visível para um texto
 * de `textLength` caracteres: max(1800, min(6500, textLength * 34)).
 * Mantida em sincronia com crates/hat-core/src/flash.rs via
 * fixtures/flash-timing-cases.json.
 */
export function holdMsFor(textLength: number): number {
  return Math.max(HOLD_MS_MIN, Math.min(HOLD_MS_MAX, textLength * HOLD_MS_PER_CHAR));
}

/**
 * Mantém o card inteiramente dentro do monitor, clampando cada eixo.
 * Se o card não cabe no monitor (mais largo ou mais alto), ancora em {x:0, y:0}.
 */
export function clampPosition(pos: Position, card: Size, monitor: Size): Position {
  if (card.w > monitor.w || card.h > monitor.h) {
    return { x: 0, y: 0 };
  }
  return {
    x: Math.min(Math.max(pos.x, 0), monitor.w - card.w),
    y: Math.min(Math.max(pos.y, 0), monitor.h - card.h),
  };
}
