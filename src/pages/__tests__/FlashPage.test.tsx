import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import FlashPage from '../FlashPage';

// FlashPage listens for `flash-adjust-enter` and `flash-show` events + drives
// its own phase state machine. For axe coverage we render the idle state
// (no events fire in jsdom) — the adjust / show modes are covered by the
// existing handwritten a11y tests under src/test/a11y/.

const eventMocks = vi.hoisted(() => {
  const listeners = new Map<string, (event: { payload?: unknown }) => void>();
  return {
    listeners,
    listen: vi.fn((event: string, handler: (event: { payload?: unknown }) => void) => {
      listeners.set(event, handler);
      return Promise.resolve(() => listeners.delete(event));
    }),
    emit: vi.fn(() => Promise.resolve()),
  };
});

vi.mock('@tauri-apps/api/event', () => ({
  listen: eventMocks.listen,
  emit: eventMocks.emit,
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

vi.mock('../../utils/tauriRuntime', () => ({
  isTauriRuntime: () => true,
}));

describe('FlashPage (idle)', () => {
  beforeEach(() => {
    eventMocks.listeners.clear();
    eventMocks.listen.mockClear();
    eventMocks.emit.mockClear();
  });

  it('renders an empty container when idle (nothing leaks into the DOM tree)', () => {
    const { container } = render(<FlashPage />);
    // Idle state renders just a bare sized div; no focusable content.
    expect(container.querySelectorAll('button').length).toBe(0);
  });

  it('passes axe (idle)', async () => {
    const { container } = render(<FlashPage />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('announces readiness after flash listeners are mounted', async () => {
    render(<FlashPage />);

    await waitFor(() => {
      expect(eventMocks.emit).toHaveBeenCalledWith('flash-ready', { streamId: null });
    });
    expect(eventMocks.listeners.has('flash-show')).toBe(true);
    expect(eventMocks.listeners.has('chat-stream')).toBe(true);
    expect(eventMocks.listeners.has('flash-ready-request')).toBe(true);
  });

  it('responds to flash-ready-request for a specific stream', async () => {
    render(<FlashPage />);
    await waitFor(() => {
      expect(eventMocks.listeners.has('flash-ready-request')).toBe(true);
    });
    eventMocks.emit.mockClear();

    eventMocks.listeners.get('flash-ready-request')?.({ payload: { streamId: 42 } });

    await waitFor(() => {
      expect(eventMocks.emit).toHaveBeenCalledWith('flash-ready', { streamId: 42 });
    });
  });
});
