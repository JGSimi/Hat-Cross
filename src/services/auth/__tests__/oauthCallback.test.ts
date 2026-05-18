import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseWindowsOAuthCallback,
  isWindowsRuntime,
  WINDOWS_OAUTH_REDIRECT_URI,
} from '../oauthCallback';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseWindowsOAuthCallback', () => {
  it('extracts code and state from the Hat Windows callback scheme', () => {
    expect(parseWindowsOAuthCallback(`${WINDOWS_OAUTH_REDIRECT_URI}?code=abc&state=xyz`)).toEqual({
      type: 'success',
      code: 'abc',
      state: 'xyz',
    });
  });

  it('returns oauth errors with state', () => {
    expect(
      parseWindowsOAuthCallback(`${WINDOWS_OAUTH_REDIRECT_URI}?error=access_denied&state=xyz`),
    ).toEqual({
      type: 'error',
      error: 'access_denied',
      state: 'xyz',
    });
  });

  it('ignores unrelated schemes and paths', () => {
    expect(parseWindowsOAuthCallback('hat:/auth/callback?code=abc&state=xyz')).toBeNull();
    expect(parseWindowsOAuthCallback('com.hat.app:/other?code=abc&state=xyz')).toBeNull();
  });
});

describe('isWindowsRuntime', () => {
  it('detects Windows from platform signals', () => {
    vi.stubGlobal('navigator', {
      platform: 'Win32',
      userAgent: 'Mozilla/5.0',
    });

    expect(isWindowsRuntime()).toBe(true);
  });

  it('does not detect macOS as Windows', () => {
    vi.stubGlobal('navigator', {
      platform: 'MacIntel',
      userAgent: 'Mozilla/5.0',
    });

    expect(isWindowsRuntime()).toBe(false);
  });
});
