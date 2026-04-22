import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import DisguiseClock from '../DisguiseClock';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>(
    'framer-motion',
  );
  return { ...actual };
});

// usePlatform reads navigator.platform — pin it per test block
const originalPlatform = Object.getOwnPropertyDescriptor(
  window.navigator,
  'platform',
);

function setPlatform(value: string) {
  Object.defineProperty(window.navigator, 'platform', {
    configurable: true,
    value,
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  // Pin wall clock so seconds don't drift between assertions
  vi.setSystemTime(new Date(2026, 3, 22, 14, 32, 5));
});

afterEach(() => {
  vi.useRealTimers();
  if (originalPlatform) {
    Object.defineProperty(window.navigator, 'platform', originalPlatform);
  }
});

describe('DisguiseClock (FP8 — OS-native)', () => {
  it('exposes role=button + aria-label "Relógio" (screen readers get only a clock)', () => {
    setPlatform('MacIntel');
    render(<DisguiseClock />);
    const btn = screen.getByRole('button', { name: 'Relógio' });
    expect(btn).toBeInTheDocument();
    // Never leak "Hat" / "assistant" / "chat" via a11y surface while disguised
    expect(btn.getAttribute('aria-label')).not.toMatch(/hat|chat|ai|assistant/i);
  });

  it('single-click does NOT reveal (C2 guard: avoid accidental reveal)', async () => {
    setPlatform('MacIntel');
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onReveal = vi.fn();
    render(<DisguiseClock onReveal={onReveal} />);
    await user.click(screen.getByRole('button', { name: 'Relógio' }));
    expect(onReveal).not.toHaveBeenCalled();
  });

  it('double-click reveals', async () => {
    setPlatform('MacIntel');
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onReveal = vi.fn();
    render(<DisguiseClock onReveal={onReveal} />);
    await user.dblClick(screen.getByRole('button', { name: 'Relógio' }));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it('Enter reveals when focused (keyboard a11y)', async () => {
    setPlatform('MacIntel');
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onReveal = vi.fn();
    render(<DisguiseClock onReveal={onReveal} />);
    const btn = screen.getByRole('button', { name: 'Relógio' });
    btn.focus();
    await user.keyboard('{Enter}');
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it('Space reveals when focused', async () => {
    setPlatform('MacIntel');
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onReveal = vi.fn();
    render(<DisguiseClock onReveal={onReveal} />);
    const btn = screen.getByRole('button', { name: 'Relógio' });
    btn.focus();
    await user.keyboard(' ');
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it('cursor stays default (no pointer affordance gives the disguise away)', () => {
    setPlatform('MacIntel');
    render(<DisguiseClock />);
    const btn = screen.getByRole('button', { name: 'Relógio' });
    expect(btn.getAttribute('style')).toContain('cursor: default');
    expect(btn.getAttribute('style')).not.toContain('cursor: pointer');
  });

  it('uses the macOS font stack on macos', () => {
    setPlatform('MacIntel');
    const { container } = render(<DisguiseClock />);
    const hourSpan = container.querySelectorAll('span')[0] as HTMLElement;
    expect(hourSpan.getAttribute('style')).toContain('SF Pro Display');
  });

  it('uses the Windows font stack on windows', () => {
    setPlatform('Win32');
    const { container } = render(<DisguiseClock />);
    const hourSpan = container.querySelectorAll('span')[0] as HTMLElement;
    expect(hourSpan.getAttribute('style')).toContain('Segoe UI Variable');
  });

  it('does NOT paint the time in accent color (disguise must look boring)', () => {
    setPlatform('MacIntel');
    const { container } = render(<DisguiseClock />);
    const hourSpan = container.querySelectorAll('span')[0] as HTMLElement;
    const style = hourSpan.getAttribute('style') || '';
    expect(style).toContain('var(--text-primary)');
    expect(style).not.toContain('var(--color-accent)');
  });

  it('passes axe', async () => {
    setPlatform('MacIntel');
    const { container } = render(<DisguiseClock />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
