// Integração do corte de assinatura: conta cancelada chega pelo watch
// (refetch no foco) → Farewell na hora + Flash bloqueado com despedida.
// Realtime do Firestore é mockado (o .env.local tem credenciais reais).

import { render, screen, fireEvent, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockBridge, type MockBridge } from '../bridge/mock';
import type { AuthPort, AuthSession } from '../bridge/auth';
import type { AccountStatus } from '../services/account';
import { MainPage } from './MainPage';

const session: AuthSession = {
  uid: 'u1',
  displayName: 'João Simi',
  email: 'joao@x.com',
  photoURL: null,
};

function fakeAuthPort(): AuthPort {
  return {
    signInWithGoogle: () => Promise.resolve(session),
    signOut: () => Promise.resolve(),
    fetchIdToken: () =>
      Promise.resolve({ token: 'tok', expiresAtMs: Date.now() + 3_600_000 }),
    currentSession: () => session,
    onAuthChange: () => () => {},
  };
}

function accountStatus(over: Partial<AccountStatus> = {}): AccountStatus {
  return {
    uid: 'u1',
    email: 'joao@x.com',
    entitled: true,
    subscription: { status: 'active', plan: 'unlimited', currentPeriodEnd: null },
    trialEndsAt: null,
    creditsSpent: 10,
    ...over,
  };
}

const CANCELED = accountStatus({
  entitled: false,
  subscription: { status: 'canceled', plan: null, currentPeriodEnd: null },
});

let bridge: MockBridge;
/** O stub de fetch devolve sempre o status atual desta variável. */
let currentAccount: AccountStatus;

beforeEach(() => {
  bridge = createMockBridge();
  currentAccount = accountStatus();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(currentAccount) }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function flushWatch() {
  // o watch faz fetch assíncrono; espera o estado assentar
  await act(() => Promise.resolve());
  await act(() => Promise.resolve());
}

describe('MainPage — cancelamento de assinatura em tempo real', () => {
  it('assinante ativo vê a home normalmente', async () => {
    render(<MainPage bridge={bridge} authPort={fakeAuthPort()} />);
    await flushWatch();
    expect(screen.getByTestId('shortcut-capture')).toBeInTheDocument();
    expect(screen.queryByTestId('farewell')).toBeNull();
  });

  it('cancelou no portal e voltou ao app: foco refaz o fetch e a despedida aparece na hora', async () => {
    render(<MainPage bridge={bridge} authPort={fakeAuthPort()} />);
    await flushWatch();
    expect(screen.queryByTestId('farewell')).toBeNull();

    currentAccount = CANCELED;
    fireEvent(window, new Event('focus'));
    await flushWatch();

    expect(screen.getByTestId('farewell')).toHaveTextContent('Foi bom ter você, João.');
    expect(screen.queryByTestId('shortcut-capture')).toBeNull();
    expect(screen.queryByTestId('paywall')).toBeNull();
  });

  it('com a conta cancelada, o Flash mostra a despedida e não inicia stream', async () => {
    currentAccount = CANCELED;
    render(<MainPage bridge={bridge} authPort={fakeAuthPort()} />);
    await flushWatch();

    act(() => {
      bridge.emit('clipboard:captured', { kind: 'text', text: 'pergunta' });
    });
    await vi.waitFor(() => {
      const flash = bridge.calls.find((c) => c.method === 'flashShowText');
      expect(String(flash?.args[0])).toMatch(/assinatura terminou/);
    });
    expect(bridge.calls.some((c) => c.method === 'startStream')).toBe(false);
  });

  it('trial encerrado (nunca assinou) continua vendo o paywall, não a despedida', async () => {
    currentAccount = accountStatus({
      entitled: false,
      subscription: { status: 'none', plan: null, currentPeriodEnd: null },
      trialEndsAt: Date.now() - 1000,
    });
    render(<MainPage bridge={bridge} authPort={fakeAuthPort()} />);
    await flushWatch();

    expect(screen.getByTestId('paywall')).toBeInTheDocument();
    expect(screen.queryByTestId('farewell')).toBeNull();
  });
});
