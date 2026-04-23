import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import PopoverChat from '../PopoverChat';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>(
    'framer-motion',
  );
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

// ChatWindow drags in useChat + the whole AI/store tree — outside the scope
// of this unit test. The axe check is for the popover shell only.
vi.mock('../../Chat/ChatWindow', () => ({
  default: ({ compact }: { compact?: boolean }) => (
    <div data-testid="chat-window" data-compact={String(!!compact)} />
  ),
}));

describe('PopoverChat', () => {
  it('exposes a labeled "Voltar ao relógio" back button', () => {
    render(<PopoverChat onBack={() => {}} />);
    expect(
      screen.getByRole('button', { name: 'Voltar ao relógio' }),
    ).toBeInTheDocument();
  });

  it('renders ChatWindow in compact mode', () => {
    render(<PopoverChat onBack={() => {}} />);
    expect(screen.getByTestId('chat-window')).toHaveAttribute(
      'data-compact',
      'true',
    );
  });

  it('invokes onBack when the back button is clicked', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<PopoverChat onBack={onBack} />);
    await user.click(screen.getByRole('button', { name: 'Voltar ao relógio' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('passes axe', async () => {
    const { container } = render(<PopoverChat onBack={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
