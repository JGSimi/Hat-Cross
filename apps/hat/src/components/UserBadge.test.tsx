import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UserBadge } from './UserBadge';
import type { AuthSession } from '../bridge/auth';

const session: AuthSession = {
  uid: 'u1',
  displayName: 'João Simi',
  email: 'joao@x.com',
  photoURL: null,
};

describe('UserBadge', () => {
  it('assinante: anel data-tier=subscriber + selo', () => {
    render(<UserBadge session={session} tier="subscriber" onSignOut={vi.fn()} />);
    expect(document.querySelector('.hat-avatar')?.getAttribute('data-tier')).toBe('subscriber');
    expect(screen.getByTestId('tier-label')).toHaveTextContent('assinante');
  });

  it('trial mostra dias restantes', () => {
    render(<UserBadge session={session} tier="trial" trialDaysLeft={5} onSignOut={vi.fn()} />);
    expect(screen.getByTestId('tier-label')).toHaveTextContent('trial · 5d');
  });

  it('sem foto usa iniciais do nome', () => {
    render(<UserBadge session={session} tier="none" onSignOut={vi.fn()} />);
    expect(screen.getByText('JS')).toBeInTheDocument();
  });

  it('sair chama onSignOut', () => {
    const onSignOut = vi.fn();
    render(<UserBadge session={session} tier="subscriber" onSignOut={onSignOut} />);
    fireEvent.click(screen.getByText('sair'));
    expect(onSignOut).toHaveBeenCalledOnce();
  });
});
