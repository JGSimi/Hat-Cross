import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { FIREBASE_CONFIG } from '../config';

export const firebaseApp = initializeApp(FIREBASE_CONFIG);
export const firebaseAuth = getAuth(firebaseApp);

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
