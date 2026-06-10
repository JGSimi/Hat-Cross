// Adaptador Firebase concreto da AuthPort. Fluxo de login (desktop):
//
//   1. PKCE: state + verifier no cliente, challenge S256 na URL;
//   2. UM invoke Rust (`oauth_run_loopback_flow`): sobe listener loopback,
//      abre o consentimento do Google no browser do sistema, espera o
//      redirect, valida o state e devolve { code, redirectUri };
//   3. troca code→tokens direto no endpoint do Google (fluxo recomendado
//      para apps desktop; o client secret de "Desktop app" não é segredo);
//   4. signInWithCredential no Firebase (evita o problema de authorized
//      domain do tauri://localhost — lição do legado).
//
// fetchIdToken alimenta o TokenManager com token + expiração real
// (getIdTokenResult.expirationTime), habilitando o refresh proativo.

import {
  browserLocalPersistence,
  browserSessionPersistence,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  onAuthStateChanged,
  signInWithCredential,
  signOut as firebaseSignOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { invoke } from '@tauri-apps/api/core';

import type { AuthPort, AuthSession } from '../../bridge/auth';
import type { RawToken } from '../../domain/auth/tokenManager';
import type { AuthConfig } from './config';
import { getFirebaseApp } from '../firebase/app';
import { randomBase64Url, sha256Base64Url } from './pkce';

interface OAuthFlowResult {
  code: string;
  redirectUri: string;
}

function toSession(user: User): AuthSession {
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
  };
}

export function createFirebaseAuthPort(config: AuthConfig): AuthPort {
  const app = getFirebaseApp(config.firebase);
  // Persistência explícita: webviews Tauri ocasionalmente limpam estado entre
  // execuções sem esta lista (lição do legado). IndexedDB é o mais durável.
  const auth: Auth = initializeAuth(app, {
    persistence: [
      indexedDBLocalPersistence,
      browserLocalPersistence,
      browserSessionPersistence,
    ],
  });

  async function exchangeCodeForTokens(
    code: string,
    redirectUri: string,
    codeVerifier: string,
  ): Promise<{ idToken: string; accessToken?: string }> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }).toString(),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Troca de code por token falhou (${response.status}): ${text}`);
    }
    const tokens = (await response.json()) as {
      id_token?: string;
      access_token?: string;
    };
    if (!tokens.id_token) {
      throw new Error('Google não retornou id_token');
    }
    return { idToken: tokens.id_token, accessToken: tokens.access_token };
  }

  return {
    async signInWithGoogle(): Promise<AuthSession> {
      const state = randomBase64Url(16);
      const codeVerifier = randomBase64Url(32);
      const codeChallenge = await sha256Base64Url(codeVerifier);

      const flow = await invoke<OAuthFlowResult>('oauth_run_loopback_flow', {
        clientId: config.google.clientId,
        state,
        codeChallenge,
      });

      const { idToken, accessToken } = await exchangeCodeForTokens(
        flow.code,
        flow.redirectUri,
        codeVerifier,
      );

      const credential = GoogleAuthProvider.credential(idToken, accessToken);
      const userCredential = await signInWithCredential(auth, credential);
      return toSession(userCredential.user);
    },

    async signOut(): Promise<void> {
      await firebaseSignOut(auth);
    },

    async fetchIdToken(forceRefresh: boolean): Promise<RawToken> {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('auth:not-signed-in');
      }
      const result = await user.getIdTokenResult(forceRefresh);
      return {
        token: result.token,
        expiresAtMs: Date.parse(result.expirationTime),
      };
    },

    currentSession(): AuthSession | null {
      return auth.currentUser ? toSession(auth.currentUser) : null;
    },

    onAuthChange(handler): () => void {
      return onAuthStateChanged(auth, (user) => {
        handler(user ? toSession(user) : null);
      });
    },
  };
}
