import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { firebaseAuth } from './firebase';

// Credentials for the Google OAuth 2.0 "Desktop app" client. The secret is
// shipped with the binary intentionally — Google explicitly supports this for
// desktop clients; it's only used for rate-limiting the token endpoint.
const CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string | undefined;
const CLIENT_SECRET = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_SECRET as string | undefined;

interface OAuthCallbackPayload {
  code: string;
  state: string;
}

// 128 bits of entropy is plenty for state and PKCE verifier.
function randomBase64Url(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return base64UrlEncode(buf);
}

function base64UrlEncode(buf: Uint8Array): string {
  let binary = '';
  for (const b of buf) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

// Full Google OAuth loopback flow with PKCE. Opens the consent page in the
// system browser, starts a one-shot HTTP server on a random local port to
// catch the redirect, exchanges the auth code for tokens, then hands the
// id_token to Firebase via signInWithCredential. Firebase's own listener
// (see authStore.ts) picks up the new user and updates app state.
export async function signInWithGoogle(): Promise<void> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error(
      'OAuth nao configurado. Preencha VITE_GOOGLE_OAUTH_CLIENT_ID e VITE_GOOGLE_OAUTH_CLIENT_SECRET em .env.local.',
    );
  }

  // Start the loopback listener and get the port the OS picked for us.
  const port = await invoke<number>('oauth_start_server');
  const redirectUri = `http://127.0.0.1:${port}/oauth/callback`;

  const state = randomBase64Url(16);
  const codeVerifier = randomBase64Url(32);
  const codeChallenge = await sha256Base64Url(codeVerifier);

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  // `prompt=select_account` forces Google to show the account picker even if
  // the user is already signed in, so they can switch accounts if they want.
  authUrl.searchParams.set('prompt', 'select_account');

  // Race the callback against a timeout. Whichever resolves first wins; the
  // other's listeners/timer are cleaned up in `finally`.
  const callbackPromise = waitForCallback(state);

  try {
    await invoke('open_external_url', { url: authUrl.toString() });
    const code = await callbackPromise;

    // Exchange the code for tokens. We hit the token endpoint directly from
    // the Worker-less client; this is the Google-recommended flow for desktop.
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      throw new Error(`Troca de code por token falhou (${tokenRes.status}): ${text}`);
    }

    const tokens = (await tokenRes.json()) as {
      id_token?: string;
      access_token?: string;
    };
    if (!tokens.id_token) {
      throw new Error('Google nao retornou id_token');
    }

    // Firebase accepts any id_token issued by a client in the same Google
    // Cloud project, so no extra allowlisting is needed beyond having the
    // Desktop client and the Firebase project share a project id.
    const credential = GoogleAuthProvider.credential(tokens.id_token, tokens.access_token);
    await signInWithCredential(firebaseAuth, credential);
    // onAuthStateChanged fires, authStore updates, UI re-renders. We're done.
  } finally {
    // Nothing to clean up here directly — waitForCallback handles its own
    // listener teardown. This try/finally is in place in case future code
    // allocates resources (e.g. a spinner state) that need to be released.
  }
}

function waitForCallback(expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let cbUnlisten: (() => void) | null = null;
    let errUnlisten: (() => void) | null = null;
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('OAuth timeout — tente novamente'));
    }, 5 * 60 * 1000);

    const cleanup = () => {
      clearTimeout(timer);
      cbUnlisten?.();
      errUnlisten?.();
    };

    listen<OAuthCallbackPayload>('oauth-callback', (event) => {
      if (event.payload.state !== expectedState) {
        cleanup();
        reject(new Error('State mismatch (possivel CSRF)'));
        return;
      }
      cleanup();
      resolve(event.payload.code);
    }).then((un) => {
      cbUnlisten = un;
    });

    listen<{ error: string }>('oauth-error', (event) => {
      cleanup();
      reject(new Error(event.payload.error));
    }).then((un) => {
      errUnlisten = un;
    });
  });
}
