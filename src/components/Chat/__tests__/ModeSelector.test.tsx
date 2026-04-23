import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import ModeSelector from '../ModeSelector';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>(
    'framer-motion',
  );
  return {
    ...actual,
    useReducedMotion: () => false,
  };
});

const setSelectedMode = vi.fn();

vi.mock('../../../stores/creditsStore', () => ({
  useCreditsStore: (selector: (s: unknown) => unknown) =>
    selector({ selectedMode: 'hat', setSelectedMode }),
}));

describe('ModeSelector (AI mode tabstrip)', () => {
  it('exposes a labelled radiogroup with two radios', () => {
    render(<ModeSelector />);
    const group = screen.getByRole('radiogroup', { name: /Modelo de IA/i });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('marks the active mode with aria-checked=true', () => {
    render(<ModeSelector />);
    const [hat, pro] = screen.getAllByRole('radio');
    expect(hat).toHaveAttribute('aria-checked', 'true');
    expect(pro).toHaveAttribute('aria-checked', 'false');
  });

  it('invokes setSelectedMode on click', async () => {
    const user = userEvent.setup();
    render(<ModeSelector />);
    const [, pro] = screen.getAllByRole('radio');
    await user.click(pro);
    expect(setSelectedMode).toHaveBeenCalledWith('hat-pro');
  });

  it('passes axe', async () => {
    const { container } = render(<ModeSelector />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
