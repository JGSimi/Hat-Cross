import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  saveSettings: vi.fn(),
  saveEntries: vi.fn(),
  showToast: vi.fn(),
}));
const mockCheck = vi.mocked(check);
const mockRelaunch = vi.mocked(relaunch);

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => Promise.resolve()),
}));

vi.mock('../diagnostics', () => ({
  logDiagnostic: vi.fn(),
  withDiagnostic: vi.fn((_event: string, _fields: unknown, operation: () => Promise<unknown>) =>
    operation(),
  ),
}));

vi.mock('../../stores/settingsStore', () => ({
  useSettingsStore: {
    getState: () => ({
      saveSettings: hoisted.saveSettings,
      settings: {
        notifications: {
          enabled: true,
          showUpdateNotification: true,
        },
      },
    }),
  },
}));

vi.mock('../../stores/clipboardStore', () => ({
  useClipboardStore: {
    getState: () => ({
      saveEntries: hoisted.saveEntries,
    }),
  },
}));

vi.mock('../../stores/toastStore', () => ({
  useToastStore: {
    getState: () => ({
      showToast: hoisted.showToast,
    }),
  },
}));

type MockUpdate = Update & {
  downloadAndInstall: ReturnType<typeof vi.fn>;
};

function makeUpdate(version = '9.9.9'): MockUpdate {
  return {
    version,
    downloadAndInstall: vi.fn(() => Promise.resolve()),
  } as unknown as MockUpdate;
}

async function importAutoUpdater() {
  const mod = await import('../autoUpdater');
  mod.resetAutoUpdaterForTests();
  return mod;
}

describe('autoUpdater', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useRealTimers();
    hoisted.saveSettings.mockResolvedValue(undefined);
    hoisted.saveEntries.mockResolvedValue(undefined);
    mockRelaunch.mockResolvedValue(undefined);
  });

  it('returns uptodate when the updater has no release', async () => {
    mockCheck.mockResolvedValueOnce(null);
    const { checkForUpdates } = await importAutoUpdater();

    await expect(checkForUpdates('settings')).resolves.toEqual({ status: 'uptodate' });
    expect(mockCheck).toHaveBeenCalledTimes(1);
  });

  it('does not download or install during check, even when an update exists', async () => {
    const update = makeUpdate('9.9.9');
    mockCheck.mockResolvedValueOnce(update);
    const { checkForUpdates } = await importAutoUpdater();

    await expect(checkForUpdates('settings')).resolves.toEqual({
      status: 'available',
      version: '9.9.9',
    });
    expect(update.downloadAndInstall).not.toHaveBeenCalled();
  });

  it('single-flights concurrent update checks', async () => {
    let resolveCheck!: (value: Update | null) => void;
    mockCheck.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCheck = resolve;
      }),
    );
    const { checkForUpdates } = await importAutoUpdater();

    const first = checkForUpdates('settings');
    const second = checkForUpdates('tray');
    const update = makeUpdate('9.9.9');
    resolveCheck(update);

    await expect(first).resolves.toEqual({ status: 'available', version: '9.9.9' });
    await expect(second).resolves.toEqual({ status: 'available', version: '9.9.9' });
    expect(mockCheck).toHaveBeenCalledTimes(1);
  });

  it('flushes stores before explicit install and then relaunches', async () => {
    const update = makeUpdate('9.9.9');
    mockCheck.mockResolvedValueOnce(update);
    const { installAvailableUpdate } = await importAutoUpdater();

    await installAvailableUpdate('settings');

    expect(hoisted.saveSettings).toHaveBeenCalledTimes(1);
    expect(hoisted.saveEntries).toHaveBeenCalledTimes(1);
    expect(update.downloadAndInstall).toHaveBeenCalledTimes(1);
    expect(mockRelaunch).toHaveBeenCalledTimes(1);
  });

  it('background check announces availability but does not install automatically', async () => {
    vi.useFakeTimers();
    const update = makeUpdate('9.9.9');
    mockCheck.mockResolvedValueOnce(update);
    const { startAutoUpdater, stopAutoUpdater } = await importAutoUpdater();

    startAutoUpdater();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(hoisted.showToast).toHaveBeenCalledWith(
      'Nova versão (v9.9.9) disponível.',
      'info',
      expect.objectContaining({
        action: expect.objectContaining({ label: 'Instalar' }),
      }),
    );
    expect(update.downloadAndInstall).not.toHaveBeenCalled();
    stopAutoUpdater();
  });
});
