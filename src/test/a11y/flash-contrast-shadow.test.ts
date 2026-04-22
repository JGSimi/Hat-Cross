import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(
  join(here, '..', '..', 'pages/FlashPage.tsx'),
  'utf-8',
);

/**
 * Contract for FP11 (critique I12) — flash text must stay legible
 * against both light and dark screen backgrounds. The default 35%
 * opacity + accent color combination is invisible on a white IDE
 * without a strong shadow; multi-directional dark stroke gives it a
 * outline that carries across every theme.
 */
describe('a11y: FlashPage contrast shadow (FP11)', () => {
  it('emits a multi-direction dark stroke when textShadow is on', () => {
    // Four cardinal strokes + soft halo ⇒ 5 lines in the shadow.
    expect(src).toMatch(/-1px 0 0 rgba\(0,0,0,0\.7\)/);
    expect(src).toMatch(/1px 0 0 rgba\(0,0,0,0\.7\)/);
    expect(src).toMatch(/0 -1px 0 rgba\(0,0,0,0\.7\)/);
    expect(src).toMatch(/0 1px 0 rgba\(0,0,0,0\.7\)/);
    expect(src).toMatch(/0 0 4px rgba\(0,0,0,0\.45\)/);
  });

  it('still honours the opt-out when appearance.textShadow is false', () => {
    expect(src).toMatch(/appearance\?\.textShadow[\s\S]*?'none'/);
  });

  it('does not ship the old weak shadow as the fallback default', () => {
    // Old value: `'0 1px 2px rgba(0,0,0,0.55), 0 0 1px rgba(255,255,255,0.25)'`.
    // Weak drop + faint white rim couldn't carry the lilás accent on white.
    expect(src).not.toMatch(
      /'0 1px 2px rgba\(0,0,0,0\.55\), 0 0 1px rgba\(255,255,255,0\.25\)'/,
    );
  });
});
