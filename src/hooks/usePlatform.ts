export type Platform = 'macos' | 'windows' | 'linux';

export function usePlatform(): Platform {
  const p = navigator.platform.toLowerCase();
  const uaPlatform = navigator.userAgent.toLowerCase();
  const userAgentDataPlatform =
    'userAgentData' in navigator
      ? String((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? '').toLowerCase()
      : '';
  const probe = `${p} ${uaPlatform} ${userAgentDataPlatform}`;

  if (probe.includes('mac')) return 'macos';
  if (probe.includes('win')) return 'windows';
  return 'linux';
}
