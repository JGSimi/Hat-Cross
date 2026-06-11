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
  it('saudação por hora com primeiro nome (sem email, sem "assinante")', () => {
    render(
      <UserBadge session={session} tier="subscriber" onOpenProfile={vi.fn()} hour={21} />,
    );
    expect(screen.getByTestId('greeting')).toHaveTextContent('Boa noite, João');
    expect(screen.queryByText(/joao@x\.com/)).toBeNull();
    expect(screen.queryByText(/assinante/i)).toBeNull();
    expect(screen.queryByText(/^sair$/i)).toBeNull();
  });

  it('bom dia de manhã', () => {
    render(<UserBadge session={session} tier="none" onOpenProfile={vi.fn()} hour={9} />);
    expect(screen.getByTestId('greeting')).toHaveTextContent('Bom dia, João');
  });

  it('anel data-tier=subscriber no avatar', () => {
    render(<UserBadge session={session} tier="subscriber" onOpenProfile={vi.fn()} />);
    expect(screen.getByTestId('open-profile').getAttribute('data-tier')).toBe('subscriber');
  });

  it('trial mostra dias restantes', () => {
    render(
      <UserBadge session={session} tier="trial" trialDaysLeft={5} onOpenProfile={vi.fn()} />,
    );
    expect(screen.getByTestId('tier-label')).toHaveTextContent('trial · 5d');
  });

  it('clicar no avatar abre o perfil', () => {
    const onOpenProfile = vi.fn();
    render(<UserBadge session={session} tier="subscriber" onOpenProfile={onOpenProfile} />);
    fireEvent.click(screen.getByTestId('open-profile'));
    expect(onOpenProfile).toHaveBeenCalledOnce();
  });
});
