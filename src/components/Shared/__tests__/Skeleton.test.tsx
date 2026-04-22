import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import Skeleton from '../Skeleton';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>(
    'framer-motion',
  );
  return { ...actual, useReducedMotion: () => false };
});

describe('Skeleton primitive (EE9)', () => {
  it('renders with the declared height', () => {
    const { container } = render(<Skeleton height={34} width={120} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.height).toBe('34px');
    expect(el.style.width).toBe('120px');
  });

  it('accepts string CSS lengths too', () => {
    const { container } = render(<Skeleton height="1.5rem" width="60%" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.height).toBe('1.5rem');
    expect(el.style.width).toBe('60%');
  });

  it('is aria-hidden by default (decorative)', () => {
    const { container } = render(<Skeleton height={20} />);
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.getAttribute('role')).not.toBe('status');
  });

  it('becomes a labeled live region when ariaLabel is passed', () => {
    render(<Skeleton height={34} ariaLabel="Carregando saldo..." />);
    const el = screen.getByRole('status', { name: 'Carregando saldo...' });
    expect(el).toHaveAttribute('aria-busy', 'true');
    expect(el).not.toHaveAttribute('aria-hidden');
  });

  it('passes axe when decorative', async () => {
    const { container } = render(<Skeleton height={20} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('passes axe when labeled', async () => {
    const { container } = render(
      <Skeleton height={20} ariaLabel="Carregando" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('uses shimmer animation when reduced motion is NOT set', () => {
    const { container } = render(<Skeleton height={20} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.animation).toContain('shimmer');
  });
});
