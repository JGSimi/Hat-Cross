import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ThinkingBlock from '../ThinkingBlock';

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

describe('ThinkingBlock (I6 / M13 — preserve reading across stream end)', () => {
  it('defaults expanded=true even when isStreaming=false (post-stream remount case)', () => {
    // The bug: streaming placeholder unmounts and the finalized MessageBubble
    // mounts with isStreaming=false — which used to collapse the chain and
    // yank the content Rafa was reading mid-thought. Contract: always
    // default expanded=true so the finalize-remount is transparent.
    render(<ThinkingBlock thinking="Pensamento..." isStreaming={false} />);
    const button = screen.getByRole('button', { name: /cadeia de pensamento/i });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    // And the body region is present.
    expect(
      screen.getByRole('region', { name: 'Cadeia de pensamento' }),
    ).toBeInTheDocument();
  });

  it('defaults expanded=true during streaming too', () => {
    render(<ThinkingBlock thinking="partial" isStreaming={true} />);
    const button = screen.getByRole('button', { name: /cadeia de pensamento/i });
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('toggles to collapsed when the user clicks the header', async () => {
    const user = userEvent.setup();
    render(<ThinkingBlock thinking="oi" isStreaming={false} />);
    const button = screen.getByRole('button', { name: /cadeia de pensamento/i });
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('exposes aria-controls pointing at the body region', () => {
    render(<ThinkingBlock thinking="oi" />);
    const button = screen.getByRole('button', { name: /cadeia de pensamento/i });
    expect(button).toHaveAttribute('aria-controls', 'thinking-body');
    expect(document.getElementById('thinking-body')).not.toBeNull();
  });
});
