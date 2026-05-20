import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const appSrc = readFileSync(join(root, 'src/App.tsx'), 'utf-8');

describe('Windows startup contract', () => {
  it('does not short-circuit Windows into empty fallback stores', () => {
    expect(appSrc).toContain('canRunStartupHydration');
    expect(appSrc).not.toMatch(/if\s*\(\s*isWindowsDesktop\s*\)\s*{\s*const\s+{\s*settings\s*}/);
    expect(appSrc).not.toContain('onboardingCompleted: true');
    expect(appSrc).not.toContain('useAuthStore.setState({ user: null, isLoading: false, isHydrated: true });\n      return;');
  });

  it('keeps flash creation lazy instead of prewarming a hidden WebView during boot', () => {
    expect(appSrc).toContain("invoke('flash_ensure'");
    expect(appSrc).not.toMatch(/startup_updater_arm[\s\S]{0,500}flash_ensure/);
    expect(appSrc).toContain('flash-ready-request');
  });

  it('reactivates tray events while deferring dynamic tray mutation until boot is ready', () => {
    expect(appSrc).toContain('canListenTrayEvents');
    expect(appSrc).toContain('canRebuildTrayMenu');
    expect(appSrc).toContain('trayFailureCountRef');
    expect(appSrc).toContain('trayCircuitOpenUntilRef');
    expect(appSrc).toContain('TRAY_CIRCUIT_OPEN_MS');
  });
});
