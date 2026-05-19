import { create } from 'zustand';
import type { User } from 'firebase/auth';
import type { HatUser } from '../types/account';
import { logDiagnostic, withDiagnostic } from '../services/diagnostics';

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
let authBootstrapped = false;
let authHydrationFallback: ReturnType<typeof setTimeout> | null = null;
let cancelGoogleSignInCached: (() => void) | null = null;

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
    logDiagnostic('signIn_clicked', { attempt });
    set({ isSigningIn: true, signInError: null });
    try {
      const {
        cancelGoogleSignIn,
        signInWithGoogle: runGoogleOAuth,
      } = await import('../services/auth/googleOAuth');
      cancelGoogleSignInCached = cancelGoogleSignIn;
      await withDiagnostic('signIn_google_flow', { attempt }, runGoogleOAuth);
      logDiagnostic('signIn_google_flow_done', { attempt });
      // onAuthStateChanged populates `user` automatically.
    } catch (err) {
      logDiagnostic('signIn_google_flow_visible_error', {
        attempt,
        error: err instanceof Error ? err.message : String(err),
      });
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
    cancelGoogleSignInCached?.();
    logDiagnostic('signIn_cancel_clicked', { attempt: activeSignInAttempt });
    set({ isSigningIn: false, signInError: null });
  },
  signOut: async () => {
    const { signOut: firebaseSignOut } = await import('../services/auth/firebase');
    await firebaseSignOut();
    // onAuthStateChanged clears `user` automatically — no need to setState here.
  },
}));

export async function bootstrapAuth(): Promise<void> {
  if (authBootstrapped) return;
  authBootstrapped = true;
  logDiagnostic('auth_bootstrap_start', {});

  authHydrationFallback = setTimeout(() => {
    const state = useAuthStore.getState();
    if (!state.isHydrated) {
      console.warn('[auth] Firebase auth hydration timed out; continuing signed out.');
      logDiagnostic('auth_bootstrap_timeout', {});
      useAuthStore.setState({ user: null, isLoading: false, isHydrated: true });
    }
  }, 8_000);

  try {
    const [{ onAuthStateChanged }, { firebaseAuth }] = await Promise.all([
      import('firebase/auth'),
      import('../services/auth/firebase'),
    ]);

    onAuthStateChanged(firebaseAuth, (user) => {
      if (authHydrationFallback) {
        clearTimeout(authHydrationFallback);
        authHydrationFallback = null;
      }
      logDiagnostic('auth_state_changed', {
        signedIn: Boolean(user),
        uidPresent: Boolean(user?.uid),
        emailPresent: Boolean(user?.email),
      });
      useAuthStore.setState({
        user: user ? toHatUser(user) : null,
        isLoading: false,
        isHydrated: true,
      });
    });
  } catch (error) {
    console.error('[auth] Firebase auth bootstrap failed:', error);
    logDiagnostic('auth_bootstrap_error', {
      error: error instanceof Error ? error.message : String(error),
    });
    if (authHydrationFallback) {
      clearTimeout(authHydrationFallback);
      authHydrationFallback = null;
    }
    useAuthStore.setState({ user: null, isLoading: false, isHydrated: true });
  }
}
