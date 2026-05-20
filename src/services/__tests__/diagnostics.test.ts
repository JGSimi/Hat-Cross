import { invoke } from '@tauri-apps/api/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isTauriRuntime: vi.fn(),
  getCurrentWindow: vi.fn(() => ({ label: 'main' })),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => Promise.resolve()),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: mocks.getCurrentWindow,
}));

vi.mock('../../utils/tauriRuntime', () => ({
  isTauriRuntime: mocks.isTauriRuntime,
}));

describe('diagnostics', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.isTauriRuntime.mockReturnValue(true);
    Object.defineProperty(window.navigator, 'platform', {
      configurable: true,
      value: 'MacIntel',
    });
  });

  it('persists diagnostic events on Windows instead of only writing to console', async () => {
    Object.defineProperty(window.navigator, 'platform', {
      configurable: true,
      value: 'Win32',
    });
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    const { logDiagnostic } = await import('../diagnostics');
    logDiagnostic('startup_settings_start', { source: 'test' });

    expect(invoke).toHaveBeenCalledWith(
      'diagnostic_log',
      expect.objectContaining({
        event: 'startup_settings_start',
        fields: expect.objectContaining({
          platform: 'Win32',
          source: 'test',
          windowLabel: 'main',
        }),
      }),
    );
    expect(consoleInfo).not.toHaveBeenCalled();

    consoleInfo.mockRestore();
  });

  it('keeps console diagnostics for browser runtime', async () => {
    mocks.isTauriRuntime.mockReturnValue(false);
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    const { logDiagnostic } = await import('../diagnostics');
    logDiagnostic('browser_event', {});

    expect(invoke).not.toHaveBeenCalled();
    expect(consoleInfo).toHaveBeenCalledWith('[diagnostic]', 'browser_event', expect.any(Object));

    consoleInfo.mockRestore();
  });
});
