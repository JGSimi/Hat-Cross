// Configuração de auth lida do ambiente Vite (.env.local, gitignored).
// Retorna null quando incompleta — o App então não injeta o AuthPort e o
// app roda em modo sem-conta (flash falha com auth:not-configured).

export interface AuthConfig {
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    appId: string;
  };
  google: {
    clientId: string;
    clientSecret: string;
  };
}

/** Base do hat-proxy (Worker). Override por VITE_HAT_PROXY_BASE_URL. */
export function hatProxyBaseUrl(
  env: Record<string, string | undefined> = import.meta.env,
): string {
  return (
    env['VITE_HAT_PROXY_BASE_URL'] ?? 'https://hat-proxy.joao02simi.workers.dev'
  ).replace(/\/+$/, '');
}

export function readAuthConfig(env: Record<string, string | undefined> = import.meta.env): AuthConfig | null {
  const apiKey = env['VITE_FIREBASE_API_KEY'];
  const authDomain = env['VITE_FIREBASE_AUTH_DOMAIN'];
  const projectId = env['VITE_FIREBASE_PROJECT_ID'];
  const appId = env['VITE_FIREBASE_APP_ID'];
  const clientId = env['VITE_GOOGLE_OAUTH_CLIENT_ID'];
  const clientSecret = env['VITE_GOOGLE_OAUTH_CLIENT_SECRET'];

  if (!apiKey || !authDomain || !projectId || !appId || !clientId || !clientSecret) {
    return null;
  }
  return {
    firebase: { apiKey, authDomain, projectId, appId },
    google: { clientId, clientSecret },
  };
}
