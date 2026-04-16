// Central config for external services. All identifiers — even the Firebase
// Web API key, which Google explicitly documents as client-safe — are loaded
// from env vars so the repo doesn't trip GitHub secret-scanning and so every
// fork has to supply its own project values before running.

export const HAT_PROXY_URL = 'https://hat-proxy.joao02simi.workers.dev';

export const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

if (!FIREBASE_CONFIG.apiKey) {
  console.warn(
    '[config] VITE_FIREBASE_* env vars missing — sign-in will fail. See .env.example.',
  );
}

// Custom URL scheme registered in tauri.conf.json → plugins.deep-link.desktop.schemes
export const OAUTH_REDIRECT_SCHEME = 'hat';
export const OAUTH_REDIRECT_PATH = 'auth/callback';
