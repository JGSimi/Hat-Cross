import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import ClipboardCard from '../ClipboardCard';
import type { ClipboardEntry } from '../../../types';

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

function makeEntry(overrides: Partial<ClipboardEntry> = {}): ClipboardEntry {
  return {
    id: 'e1',
    originalText: 'Texto original copiado',
    response: 'Resposta da IA sobre o texto.',
    timestamp: new Date('2026-04-22T15:00:00').getTime(),
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    isPinned: false,
    ...overrides,
  };
}

function defaultProps(
  overrides: Partial<React.ComponentProps<typeof ClipboardCard>> = {},
) {
  return {
    entry: makeEntry(),
    index: 0,
    isFocused: false,
    isExpanded: false,
    confirmDelete: false,
    searchQuery: '',
    onToggleExpand: vi.fn(),
    onCopyResponse: vi.fn(),
    onCopyOriginal: vi.fn(),
    onOpenInChat: vi.fn(),
    onTogglePin: vi.fn(),
    onRequestDelete: vi.fn(),
    onContextMenu: vi.fn(),
    onFocus: vi.fn(),
    ...overrides,
  };
}

describe('ClipboardCard', () => {
  it('exposes the card as an <article> with a keyboard-focusable aria-label', () => {
    render(<ClipboardCard {...defaultProps()} />);
    // We removed role="button" from the outer article to fix nested-interactive
    // (the expanded footer hosts buttons). Keyboard support is preserved via
    // tabIndex + onKeyDown.
    const card = screen.getByRole('article', { name: /Clipboard de/i });
    expect(card).toHaveAttribute('tabindex', '0');
    expect(card.getAttribute('aria-label')).toMatch(/recolhido/i);
  });

  it('announces expand state in the accessible name when expanded', () => {
    render(<ClipboardCard {...defaultProps({ isExpanded: true })} />);
    const card = screen.getByRole('article', { name: /Clipboard de/i });
    expect(card.getAttribute('aria-label')).toMatch(/expandido/i);
  });

  it('announces pinned state in the accessible name', () => {
    render(
      <ClipboardCard
        {...defaultProps({ entry: makeEntry({ isPinned: true }) })}
      />,
    );
    expect(
      screen.getByRole('article', { name: /fixado/i }),
    ).toBeInTheDocument();
  });

  it('exposes labeled pin toggle with aria-pressed', () => {
    render(<ClipboardCard {...defaultProps()} />);
    const pin = screen.getByRole('button', { name: 'Fixar' });
    expect(pin).toHaveAttribute('aria-pressed', 'false');
  });

  it('passes axe (collapsed)', async () => {
    const { container } = render(<ClipboardCard {...defaultProps()} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('passes axe (expanded + pinned + confirmDelete)', async () => {
    const { container } = render(
      <ClipboardCard
        {...defaultProps({
          entry: makeEntry({ isPinned: true }),
          isExpanded: true,
          confirmDelete: true,
        })}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
