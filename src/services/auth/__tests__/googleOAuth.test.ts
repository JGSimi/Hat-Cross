import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { openUrl } from '@tauri-apps/plugin-opener';
import { signInWithPopup } from 'firebase/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockInvoke = vi.mocked(invoke);
const mockListen = vi.mocked(listen);
const mockOpenUrl = vi.mocked(openUrl);

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => {
    throw new Error('Tauri invoke should not run in browser OAuth');
  }),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn(),
}));

vi.mock('../../diagnostics', () => ({
  logDiagnostic: vi.fn(),
  withDiagnostic: vi.fn((_event: string, _fields: unknown, operation: () => Promise<unknown>) =>
    operation(),
  ),
}));

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {
    addScope = vi.fn();
    setCustomParameters = vi.fn();

    static credential = vi.fn();
  },
  signInWithCredential: vi.fn(),
  signInWithPopup: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../firebase', () => ({
  firebaseAuth: {},
}));

describe('signInWithGoogle', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('VITE_GOOGLE_OAUTH_CLIENT_ID', 'test-client-id');
    vi.stubEnv('VITE_GOOGLE_OAUTH_CLIENT_SECRET', 'test-client-secret');
    Object.defineProperty(window.navigator, 'platform', {
      configurable: true,
      value: 'MacIntel',
    });
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

    mockInvoke.mockImplementation((command: string) => {
      if (command === 'oauth_start_server') return Promise.resolve(49152);
      if (command === 'open_external_url') {
        const currentCall = mockInvoke.mock.calls[mockInvoke.mock.calls.length - 1];
        const openerArgs = currentCall?.[1] as { url?: string } | undefined;
        const parsed = new URL(String(openerArgs?.url));
        oauthState = parsed.searchParams.get('state');
        expect(parsed.searchParams.get('redirect_uri')).toBe(
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
      expect.objectContaining({ url: expect.stringContaining('accounts.google.com') }),
    );
    expect(mockOpenUrl).not.toHaveBeenCalled();
  });

  it('falls back to the native opener if the Tauri opener plugin fails', async () => {
    let oauthState: string | null = null;
    let oauthCallbackHandler: ((event: { payload: { code: string; state: string | null } }) => void) | null =
      null;

    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {
      invoke: vi.fn(),
    };

    mockOpenUrl.mockRejectedValueOnce(new Error('opener unavailable'));
    mockInvoke.mockImplementation((command: string) => {
      if (command === 'oauth_start_server') return Promise.resolve(49152);
      if (command === 'open_external_url') {
        const currentCall = mockInvoke.mock.calls[mockInvoke.mock.calls.length - 1];
        const fallbackArgs = currentCall?.[1] as { url?: string } | undefined;
        const fallbackUrl = new URL(String(fallbackArgs?.url));
        oauthState = fallbackUrl.searchParams.get('state');
        expect(fallbackUrl.searchParams.get('redirect_uri')).toBe(
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

    expect(mockOpenUrl).toHaveBeenCalledWith(expect.any(URL));
    expect(mockInvoke).toHaveBeenCalledWith(
      'open_external_url',
      expect.objectContaining({ url: expect.stringContaining('accounts.google.com') }),
    );
  });

  it('rejects instead of spinning forever when the browser opener never resolves', async () => {
    vi.useFakeTimers();
    Object.defineProperty(window.navigator, 'platform', {
      configurable: true,
      value: 'Win32',
    });
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {
      invoke: vi.fn(),
    };

    mockInvoke.mockImplementation((command: string) => {
      if (command === 'oauth_start_server') return Promise.resolve(49152);
      if (command === 'open_external_url') return new Promise(() => undefined);
      return Promise.reject(new Error(`Unexpected invoke: ${command}`));
    });
    mockOpenUrl.mockReturnValue(new Promise(() => undefined) as ReturnType<typeof openUrl>);
    mockListen.mockResolvedValue(vi.fn(() => undefined));

    const { signInWithGoogle } = await import('../googleOAuth');
    const promise = signInWithGoogle();
    const rejection = expect(promise).rejects.toThrow('Não consegui abrir o navegador do Google.');

    for (let i = 0; i < 20; i += 1) {
      if (mockInvoke.mock.calls.some(([command]) => command === 'open_external_url')) break;
      await vi.advanceTimersByTimeAsync(0);
      await Promise.resolve();
    }
    expect(mockInvoke.mock.calls.some(([command]) => command === 'open_external_url')).toBe(true);
    await vi.advanceTimersByTimeAsync(60_003);
    await rejection;
    vi.useRealTimers();
  });

  it('rejects when the loopback callback emits an OAuth error', async () => {
    let oauthErrorHandler: ((event: { payload: { error: string } }) => void) | null = null;

    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {
      invoke: vi.fn(),
    };
    Object.defineProperty(window.navigator, 'platform', {
      configurable: true,
      value: 'Win32',
    });

    mockInvoke.mockImplementation((command: string) => {
      if (command === 'oauth_start_server') return Promise.resolve(49152);
      if (command === 'open_external_url') {
        queueMicrotask(() => {
          oauthErrorHandler?.({ payload: { error: 'access_denied' } });
        });
        return Promise.resolve();
      }
      return Promise.reject(new Error(`Unexpected invoke: ${command}`));
    });

    mockListen.mockImplementation(async (event, handler) => {
      if (event === 'oauth-error') {
        oauthErrorHandler = handler as typeof oauthErrorHandler;
      }
      return vi.fn(() => undefined);
    });

    const { signInWithGoogle } = await import('../googleOAuth');

    await expect(signInWithGoogle()).rejects.toThrow('access_denied');
  });
});
