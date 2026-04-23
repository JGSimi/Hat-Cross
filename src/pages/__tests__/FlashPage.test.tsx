import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import FlashPage from '../FlashPage';

// FlashPage listens for `flash-adjust-enter` and `flash-show` events + drives
// its own phase state machine. For axe coverage we render the idle state
// (no events fire in jsdom) — the adjust / show modes are covered by the
// existing handwritten a11y tests under src/test/a11y/.

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(() => Promise.resolve()),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => Promise.resolve()),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    setSize: vi.fn(() => Promise.resolve()),
    outerPosition: vi.fn(() => Promise.resolve({ x: 0, y: 0 })),
  }),
  LogicalSize: class {
    constructor(public width: number, public height: number) {}
  },
}));

describe('FlashPage (idle)', () => {
  it('renders an empty container when idle (nothing leaks into the DOM tree)', () => {
    const { container } = render(<FlashPage />);
    // Idle state renders just a bare sized div; no focusable content.
    expect(container.querySelectorAll('button').length).toBe(0);
  });

  it('passes axe (idle)', async () => {
    const { container } = render(<FlashPage />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
