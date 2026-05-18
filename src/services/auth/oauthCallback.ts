export const WINDOWS_OAUTH_REDIRECT_URI = 'com.hat.app:/auth/callback';
export const WINDOWS_OAUTH_SCHEME = 'com.hat.app';

export type OAuthCallbackResult =
  | { type: 'success'; code: string; state: string }
  | { type: 'error'; error: string; state: string | null };

export function parseWindowsOAuthCallback(rawUrl: string): OAuthCallbackResult | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (url.protocol !== `${WINDOWS_OAUTH_SCHEME}:` || url.pathname !== '/auth/callback') {
    return null;
  }

  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  if (error) {
    return { type: 'error', error, state };
  }

  const code = url.searchParams.get('code');
  if (!code || !state) {
    return { type: 'error', error: 'Callback OAuth incompleto.', state };
  }

  return { type: 'success', code, state };
}

export function isWindowsRuntime(): boolean {
  const platform = navigator.platform.toLowerCase();
  const userAgent = navigator.userAgent.toLowerCase();
  const userAgentDataPlatform =
    'userAgentData' in navigator
      ? String((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? '').toLowerCase()
      : '';
  return `${platform} ${userAgent} ${userAgentDataPlatform}`.includes('win');
}
