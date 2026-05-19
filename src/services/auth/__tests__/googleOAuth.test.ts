import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { signInWithPopup } from 'firebase/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockInvoke = vi.mocked(invoke);
const mockListen = vi.mocked(listen);

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => {
    throw new Error('Tauri invoke should not run in browser OAuth');
  }),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {
    addScope = vi.fn();
    setCustomParameters = vi.fn();

    static credential = vi.fn();
  },
  signInWithCredential: vi.fn(() => Promise.resolve({})),
  signInWithPopup: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../firebase', () => ({
  firebaseAuth: {},
}));

describe('signInWithGoogle', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('VITE_GOOGLE_OAUTH_CLIENT_ID', 'test-client-id');
    vi.stubEnv('VITE_GOOGLE_OAUTH_CLIENT_SECRET', 'test-client-secret');
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it('uses Firebase popup auth in the browser without calling Tauri invoke', async () => {
    const { signInWithGoogle } = await import('../googleOAuth');

    await signInWithGoogle();

    expect(signInWithPopup).toHaveBeenCalledTimes(1);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('uses the loopback callback flow inside the Tauri desktop runtime, including Windows', async () => {
    let oauthState: string | null = null;
    let oauthCallbackHandler: ((event: { payload: { code: string; state: string | null } }) => void) | null =
      null;

    Object.defineProperty(window.navigator, 'platform', {
      configurable: true,
      value: 'Win32',
    });
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {
      invoke: vi.fn(),
    };

    mockInvoke.mockImplementation((command: string, args?: unknown) => {
      if (command === 'oauth_start_server') return Promise.resolve(49152);
      if (command === 'open_external_url') {
        const url = new URL((args as { url: string }).url);
        oauthState = url.searchParams.get('state');
        expect(url.searchParams.get('redirect_uri')).toBe(
          'http://127.0.0.1:49152/oauth/callback',
        );
        queueMicrotask(() => {
          oauthCallbackHandler?.({
            payload: {
              code: 'oauth-code',
              state: oauthState,
            },
          });
        });
        return Promise.resolve();
      }
      return Promise.reject(new Error(`Unexpected invoke: ${command}`));
    });

    mockListen.mockImplementation(async (event, handler) => {
      if (event === 'oauth-callback') {
        oauthCallbackHandler = handler as typeof oauthCallbackHandler;
      }
      return vi.fn(() => undefined);
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ id_token: 'id-token', access_token: 'access-token' }),
      })),
    );

    const { signInWithGoogle } = await import('../googleOAuth');

    await signInWithGoogle();

    expect(mockInvoke).toHaveBeenCalledWith('oauth_start_server');
    expect(mockInvoke).toHaveBeenCalledWith(
      'open_external_url',
      expect.objectContaining({ url: expect.stringContaining('http%3A%2F%2F127.0.0.1') }),
    );
  });
});
