// Gerência de token de ID com refresh PROATIVO — a peça que faltava no legado
// (streams morriam com 401 porque o token expirava no meio). Puro e testável:
// recebe um provedor de token cru (a porta Firebase) + um relógio injetável.
//
// Garantias:
// - cacheia o token até a janela de skew antes do vencimento;
// - dedupe de refreshes concorrentes (uma única chamada in-flight);
// - forceRefresh ignora o cache;
// - um refresh que falha não deixa promessa in-flight pendurada.

export interface RawToken {
  token: string;
  /** Epoch ms em que o token expira. */
  expiresAtMs: number;
}

export interface TokenManagerDeps {
  /** Busca um token novo do provedor (ex.: Firebase user.getIdTokenResult). */
  fetchToken: (forceRefresh: boolean) => Promise<RawToken>;
  /** Relógio injetável (default Date.now). */
  now?: () => number;
  /** Refresca este tanto de ms ANTES do vencimento. Default 5 min. */
  refreshSkewMs?: number;
}

export interface TokenManager {
  /** Token válido, refrescando proativamente se perto de vencer. */
  getToken: (forceRefresh?: boolean) => Promise<string>;
  /** Descarta o cache (ex.: após signOut). */
  clear: () => void;
}

const DEFAULT_SKEW_MS = 5 * 60 * 1000;

export function createTokenManager(deps: TokenManagerDeps): TokenManager {
  const now = deps.now ?? Date.now;
  const skewMs = deps.refreshSkewMs ?? DEFAULT_SKEW_MS;

  let cached: RawToken | null = null;
  let inFlight: Promise<RawToken> | null = null;

  function isFresh(token: RawToken): boolean {
    return now() + skewMs < token.expiresAtMs;
  }

  function refresh(forceRefresh: boolean): Promise<RawToken> {
    // Dedupe: refreshes concorrentes compartilham a mesma promessa.
    if (inFlight !== null) {
      return inFlight;
    }
    const promise = deps
      .fetchToken(forceRefresh)
      .then((token) => {
        cached = token;
        return token;
      })
      .finally(() => {
        inFlight = null;
      });
    inFlight = promise;
    return promise;
  }

  return {
    async getToken(forceRefresh = false): Promise<string> {
      if (!forceRefresh && cached !== null && isFresh(cached)) {
        return cached.token;
      }
      const token = await refresh(forceRefresh);
      return token.token;
    },
    clear(): void {
      cached = null;
    },
  };
}
