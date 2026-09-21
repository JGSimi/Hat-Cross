import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProfilePanel, usageBarPct } from './ProfilePanel';
import type { AuthSession } from '../bridge/auth';
import type { AccountStatus } from '../services/account';

const session: AuthSession = {
  uid: 'u1',
  displayName: 'João Simi',
  email: 'joao@x.com',
  photoURL: null,
};

function account(over: Partial<AccountStatus> = {}): AccountStatus {
  return {
    uid: 'u1',
    email: 'joao@x.com',
    entitled: true,
    subscription: { status: 'active', plan: 'unlimited', currentPeriodEnd: 1781500000000 },
    trialEndsAt: null,
    creditsSpent: 1234,
    ...over,
  };
}

describe('usageBarPct', () => {
  it('nunca encosta no infinito (8%–82%) e cresce em log', () => {
    expect(usageBarPct(0)).toBe(4);
    expect(usageBarPct(10)).toBeGreaterThan(8);
    expect(usageBarPct(1_000_000)).toBeLessThanOrEqual(82);
    expect(usageBarPct(100)).toBeLessThan(usageBarPct(100_000));
  });
});

describe('ProfilePanel', () => {
  const noop = vi.fn();

  it('mostra saudação, uso e o símbolo ∞ no fim da barra', () => {
    render(
      <ProfilePanel
        session={session}
        account={account()}
        tier="subscriber"
        onManageSubscription={noop}
        onSubscribe={noop}
        onSignOut={noop}
        hour={21}
      />,
    );
    expect(screen.getByText(/Boa noite, João/)).toBeInTheDocument();
    expect(screen.getByText('1.234')).toBeInTheDocument();
    expect(screen.getByTestId('usage-infinity')).toHaveTextContent('∞');
    expect(screen.getByTestId('usage-fill')).toBeInTheDocument();
  });

  it('assinante: gerenciar assinatura chama o portal; sem CTA de assinar', () => {
    const onManage = vi.fn();
    render(
      <ProfilePanel
        session={session}
        account={account()}
        tier="subscriber"
        onManageSubscription={onManage}
        onSubscribe={noop}
        onSignOut={noop}
      />,
    );
    fireEvent.click(screen.getByTestId('manage-subscription'));
    expect(onManage).toHaveBeenCalledOnce();
    expect(screen.queryByTestId('subscribe-hero')).toBeNull();
  });

  it('não-assinante: hero premium com preço e assinar', () => {
    const onSubscribe = vi.fn();
    render(
      <ProfilePanel
        session={session}
        account={account({ subscription: { status: 'none', plan: null, currentPeriodEnd: null } })}
        tier="none"
        onManageSubscription={noop}
        onSubscribe={onSubscribe}
        onSignOut={noop}
      />,
    );
    expect(screen.getByTestId('subscribe-hero')).toHaveTextContent('R$50');
    fireEvent.click(screen.getByTestId('profile-subscribe'));
    expect(onSubscribe).toHaveBeenCalledOnce();
  });

  it('sair da conta vive no perfil', () => {
    const onSignOut = vi.fn();
    render(
      <ProfilePanel
        session={session}
        account={account()}
        tier="subscriber"
        onManageSubscription={noop}
        onSubscribe={noop}
        onSignOut={onSignOut}
      />,
    );
    fireEvent.click(screen.getByTestId('sign-out'));
    expect(onSignOut).toHaveBeenCalledOnce();
  });
});
