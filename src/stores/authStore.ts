import { create } from 'zustand';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { firebaseAuth, signOut as firebaseSignOut } from '../services/auth/firebase';
import {
  cancelGoogleSignIn,
  signInWithGoogle as runGoogleOAuth,
} from '../services/auth/googleOAuth';
import type { HatUser } from '../types/account';

interface AuthState {
  user: HatUser | null;
  isLoading: boolean;
  isHydrated: boolean;
  isSigningIn: boolean;
  signInError: string | null;
  signInWithGoogle: () => Promise<void>;
  cancelSignIn: () => void;
  signOut: () => Promise<void>;
}

let activeSignInAttempt = 0;

function toHatUser(user: User): HatUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isHydrated: false,
  isSigningIn: false,
  signInError: null,
  signInWithGoogle: async () => {
    const attempt = ++activeSignInAttempt;
    set({ isSigningIn: true, signInError: null });
    try {
      await runGoogleOAuth();
      // onAuthStateChanged populates `user` automatically.
    } catch (err) {
      if (attempt === activeSignInAttempt) {
        set({ signInError: err instanceof Error ? err.message : String(err) });
      }
      throw err;
    } finally {
      if (attempt === activeSignInAttempt) {
        set({ isSigningIn: false });
      }
    }
  },
  cancelSignIn: () => {
    activeSignInAttempt++;
    cancelGoogleSignIn();
    set({ isSigningIn: false, signInError: null });
  },
  signOut: async () => {
    await firebaseSignOut();
    // onAuthStateChanged clears `user` automatically — no need to setState here.
  },
}));

const authHydrationFallback = setTimeout(() => {
  const state = useAuthStore.getState();
  if (!state.isHydrated) {
    console.warn('[auth] Firebase auth hydration timed out; continuing signed out.');
    useAuthStore.setState({ user: null, isLoading: false, isHydrated: true });
  }
}, 8_000);

// Subscribe to Firebase auth state on module load. Fires once synchronously
// with the cached user (if any) and then on every sign-in / sign-out.
onAuthStateChanged(firebaseAuth, (user) => {
  clearTimeout(authHydrationFallback);
  useAuthStore.setState({
    user: user ? toHatUser(user) : null,
    isLoading: false,
    isHydrated: true,
  });
});
