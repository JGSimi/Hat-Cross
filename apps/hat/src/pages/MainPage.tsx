import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import type { NativeBridge } from '../bridge/native';
import type { AuthPort } from '../bridge/auth';
import { startAccountWatch } from '../controllers/accountWatch';
import { startClipboardFlow } from '../controllers/clipboardFlow';
import { createTokenManager, type TokenManager } from '../domain/auth/tokenManager';
import { createAccountClient, trialDaysLeft, type AccountStatus } from '../services/account';
import { hatProxyBaseUrl } from '../services/auth/config';
import { firstNameOf } from '../domain/greeting';
import { HatHome } from '../components/HatHome';
import { ProfilePanel } from '../components/ProfilePanel';
import { Paywall } from '../components/Paywall';
import { Farewell } from '../components/Farewell';

interface MainPageProps {
  bridge: NativeBridge;
  authPort?: AuthPort;
}

/**
 * Janela principal — redesign simples (Figma "a risca"): a tela HatHome
 * (mascote + atalho + opacidade + cor + update). Salas saíram do produto.
 * Ainda orquestra: auth + token (refresh proativo), status da conta
 * (trial/assinatura) e o caminho quente do clipboard → Flash. Perfil vive
 * atrás do avatar no canto.
 */
export function MainPage({ bridge, authPort }: MainPageProps) {
  const streamSeq = useRef(0);
  // Mensagem de corte do Flash (assinatura cancelada / trial encerrado).
  const blockedFlashMsg = useRef<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [session, setSession] = useState(() => authPort?.currentSession() ?? null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountStatus | null>(null);

  const tokenManager: TokenManager | null = useMemo(() => {
    if (!authPort) return null;
    return createTokenManager({ fetchToken: (force) => authPort.fetchIdToken(force) });
  }, [authPort]);

  const getIdToken = useCallback(
    () => (tokenManager ? tokenManager.getToken() : Promise.reject(new Error('auth:not-configured'))),
    [tokenManager],
  );

  const accountClient = useMemo(() => {
    if (!tokenManager) return null;
    return createAccountClient({ baseUrl: hatProxyBaseUrl(), getIdToken });
  }, [tokenManager, getIdToken]);

  // Sessão Firebase
  useEffect(() => {
    if (!authPort) return;
    return authPort.onAuthChange(setSession);
  }, [authPort]);

  // Logout: volta para a home.
  useEffect(() => {
    if (!session) setShowProfile(false);
  }, [session]);

  // Status da conta (assinatura/trial): watch contínuo — corta o Flash no
  // instante em que um cancelamento entra. Erros de rede mantêm o último status.
  useEffect(() => {
    if (!session || !accountClient) {
      setAccount(null);
      return;
    }
    return startAccountWatch({
      fetchStatus: () => accountClient.fetchStatus(),
      onStatus: setAccount,
      onError: (e) => console.warn('accountWatch:', e),
    });
  }, [session, accountClient]);

  // Caminho quente do clipboard → Flash (sem salas: nunca compartilha).
  useEffect(() => {
    return startClipboardFlow({
      bridge,
      getIdToken,
      newStreamId: () => (streamSeq.current += 1),
      newIdempotencyKey: () => crypto.randomUUID(),
      getBlockedMessage: () => blockedFlashMsg.current,
      onError: (e) => {
        console.warn('clipboardFlow:', e);
        const msg = e instanceof Error && /not-signed-in|not-configured/.test(e.message)
          ? 'Entre com sua conta (Google) no Hat para usar o Flash.'
          : 'Não consegui processar agora. Tente de novo.';
        void bridge.flashShowText(msg);
      },
    });
  }, [bridge, getIdToken]);

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
    setAuthError(null);
    if (!session && authPort) {
      void openGoogleLogin();
      return;
    }
    if (!accountClient) {
      setAuthError('Entre com sua conta Google para assinar.');
      if (authPort) void openGoogleLogin();
      return;
    }
    try {
      const url = await accountClient.checkoutUrl();
      if (!url) throw new Error('Checkout indisponível.');
      try {
        await bridge.openExternal(url);
      } catch {
        if (typeof window !== 'undefined') window.open(url, '_blank');
      }
    } catch (e) {
      console.warn('checkout error:', e);
      setAuthError(e instanceof Error ? e.message : 'Erro ao abrir o checkout.');
    }
  }

  async function openPortal() {
    setAuthError(null);
    if (!accountClient) {
      setAuthError('Entre com sua conta Google para gerenciar sua assinatura.');
      return;
    }
    try {
      const url = await accountClient.portalUrl();
      if (!url) throw new Error('Portal indisponível.');
      try {
        await bridge.openExternal(url);
      } catch {
        if (typeof window !== 'undefined') window.open(url, '_blank');
      }
    } catch (e) {
      console.warn('portal error:', e);
      setAuthError(e instanceof Error ? e.message : 'Erro ao abrir o portal.');
    }
  }

  const entitled = account?.entitled ?? true; // otimista até carregar
  const daysLeft = trialDaysLeft(account?.trialEndsAt ?? null);
  const subscribed = account?.subscription?.status === 'active' || account?.subscription?.status === 'trialing';
  const tier = subscribed ? ('subscriber' as const) : daysLeft > 0 ? ('trial' as const) : ('none' as const);
  const canceled = !!account && !entitled && account.subscription?.status === 'canceled';
  blockedFlashMsg.current =
    session && account && !entitled
      ? canceled
        ? 'Sua assinatura terminou — foi bom ter você. Assine de novo no Hat para voltar.'
        : 'Seu acesso terminou. Assine no Hat para continuar.'
      : null;

  const photo = session?.photoURL ?? null;
  const initial = (session?.displayName || session?.email || '?').slice(0, 1).toUpperCase();

  // Avatar/entrada no canto superior esquerdo da home.
  const profileSlot = !authPort ? null : session ? (
    <button
      type="button"
      data-testid="open-profile"
      onClick={() => setShowProfile(true)}
      title="Seu perfil"
      className="hat-avatar size-9 cursor-pointer border-0 bg-transparent p-0"
      data-tier={tier}
    >
      {photo ? (
        <img src={photo} alt="" referrerPolicy="no-referrer" className="size-9 rounded-full object-cover" />
      ) : (
        <span className="grid size-9 place-items-center rounded-full font-mono text-[13px]" style={{ background: '#3d3d3d', color: '#f4f4f2' }}>
          {initial}
        </span>
      )}
    </button>
  ) : (
    <button
      type="button"
      data-testid="sign-in"
      onClick={() => void handleSignIn()}
      disabled={authBusy}
      className="cursor-pointer rounded-full border-0 px-3 py-1.5 font-mono text-[10px] tracking-[0.12em] uppercase disabled:opacity-50"
      style={{ background: '#3d3d3d', color: '#f4f4f2' }}
    >
      {authBusy ? 'abrindo…' : 'entrar'}
    </button>
  );

  // Gate de assinatura: conta sem acesso vê a despedida (cancelou) ou o paywall
  // (nunca assinou / trial vencido) no lugar da home. O Flash já é bloqueado à
  // parte por blockedFlashMsg. Perfil abre por cima via avatar.
  const screenKey =
    showProfile && session ? 'profile' : session && !entitled && canceled ? 'farewell' : session && !entitled ? 'paywall' : 'home';

  const screenNode =
    screenKey === 'profile' && session ? (
      <div className="flex h-full flex-col overflow-hidden px-8 pt-4 pb-6">
        <button
          type="button"
          data-testid="close-profile"
          onClick={() => setShowProfile(false)}
          className="mb-4 shrink-0 cursor-pointer self-start border-0 bg-transparent p-0 font-mono text-[10px] tracking-[0.12em] uppercase"
          style={{ color: '#a8a8a3' }}
        >
          ← voltar
        </button>
        <div className="min-h-0 flex-1 overflow-hidden">
          <ProfilePanel
            session={session}
            account={account}
            tier={tier}
            onManageSubscription={() => void openPortal()}
            onSubscribe={() => void openCheckout()}
            onSignOut={() => {
              setShowProfile(false);
              void authPort?.signOut();
            }}
          />
        </div>
      </div>
    ) : screenKey === 'farewell' && session ? (
      <Farewell name={firstNameOf(session.displayName, session.email)} onResubscribe={() => void openCheckout()} />
    ) : screenKey === 'paywall' ? (
      <Paywall trialEndsAt={account?.trialEndsAt ?? null} onSubscribe={() => void openCheckout()} />
    ) : (
      <HatHome bridge={bridge} />
    );

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative h-screen overflow-hidden" style={{ background: '#141414' }}>
        {authError && (
          <span role="alert" className="absolute left-1/2 top-2 z-30 -translate-x-1/2 text-[11px]" style={{ color: '#ff453a' }}>
            {authError}
          </span>
        )}
        {/* Avatar/entrada — overlay global (some no perfil, que tem "← voltar"). */}
        {profileSlot && screenKey !== 'profile' && <div className="absolute left-4 top-4 z-20">{profileSlot}</div>}

        <AnimatePresence mode="wait">
          <motion.div
            key={screenKey}
            className="absolute inset-0"
            initial={{ opacity: 0, y: 12, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            style={{ background: '#141414', color: '#f4f4f2' }}
          >
            {screenNode}
          </motion.div>
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
