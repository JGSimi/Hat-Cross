import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cancelGoogleSignIn: vi.fn(),
  firebaseAuth: {
    currentUser: null as null | {
      uid: string;
      email: string | null;
      displayName: string | null;
      photoURL: string | null;
    },
  },
  runGoogleOAuth: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../../services/auth/googleOAuth', () => ({
  cancelGoogleSignIn: mocks.cancelGoogleSignIn,
  signInWithGoogle: mocks.runGoogleOAuth,
}));

vi.mock('../../services/auth/firebase', () => ({
  firebaseAuth: mocks.firebaseAuth,
  signOut: mocks.signOut,
}));

vi.mock('../../services/diagnostics', () => ({
  logDiagnostic: vi.fn(),
  withDiagnostic: vi.fn((_event: string, _fields: unknown, operation: () => Promise<unknown>) =>
    operation(),
  ),
}));

describe('authStore', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.firebaseAuth.currentUser = null;
    mocks.runGoogleOAuth.mockResolvedValue(undefined);
  });

  it('applies the user returned by Google sign-in', async () => {
    mocks.runGoogleOAuth.mockResolvedValue({
      uid: 'user-1',
      email: 'user@example.com',
      displayName: 'Test User',
      photoURL: 'https://example.com/avatar.png',
    });

    const { useAuthStore } = await import('../authStore');

    await useAuthStore.getState().signInWithGoogle();

    expect(useAuthStore.getState().user).toEqual({
      uid: 'user-1',
      email: 'user@example.com',
      displayName: 'Test User',
      photoURL: 'https://example.com/avatar.png',
    });
    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(useAuthStore.getState().isHydrated).toBe(true);
    expect(useAuthStore.getState().isSigningIn).toBe(false);
  });

  it('falls back to Firebase currentUser when the OAuth helper returns no user', async () => {
    mocks.firebaseAuth.currentUser = {
      uid: 'user-2',
      email: 'fallback@example.com',
      displayName: 'Fallback User',
      photoURL: null,
    };

    const { useAuthStore } = await import('../authStore');

    await useAuthStore.getState().signInWithGoogle();

    expect(useAuthStore.getState().user).toEqual({
      uid: 'user-2',
      email: 'fallback@example.com',
      displayName: 'Fallback User',
      photoURL: null,
    });
  });
});
