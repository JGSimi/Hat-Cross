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

export const firebaseReady = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId);
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
  creditsSpent?: number;
  unlockedThemes?: string[];
}

export async function signInWithGoogle(): Promise<User> {
  if (!firebaseAuth) throw new Error('firebase env missing');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(firebaseAuth, provider);
  const token = await result.user.getIdToken();
  await hat.session.setIDToken(token);
  return result.user;
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
