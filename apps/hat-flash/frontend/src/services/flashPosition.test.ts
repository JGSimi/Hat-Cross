import { describe, expect, it } from 'vitest';
import { nextFlashPosition } from './flashPosition';

describe('nextFlashPosition', () => {
  it('cycles through stable screen positions', () => {
    expect(nextFlashPosition({ x: 40, y: 40 })).toEqual({ x: 50, y: 15 });
    expect(nextFlashPosition({ x: 50, y: 15 })).toEqual({ x: 85, y: 15 });
    expect(nextFlashPosition({ x: 85, y: 85 })).toEqual({ x: 15, y: 15 });
  });

  it('recovers from unknown positions by moving to the first preset', () => {
    expect(nextFlashPosition({ x: 12, y: 99 })).toEqual({ x: 15, y: 15 });
  });
});
