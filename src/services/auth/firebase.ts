import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  browserPopupRedirectResolver,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { FIREBASE_CONFIG } from '../config';

export const firebaseApp = initializeApp(FIREBASE_CONFIG);

// Persist the session across Tauri restarts. IndexedDB is the most durable
// option (survives cache clears the OS might issue on WKWebView/WebView2),
// with localStorage as fallback and session as last resort for edge cases
// where neither is writable. Without this explicit list, Tauri webviews
// occasionally wipe auth state between launches.
export const firebaseAuth = initializeAuth(firebaseApp, {
  persistence: [
    indexedDBLocalPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
  ],
  popupRedirectResolver: browserPopupRedirectResolver,
});

export async function signOut(): Promise<void> {
  await firebaseSignOut(firebaseAuth);
}

// Grab a fresh ID token for Worker calls. Returns null when not signed in.
// Firebase caches tokens for ~55min and auto-refreshes under the hood, so
// callers don't need to wire up refresh logic manually.
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const user = firebaseAuth.currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

export type { User };
