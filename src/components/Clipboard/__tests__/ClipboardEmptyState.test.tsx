import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import {
  ClipboardZeroState,
  ClipboardNoResultsState,
} from '../ClipboardEmptyState';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>(
    'framer-motion',
  );
  return {
    ...actual,
    useReducedMotion: () => false,
  };
});

vi.mock('../../../hooks/usePlatform', () => ({
  usePlatform: () => 'macos',
}));

vi.mock('../../../stores/settingsStore', () => ({
  useSettingsStore: (selector: (s: unknown) => unknown) =>
    selector({ settings: { shortcuts: { clipboard: 'CommandOrControl+Shift+X' } } }),
}));

describe('ClipboardZeroState', () => {
  it('renders title + formatted shortcut', () => {
    render(<ClipboardZeroState />);
    expect(
      screen.getByRole('heading', { name: /Nenhum clipboard processado/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/⌘⇧X/)).toBeInTheDocument();
  });

  it('invokes onSuggestionClick when the CTA is pressed', async () => {
    const onSuggestionClick = vi.fn();
    const user = userEvent.setup();
    render(<ClipboardZeroState onSuggestionClick={onSuggestionClick} />);
    await user.click(screen.getByRole('button', { name: 'Abrir Chat' }));
    expect(onSuggestionClick).toHaveBeenCalledTimes(1);
  });

  it('passes axe (no CTA)', async () => {
    const { container } = render(<ClipboardZeroState />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('passes axe (with CTA)', async () => {
    const { container } = render(
      <ClipboardZeroState onSuggestionClick={() => {}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('ClipboardNoResultsState', () => {
  it('renders the query and clear-search CTA', async () => {
    const user = userEvent.setup();
    const onClearSearch = vi.fn();
    render(
      <ClipboardNoResultsState query="teste" onClearSearch={onClearSearch} />,
    );
    expect(screen.getByText(/teste/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Limpar busca' }));
    expect(onClearSearch).toHaveBeenCalledTimes(1);
  });

  it('passes axe', async () => {
    const { container } = render(
      <ClipboardNoResultsState query="teste" onClearSearch={() => {}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
