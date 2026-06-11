import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NativeBridge } from '../bridge/native';
import type { AuthPort } from '../bridge/auth';
import { startClipboardFlow } from '../controllers/clipboardFlow';
import { startCorrectionsFlow } from '../controllers/correctionsFlow';
import { startGabaritoFlow } from '../controllers/gabaritoFlow';
import { createTokenManager, type TokenManager } from '../domain/auth/tokenManager';
import { unreadCount } from '../domain/rooms/corrections';
import { useRoomStore } from '../stores/roomStore';
import { createRoomsClient, type RoomsClient } from '../services/rooms/client';
import { subscribeMyRooms, subscribeRoom } from '../services/rooms/realtime';
import { createAccountClient, trialDaysLeft, type AccountStatus } from '../services/account';
import { hatProxyBaseUrl, readAuthConfig } from '../services/auth/config';
import { RoomsPanel } from '../components/Rooms/RoomsPanel';
import { Paywall } from '../components/Paywall';
import { SettingsPanel } from '../components/SettingsPanel';
import { HatLogo } from '../components/HatLogo';
import { UserBadge } from '../components/UserBadge';
import { ProfilePanel } from '../components/ProfilePanel';

type MainView = 'rooms' | 'settings' | 'profile';

interface MainPageProps {
  bridge: NativeBridge;
  authPort?: AuthPort;
}

/**
 * Janela principal (pivot Salas+Flash, sem chat). Orquestra:
 * - auth + token (refresh proativo);
 * - cliente de salas real + listeners Firestore → roomStore;
 * - caminho quente do clipboard compartilhando com a sala ativa;
 * - correções da IA no Flash sob demanda + badge;
 * - paywall (trial / assinar / bloqueio).
 */
