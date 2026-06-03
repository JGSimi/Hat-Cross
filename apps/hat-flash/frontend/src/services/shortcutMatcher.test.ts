import { describe, expect, it } from 'vitest';
import { keyboardEventMatchesShortcut } from './shortcutMatcher';

describe('keyboardEventMatchesShortcut', () => {
  it('matches CommandOrControl shortcuts with ctrl on the focused window', () => {
    const event = { key: 'f', ctrlKey: true, metaKey: false, altKey: false, shiftKey: true } as KeyboardEvent;

    expect(keyboardEventMatchesShortcut(event, 'CommandOrControl+Shift+F')).toBe(true);
  });

  it('does not match when a required modifier is missing', () => {
    const event = { key: 'f', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false } as KeyboardEvent;

    expect(keyboardEventMatchesShortcut(event, 'CommandOrControl+Shift+F')).toBe(false);
  });

  it('does not match when an unconfigured modifier is pressed', () => {
    const event = { key: 'f', ctrlKey: true, metaKey: false, altKey: true, shiftKey: true } as KeyboardEvent;

    expect(keyboardEventMatchesShortcut(event, 'CommandOrControl+Shift+F')).toBe(false);
  });
});
