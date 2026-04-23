import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import ClipboardToolbar from '../ClipboardToolbar';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>(
    'framer-motion',
  );
  return {
    ...actual,
    useReducedMotion: () => false,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

function defaultProps(overrides: Partial<React.ComponentProps<typeof ClipboardToolbar>> = {}) {
  return {
    onBack: vi.fn(),
    totalCount: 5,
    filteredCount: 5,
    searchValue: '',
    onSearchChange: vi.fn(),
    sortMode: 'recent' as const,
    onSortChange: vi.fn(),
    hasEntries: true,
    onClearAll: vi.fn(),
    confirmClear: false,
    ...overrides,
  };
}

describe('ClipboardToolbar', () => {
  it('exposes a labeled search input', () => {
    render(<ClipboardToolbar {...defaultProps()} />);
    expect(
      screen.getByRole('textbox', { name: 'Buscar no histórico de clipboard' }),
    ).toBeInTheDocument();
  });

  it('renders a labeled back button when onBack is provided', () => {
    render(<ClipboardToolbar {...defaultProps()} />);
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeInTheDocument();
  });

  it('renders the sort dropdown with aria-expanded state', async () => {
    const user = userEvent.setup();
    render(<ClipboardToolbar {...defaultProps()} />);
    const sortBtn = screen.getByRole('button', { name: 'Ordenar' });
    expect(sortBtn).toHaveAttribute('aria-expanded', 'false');
    expect(sortBtn).toHaveAttribute('aria-haspopup', 'menu');
    await user.click(sortBtn);
    expect(sortBtn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('passes axe (default, no query)', async () => {
    const { container } = render(<ClipboardToolbar {...defaultProps()} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('passes axe (with query + confirmClear)', async () => {
    const { container } = render(
      <ClipboardToolbar
        {...defaultProps({
          searchValue: 'teste',
          filteredCount: 1,
          confirmClear: true,
        })}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