export function MainPage({ bridge, authPort }: MainPageProps) {
  const streamSeq = useRef(0);
  const [view, setView] = useState<MainView>('rooms');
  const [session, setSession] = useState(() => authPort?.currentSession() ?? null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountStatus | null>(null);

  const activeRoomId = useRoomStore((s) => s.activeRoomId);
  const notifications = useRoomStore((s) => s.notifications);
  const pendingCorrections = unreadCount(notifications);

  const firebaseConfig = useMemo(() => readAuthConfig()?.firebase ?? null, []);

  const tokenManager: TokenManager | null = useMemo(() => {
    if (!authPort) return null;
    return createTokenManager({ fetchToken: (force) => authPort.fetchIdToken(force) });
  }, [authPort]);

  const getIdToken = useCallback(
    () => (tokenManager ? tokenManager.getToken() : Promise.reject(new Error('auth:not-configured'))),
    [tokenManager],
  );

  // Sem sessão NÃO há cliente: evita tentar criar/entrar em sala deslogado
  // (getIdToken lançaria e a UI mostra "conecte sua conta").
  const roomsClient: RoomsClient | null = useMemo(() => {
    if (!tokenManager || !session) return null;
    return createRoomsClient({ baseUrl: hatProxyBaseUrl(), getIdToken });
  }, [tokenManager, session, getIdToken]);

  const accountClient = useMemo(() => {
    if (!tokenManager) return null;
    return createAccountClient({ baseUrl: hatProxyBaseUrl(), getIdToken });
  }, [tokenManager, getIdToken]);

  // Sessão Firebase
  useEffect(() => {
    if (!authPort) return;
    return authPort.onAuthChange(setSession);
  }, [authPort]);

  // Logout: sai da sala ativa, limpa o store e volta para a lista/estado
  // deslogado. (Os listeners realtime já desinscrevem por dependerem de session.)
  useEffect(() => {
    if (!session) {
      useRoomStore.getState().reset();
      setView('rooms');
      void bridge.gabaritoHide().catch(() => {});
    }
  }, [session, bridge]);

  // Status da conta (assinatura/trial) ao logar
  useEffect(() => {
    if (!session || !accountClient) {
      setAccount(null);
      return;
    }
    let alive = true;
    accountClient
      .fetchStatus()
      .then((s) => alive && setAccount(s))
      .catch(() => alive && setAccount(null));
    return () => {
      alive = false;
    };
  }, [session, accountClient]);

  // Caminho quente do clipboard → compartilha com a sala ativa
  useEffect(() => {
    return startClipboardFlow({
      bridge,
      getIdToken,
      newStreamId: () => (streamSeq.current += 1),
      newIdempotencyKey: () => crypto.randomUUID(),
      getRoomContext: () => {
        const id = useRoomStore.getState().activeRoomId;
        return id ? { roomId: id, roomShare: true } : null;
      },
      // Sem isto, o Flash fica preso em "Processando…" quando o stream nem
      // começa (ex.: não logado). Mostra a causa e deixa o auto-hide agir.
      onError: (e) => {
        console.warn('clipboardFlow:', e);
        const msg = e instanceof Error && /not-signed-in|not-configured/.test(e.message)
          ? 'Entre com sua conta (Google) no Hat para usar o Flash.'
          : 'Não consegui processar agora. Tente de novo.';
        void bridge.flashShowText(msg);
      },
    });
  }, [bridge, getIdToken]);

  // Correções da sala no Flash sob demanda (atalho dedicado)
  useEffect(() => {
    return startCorrectionsFlow({
      bridge,
      getNotifications: () => useRoomStore.getState().notifications,
      markRead: (id) => useRoomStore.getState().markNotificationRead(id),
      onError: (e) => console.warn('correctionsFlow:', e),
    });
  }, [bridge]);

  // Gabarito (respostas corrigidas) — toggle por atalho, abaixo do flash.
  useEffect(() => {
    return startGabaritoFlow({
      bridge,
      getRoomData: () => {
        const s = useRoomStore.getState();
        const roomId = s.activeRoomId;
        if (!roomId) return null;
        return {
          clusters: s.clusters[roomId] ?? [],
          entries: s.entries[roomId] ?? [],
          myUid: session?.uid ?? '',
        };
      },
      onError: (e) => console.warn('gabaritoFlow:', e),
    });
  }, [bridge, session]);

  // Lista de salas do usuário (realtime)
  useEffect(() => {
    if (!session || !firebaseConfig) return;
    return subscribeMyRooms(firebaseConfig, session.uid);
  }, [session, firebaseConfig]);

  // Realtime da sala ativa (entries + clusters + minhas correções)
  useEffect(() => {
    if (!session || !firebaseConfig || !activeRoomId) return;
    return subscribeRoom(firebaseConfig, activeRoomId, session.uid);
  }, [session, firebaseConfig, activeRoomId]);

  async function handleSignIn() {
    if (!authPort || authBusy) return;
    setAuthBusy(true);
    setAuthError(null);
    try {
      await authPort.signInWithGoogle();
    } catch (error) {
      setAuthError(
        error instanceof Error && /cancel|denied/i.test(error.message)
          ? 'Login cancelado.'
          : 'Não consegui entrar com o Google. Tente de novo.',
      );
    } finally {
      setAuthBusy(false);
    }
  }

  async function openCheckout() {
    if (!accountClient) return;
    try {
      const url = await accountClient.checkoutUrl();
      await bridge.openExternal(url);
    } catch (e) {
      console.warn('checkout:', e);
    }
  }

  async function openPortal() {
    if (!accountClient) return;
    try {
      const url = await accountClient.portalUrl();
      await bridge.openExternal(url);
    } catch (e) {
      console.warn('portal:', e);
    }
  }

  const entitled = account?.entitled ?? true; // otimista até carregar
  const daysLeft = trialDaysLeft(account?.trialEndsAt ?? null);
  const subscribed = account?.subscription?.status === 'active' || account?.subscription?.status === 'trialing';
  const tier = subscribed ? ('subscriber' as const) : daysLeft > 0 ? ('trial' as const) : ('none' as const);

  return (
    <div className="flex h-screen overflow-hidden bg-surface-base text-text-primary">
      <nav
        aria-label="Navegação principal"
        className="flex w-13 shrink-0 flex-col items-center border-0 border-r border-solid border-r-hairline py-4"
      >
        <HatLogo size={22} className="text-text-secondary" title="Hat" />
        <div className="mt-8 flex flex-col items-center gap-7">
          {(['rooms', 'settings'] as const).map((v) => {
            const active = view === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-current={active ? 'page' : undefined}
                className="cursor-pointer border-0 bg-transparent p-0 font-mono text-[9.5px] tracking-[0.28em] transition-colors duration-200"
                style={{
                  writingMode: 'vertical-rl',
                  color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  borderRight: active ? '1px solid var(--color-text-primary)' : '1px solid transparent',
                  paddingRight: 6,
                }}
              >
                {v === 'rooms' ? 'SALAS' : 'AJUSTES'}
              </button>
            );
          })}
        </div>
        {pendingCorrections > 0 && (
          <span
            data-testid="corrections-badge"
            title={`${pendingCorrections} correções — atalho ⌘⇧D`}
            className="hat-pulse mt-auto inline-flex size-5 items-center justify-center rounded-full font-mono text-[10px] tabular-nums text-white"
            style={{ background: 'var(--color-divergence)' }}
          >
            {pendingCorrections}
          </span>
        )}
      </nav>

      <main className="hat-atmosphere flex min-w-0 flex-1 flex-col overflow-hidden px-8 pt-3 pb-7">
        <div className="mb-2 flex h-8 shrink-0 items-center justify-end gap-3">
          {authError && (
            <span role="alert" className="text-[11px]" style={{ color: 'var(--color-divergence)' }}>
              {authError}
            </span>
          )}
          {!authPort ? (
            <span className="font-mono text-[10px] tracking-[0.12em] text-text-muted uppercase">
              sem credenciais — modo local
            </span>
          ) : session ? (
            <UserBadge
              session={session}
              tier={tier}
              trialDaysLeft={daysLeft}
              onOpenProfile={() => setView('profile')}
            />
          ) : (
            <button
              type="button"
              data-testid="sign-in"
              onClick={() => void handleSignIn()}
              disabled={authBusy}
              className="cursor-pointer border-0 bg-transparent p-0 font-mono text-[10px] tracking-[0.12em] text-text-secondary uppercase transition-colors duration-200 hover:text-text-primary disabled:cursor-default disabled:opacity-50"
            >
              {authBusy ? 'abrindo o google…' : 'entrar com google →'}
            </button>
          )}
        </div>

        <div key={view} className="hat-view-in min-h-0 flex-1 overflow-hidden">
          {view === 'profile' && session ? (
            <ProfilePanel
              session={session}
              account={account}
              tier={tier}
              onManageSubscription={() => void openPortal()}
              onSubscribe={() => void openCheckout()}
              onSignOut={() => {
                setView('rooms');
                void authPort?.signOut();
              }}
            />
          ) : view === 'settings' ? (
            <SettingsPanel bridge={bridge} />
          ) : session && !entitled ? (
            <Paywall trialEndsAt={account?.trialEndsAt ?? null} onSubscribe={() => void openCheckout()} />
          ) : (
            <RoomsPanel
              client={roomsClient}
              credits={null}
              myUid={session?.uid ?? null}
              authed={!!session}
            />
          )}
        </div>
      </main>
    </div>
  );
}
