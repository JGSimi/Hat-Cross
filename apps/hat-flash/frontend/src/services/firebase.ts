import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  type Auth,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  browserSessionPersistence,
  indexedDBLocalPersistence,
  initializeAuth,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getFirestore, onSnapshot } from 'firebase/firestore';
import { hat } from '../bridge/hat';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

const googleOAuthConfig = {
  clientId: import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string | undefined,
  clientSecret: import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_SECRET as string | undefined,
};

const OAUTH_CALLBACK_TIMEOUT_MS = 120_000;
const OAUTH_STEP_TIMEOUT_MS = 20_000;

export const firebaseReady = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId);
export const googleOAuthReady = Boolean(googleOAuthConfig.clientId && googleOAuthConfig.clientSecret);
export const firebaseApp = firebaseReady ? initializeApp(firebaseConfig) : null;
export const firebaseAuth: Auth | null = firebaseApp
  ? initializeAuth(firebaseApp, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    })
  : null;
export const firestore = firebaseApp ? getFirestore(firebaseApp) : null;

export interface HatUserDoc {
  credits?: number;
  creditLots?: unknown[];
  creditsSpent?: number;
  unlockedThemes?: string[];
}

export interface CreditValidityInfo {
  credits: number;
  nextCreditExpiresAt: number | null;
  creditsExpiringNext: number;
  hasLegacyBalanceWithoutLots: boolean;
}

interface ActiveCreditLot {
  remaining: number;
  expiresAt: number;
}

function readMillis(value: unknown): number | null {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const time = Date.parse(value);
    return Number.isNaN(time) ? null : time;
  }
  if (typeof value === 'object') {
    const maybeTimestamp = value as { toMillis?: () => number; seconds?: number; _seconds?: number };
    if (typeof maybeTimestamp.toMillis === 'function') return maybeTimestamp.toMillis();
    if (typeof maybeTimestamp.seconds === 'number') return maybeTimestamp.seconds * 1000;
    if (typeof maybeTimestamp._seconds === 'number') return maybeTimestamp._seconds * 1000;
  }
  return null;
}

export function summarizeCredits(doc: HatUserDoc): CreditValidityInfo {
  const storedCredits = typeof doc.credits === 'number' ? doc.credits : 0;
  const lots = Array.isArray(doc.creditLots) ? doc.creditLots : [];
  if (lots.length === 0) {
    return {
      credits: storedCredits,
      nextCreditExpiresAt: null,
      creditsExpiringNext: 0,
      hasLegacyBalanceWithoutLots: storedCredits > 0,
    };
  }

  const now = Date.now();
  const activeLots = lots.reduce<ActiveCreditLot[]>((acc, raw) => {
    if (!raw || typeof raw !== 'object') return acc;
    const lot = raw as Record<string, unknown>;
    const remaining = typeof lot.remaining === 'number' ? Math.trunc(lot.remaining) : 0;
    const expiresAt = readMillis(lot.expiresAt);
    if (remaining > 0 && expiresAt !== null && expiresAt > now) {
      acc.push({ remaining, expiresAt });
    }
    return acc;
  }, []);

  activeLots.sort((a, b) => a.expiresAt - b.expiresAt);
  const credits = activeLots.reduce((sum, lot) => sum + lot.remaining, 0);
  const nextCreditExpiresAt = activeLots[0]?.expiresAt ?? null;
  const creditsExpiringNext =
    nextCreditExpiresAt === null
      ? 0
      : activeLots.reduce(
          (sum, lot) => (lot.expiresAt === nextCreditExpiresAt ? sum + lot.remaining : sum),
          0,
        );

  return {
    credits,
    nextCreditExpiresAt,
    creditsExpiringNext,
    hasLegacyBalanceWithoutLots: false,
  };
}

export async function signInWithGoogle(): Promise<User> {
  if (!firebaseAuth) throw new Error('firebase env missing');
  if (shouldUseLoopbackOAuth()) {
    return signInWithGoogleLoopback();
  }

  return signInWithGooglePopup();
}

function shouldUseLoopbackOAuth() {
  const wails = (window as unknown as { _wails?: { environment?: { OS?: string } } })._wails;
  return Boolean(wails?.environment?.OS);
}

async function signInWithGooglePopup(): Promise<User> {
  if (!firebaseAuth) throw new Error('firebase env missing');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await withTimeout(
    signInWithPopup(firebaseAuth, provider),
    OAUTH_CALLBACK_TIMEOUT_MS,
    'Google nao respondeu. Confirme se o popup abriu e tente de novo.',
  );
  const token = await result.user.getIdToken();
  await hat.session.setIDToken(token);
  return result.user;
}

async function signInWithGoogleLoopback(): Promise<User> {
  if (!firebaseAuth) throw new Error('firebase env missing');
  if (!googleOAuthConfig.clientId || !googleOAuthConfig.clientSecret) {
    throw new Error('Google OAuth desktop env missing');
  }

  const state = randomBase64Url(16);
  const codeVerifier = randomBase64Url(32);
  const codeChallenge = await sha256Base64Url(codeVerifier);
  const flow = await withTimeout(
    hat.auth.runGoogleLoopbackFlow(googleOAuthConfig.clientId, state, codeChallenge),
    OAUTH_CALLBACK_TIMEOUT_MS + 10_000,
    'Google nao respondeu. Confirme se o navegador abriu e tente de novo.',
  );

  const tokenRes = await withTimeout(
    fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: flow.code,
        client_id: googleOAuthConfig.clientId,
        client_secret: googleOAuthConfig.clientSecret,
        redirect_uri: flow.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }).toString(),
    }),
    OAUTH_STEP_TIMEOUT_MS,
    'Google demorou para trocar o codigo de login.',
  );

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Troca de codigo por token falhou (${tokenRes.status}): ${text}`);
  }

  const tokens = (await tokenRes.json()) as {
    id_token?: string;
    access_token?: string;
  };
  if (!tokens.id_token) {
    throw new Error('Google nao retornou id_token');
  }

  const credential = GoogleAuthProvider.credential(tokens.id_token, tokens.access_token);
  const result = await withTimeout(
    signInWithCredential(firebaseAuth, credential),
    OAUTH_STEP_TIMEOUT_MS,
    'Firebase demorou para concluir o login.',
  );
  const token = await result.user.getIdToken();
  await hat.session.setIDToken(token);
  return result.user;
}

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

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutID: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutID = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutID !== undefined) {
      window.clearTimeout(timeoutID);
    }
  }
}

export async function signOutGoogle() {
  if (!firebaseAuth) return;
  await signOut(firebaseAuth);
  await hat.session.clear();
}

export function watchAuth(onUser: (user: User | null) => void) {
  if (!firebaseAuth) {
    onUser(null);
    return () => undefined;
  }
  return onAuthStateChanged(firebaseAuth, async (user) => {
    if (user) {
      const token = await user.getIdToken();
      await hat.session.setIDToken(token);
    }
    onUser(user);
  });
}

export function watchCredits(uid: string, onDoc: (doc: HatUserDoc) => void) {
  if (!firestore) {
    onDoc({});
    return () => undefined;
  }
  return onSnapshot(doc(firestore, 'users', uid), (snapshot) => {
    onDoc((snapshot.data() ?? {}) as HatUserDoc);
  });
}
