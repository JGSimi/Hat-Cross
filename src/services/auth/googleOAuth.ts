import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { firebaseAuth } from './firebase';
import { abortErrorMessage, withTimeout } from '../../utils/async';

// Credentials for the Google OAuth 2.0 "Desktop app" client. The secret is
// shipped with the binary intentionally — Google explicitly supports this for
// desktop clients; it's only used for rate-limiting the token endpoint.
const CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string | undefined;
const CLIENT_SECRET = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_SECRET as string | undefined;

interface OAuthCallbackPayload {
  code: string;
  state: string;
}

const OAUTH_CALLBACK_TIMEOUT_MS = 30_000;
const OAUTH_STEP_TIMEOUT_MS = 20_000;
const OAUTH_SERVER_START_TIMEOUT_MS = 45_000;
let activeController: AbortController | null = null;

export function cancelGoogleSignIn(): void {
  activeController?.abort();
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
      'OAuth não configurado. Preencha VITE_GOOGLE_OAUTH_CLIENT_ID e VITE_GOOGLE_OAUTH_CLIENT_SECRET em .env.local.',
    );
  }

  activeController?.abort();
  const controller = new AbortController();
  activeController = controller;

  // Start the loopback listener and get the port the OS picked for us.
  console.info('[oauth] server_starting');
  const port = await withAbortableStep(
    invoke<number>('oauth_start_server'),
    controller.signal,
    'Servidor OAuth demorou para iniciar.',
    OAUTH_SERVER_START_TIMEOUT_MS,
  );
  console.info('[oauth] server_started');
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

  // Register listeners before opening the browser. On fast Windows/WebView2
  // machines, opening first can let the native callback win the race and leave
  // the UI stuck in "Abrindo..." until timeout.
  const { codePromise: callbackPromise } = await prepareCallbackListener(state, controller.signal);
  callbackPromise.catch(() => {});

  try {
    console.info('[oauth] browser_opening');
    await withAbortableStep(
      invoke('open_external_url', { url: authUrl.toString() }),
      controller.signal,
      'Não consegui abrir o navegador do Google.',
    );
    console.info('[oauth] browser_opened');
    const code = await callbackPromise;
    console.info('[oauth] callback_received');

    // Exchange the code for tokens. We hit the token endpoint directly from
    // the Worker-less client; this is the Google-recommended flow for desktop.
    const tokenController = new AbortController();
    const abortTokenFetch = () => tokenController.abort();
    controller.signal.addEventListener('abort', abortTokenFetch, { once: true });
    const tokenRes = await withTimeout(
      fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: tokenController.signal,
        body: new URLSearchParams({
          code,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: codeVerifier,
        }).toString(),
      }),
      OAUTH_STEP_TIMEOUT_MS,
      'Google demorou para trocar o código de login.',
    ).finally(() => {
      controller.signal.removeEventListener('abort', abortTokenFetch);
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
      throw new Error('Google não retornou id_token');
    }
    console.info('[oauth] token_exchanged');

    // Firebase accepts any id_token issued by a client in the same Google
    // Cloud project, so no extra allowlisting is needed beyond having the
    // Desktop client and the Firebase project share a project id.
    const credential = GoogleAuthProvider.credential(tokens.id_token, tokens.access_token);
    await withAbortableStep(
      signInWithCredential(firebaseAuth, credential),
      controller.signal,
      'Firebase demorou para concluir o login.',
    );
    console.info('[oauth] firebase_signed_in');
    // onAuthStateChanged fires, authStore updates, UI re-renders. We're done.
  } catch (error) {
    controller.abort();
    throw new Error(abortErrorMessage(error, 'Login com Google cancelado.'));
  } finally {
    if (activeController === controller) {
      activeController = null;
    }
  }
}

async function withAbortableStep<T>(
  promise: Promise<T>,
  signal: AbortSignal,
  timeoutMessage: string,
  timeoutMs = OAUTH_STEP_TIMEOUT_MS,
): Promise<T> {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

  return await Promise.race([
    withTimeout(promise, timeoutMs, timeoutMessage),
    new Promise<never>((_, reject) => {
      signal.addEventListener(
        'abort',
        () => reject(new DOMException('Aborted', 'AbortError')),
        { once: true },
      );
    }),
  ]);
}

async function prepareCallbackListener(
  expectedState: string,
  signal: AbortSignal,
): Promise<{ codePromise: Promise<string> }> {
  let cbUnlisten: (() => void) | null = null;
  let errUnlisten: (() => void) | null = null;

  const cleanup = () => {
    cbUnlisten?.();
    errUnlisten?.();
  };

  let resolveCode!: (code: string) => void;
  let rejectCode!: (error: unknown) => void;
  const codePromise = new Promise<string>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });

  const onAbort = () => rejectCode(new DOMException('Aborted', 'AbortError'));
  signal.addEventListener('abort', onAbort, { once: true });

  try {
    [cbUnlisten, errUnlisten] = await Promise.all([
      listen<OAuthCallbackPayload>('oauth-callback', (event) => {
        if (event.payload.state !== expectedState) {
          rejectCode(new Error('State mismatch (possível CSRF)'));
          return;
        }
        resolveCode(event.payload.code);
      }),
      listen<{ error: string }>('oauth-error', (event) => {
        rejectCode(new Error(event.payload.error));
      }),
    ]);
  } catch (error) {
    cleanup();
    signal.removeEventListener('abort', onAbort);
    throw error;
  }

  return {
    codePromise: withTimeout(
    codePromise,
    OAUTH_CALLBACK_TIMEOUT_MS,
    'Google não respondeu em 30s. Confirme se o browser abriu e tente de novo.',
  ).finally(() => {
    signal.removeEventListener('abort', onAbort);
    cleanup();
  }),
  };
}
