// Vigia do status da conta (assinatura/trial). O hat-proxy não tem push de
// billing para o cliente, então o "tempo real" prático é: fetch imediato,
// polling periódico e refetch no instante em que a janela ganha foco — que é
// exatamente quando o usuário volta do portal Stripe após cancelar. É esse
// refetch que faz o app cortar o acesso "no mesmo momento".

import type { AccountStatus } from '../services/account';

/** Mínimo estrutural de window/document que o watch precisa (fakeável em teste). */
interface ListenerTarget {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

interface VisibilityTarget extends ListenerTarget {
  readonly visibilityState: DocumentVisibilityState;
}

export interface AccountWatchDeps {
  fetchStatus: () => Promise<AccountStatus>;
  onStatus: (status: AccountStatus) => void;
  /** Erros de rede NÃO derrubam o último status conhecido — só reportam. */
  onError?: (error: unknown) => void;
  /** Intervalo do polling (default 60s). */
  intervalMs?: number;
  /** Alvos de eventos injetáveis em teste. */
  windowRef?: ListenerTarget;
  documentRef?: VisibilityTarget;
}

const DEFAULT_INTERVAL_MS = 60_000;

/**
 * Inicia o watch e devolve o unsubscribe. Fetches nunca se sobrepõem
 * (um disparo enquanto outro voa é ignorado) e resultados após o stop
 * são descartados.
 */
export function startAccountWatch(deps: AccountWatchDeps): () => void {
  const win = deps.windowRef ?? window;
  const doc = deps.documentRef ?? document;
  let alive = true;
  let inFlight = false;

  async function refresh() {
    if (!alive || inFlight) return;
    inFlight = true;
    try {
      const status = await deps.fetchStatus();
      if (alive) deps.onStatus(status);
    } catch (error) {
      if (alive) deps.onError?.(error);
    } finally {
      inFlight = false;
    }
  }

  const onFocus = () => void refresh();
  const onVisibility = () => {
    if (doc.visibilityState === 'visible') void refresh();
  };

  void refresh();
  const timer = setInterval(() => void refresh(), deps.intervalMs ?? DEFAULT_INTERVAL_MS);
  win.addEventListener('focus', onFocus);
  doc.addEventListener('visibilitychange', onVisibility);

  return () => {
    alive = false;
    clearInterval(timer);
    win.removeEventListener('focus', onFocus);
    doc.removeEventListener('visibilitychange', onVisibility);
  };
}
