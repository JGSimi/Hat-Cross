import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(
  join(here, '..', '..', 'components/Chat/MessageBubble.tsx'),
  'utf-8',
);

/**
 * Contract test for the idle opacity of the message-action row (copy +
 * timestamp). Previous value (0.35) dropped the Copy button below AA
 * contrast in light themes like noir / ice / lavender — critique I3.
 * Regression guard to keep future edits above 0.5.
 */
describe('a11y: MessageBubble action row idle opacity', () => {
  it('uses 0.7 idle opacity (not 0.35)', () => {
    // Historic bug: opacity: hovered ? 1 : 0.35 in the action row.
    expect(src).not.toMatch(/opacity:\s*hovered\s*\?\s*1\s*:\s*0\.35/);
    // Current contract: 0.7 idle.
    expect(src).toMatch(/opacity:\s*hovered\s*\?\s*1\s*:\s*0\.7/);
  });
});
