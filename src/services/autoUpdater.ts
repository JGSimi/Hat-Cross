import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../stores/settingsStore';
import { useClipboardStore } from '../stores/clipboardStore';
import { useToastStore } from '../stores/toastStore';
import { withTimeout } from '../utils/async';
import { logDiagnostic, withDiagnostic } from './diagnostics';

export type UpdateSource = 'background' | 'settings' | 'tray';
export type UpdateCheckResult =
  | { status: 'uptodate' }
  | { status: 'available'; version: string };

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const INITIAL_DELAY_MS = 30 * 1000;
const TOAST_TTL_MS = 60 * 60 * 1000;
const UPDATE_CHECK_TIMEOUT_MS = 20_000;
const UPDATE_INSTALL_TIMEOUT_MS = 5 * 60_000;

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let initialTimer: ReturnType<typeof setTimeout> | null = null;
let pendingUpdate: Update | null = null;
let checkPromise: Promise<UpdateCheckResult> | null = null;
let installPromise: Promise<void> | null = null;

async function flushBeforeInstall(source: UpdateSource): Promise<void> {
  if (isWindowsDesktopRuntime()) return;
  await withDiagnostic('update_flush_before_install', { source }, async () => {
    await Promise.all([
      withTimeout(
        useSettingsStore.getState().saveSettings(),
        5_000,
        'settings save timed out before update',
      ),
      withTimeout(
        useClipboardStore.getState().saveEntries(),
        5_000,
        'clipboard save timed out before update',
      ),
    ]);
  });
}

function isWindowsDesktopRuntime(): boolean {
  return typeof navigator !== 'undefined' && /win/i.test(navigator.platform);
}

function announceAvailable(version: string): void {
  const { showToast } = useToastStore.getState();
  const { settings } = useSettingsStore.getState();

  showToast(`Nova versão (v${version}) disponível.`, 'info', {
    duration: TOAST_TTL_MS,
    action: {
      label: 'Instalar',
      onClick: () => {
        installAvailableUpdate('background').catch(() => {});
      },
    },
  });

  if (
    settings.notifications.enabled &&
    settings.notifications.showUpdateNotification
  ) {
    invoke('send_notification', {
      title: `Hat v${version} disponível`,
      body: 'Abra o app e clique em Instalar para aplicar.',
    }).catch((error) => {
      logDiagnostic('update_notification_error', {
        source: 'background',
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }
}

async function performCheck(source: UpdateSource): Promise<UpdateCheckResult> {
  if (pendingUpdate) {
    return { status: 'available', version: pendingUpdate.version };
  }

  const update = await withDiagnostic('update_check', { source }, async () => {
    return await withTimeout(check(), UPDATE_CHECK_TIMEOUT_MS, 'Update check timed out');
  });

  if (!update) {
    logDiagnostic('update_uptodate', { source });
    return { status: 'uptodate' };
  }

  pendingUpdate = update;
  logDiagnostic('update_available', { source, version: update.version });
  return { status: 'available', version: update.version };
}

export async function checkForUpdates(source: UpdateSource): Promise<UpdateCheckResult> {
  if (checkPromise) {
    logDiagnostic('update_check_joined', { source });
    return checkPromise;
  }

  checkPromise = performCheck(source).finally(() => {
    checkPromise = null;
  });
  return checkPromise;
}

export async function installAvailableUpdate(
  source: UpdateSource,
  onProgress?: Parameters<Update['downloadAndInstall']>[0],
): Promise<void> {
  if (installPromise) {
    logDiagnostic('update_install_joined', { source });
    return installPromise;
  }

  installPromise = (async () => {
    const result = await checkForUpdates(source);
    if (result.status !== 'available' || !pendingUpdate) {
      logDiagnostic('update_install_skipped_no_update', { source });
      return;
    }

    await flushBeforeInstall(source);
    await withDiagnostic(
      'update_download_install',
      { source, version: pendingUpdate.version },
      async () => {
        await withTimeout(
          pendingUpdate!.downloadAndInstall(onProgress),
          UPDATE_INSTALL_TIMEOUT_MS,
          'Update install timed out',
        );
      },
    );
    await relaunch();
  })().catch((error) => {
    logDiagnostic('update_install_error_visible', {
      source,
      error: error instanceof Error ? error.message : String(error),
    });
    useToastStore.getState().showToast(
      `Erro ao aplicar atualização: ${error instanceof Error ? error.message : String(error)}`,
      'error',
      { duration: 8000 },
    );
    throw error;
  }).finally(() => {
    installPromise = null;
  });

  return installPromise;
}

async function runBackgroundCheck() {
  try {
    const result = await checkForUpdates('background');
    if (result.status === 'available') {
      announceAvailable(result.version);
    }
  } catch (error) {
    logDiagnostic('update_background_error', {
      source: 'background',
      error: error instanceof Error ? error.message : String(error),
    });
    console.warn('[autoUpdater] check skipped:', error);
  }
}

export function startAutoUpdater() {
  if (intervalHandle || initialTimer) return;

  initialTimer = setTimeout(() => {
    initialTimer = null;
    runBackgroundCheck();
  }, INITIAL_DELAY_MS);

  intervalHandle = setInterval(runBackgroundCheck, CHECK_INTERVAL_MS);
}

export function stopAutoUpdater() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  if (initialTimer) {
    clearTimeout(initialTimer);
    initialTimer = null;
  }
}

export function resetAutoUpdaterForTests() {
  stopAutoUpdater();
  pendingUpdate = null;
  checkPromise = null;
  installPromise = null;
}
