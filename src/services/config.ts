// Central config for external services. Firebase web config is public on
// purpose (Google treats it as a client identifier, not a secret), and the
// Worker URL is the single source of truth for credit-based requests.

export const HAT_PROXY_URL = 'https://hat-proxy.joao02simi.workers.dev';

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBIMdnV9DFkFyfGiA83pzG67EJ2XZF1U94',
  authDomain: 'hat-cross.firebaseapp.com',
  projectId: 'hat-cross',
  appId: '1:958798309680:web:61c351ca9828daf8bd00f5',
};

// Custom URL scheme registered in tauri.conf.json → plugins.deep-link.desktop.schemes
export const OAUTH_REDIRECT_SCHEME = 'hat';
export const OAUTH_REDIRECT_PATH = 'auth/callback';
