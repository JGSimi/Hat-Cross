import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../stores/settingsStore';
import { useConversationStore } from '../stores/conversationStore';
import { useToastStore } from '../stores/toastStore';

// Background auto-updater. Fires a check 30 seconds after launch (delay so we
// don't compete for bandwidth with the initial app load) and then every
// 5 minutes. If a release is available it auto-downloads and surfaces a
// toast + OS notification with a "Reiniciar agora" action — user stays in
// control of when the relaunch happens so they don't lose chat context.

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 min
const INITIAL_DELAY_MS = 30 * 1000; // 30s grace after launch
const TOAST_TTL_MS = 60 * 60 * 1000; // 1h (effectively sticky until user acts)

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let initialTimer: ReturnType<typeof setTimeout> | null = null;

// Tracks an already-downloaded update so we don't re-download on the next tick.
let pendingUpdate: Update | null = null;
let checkInFlight = false;

async function applyUpdate(update: Update) {
  try {
    // Flush all persistent stores before relaunching so nothing in-memory
    // is lost across the restart.
    await useSettingsStore.getState().saveSettings();
    await useConversationStore.getState().saveConversations();
    await update.downloadAndInstall(); // no-op if already downloaded
    await relaunch();
  } catch (e) {
    console.error('[autoUpdater] apply failed:', e);
    useToastStore.getState().showToast(
      `Erro ao aplicar atualização: ${String(e)}`,
      'error',
      { duration: 8000 },
    );
  }
}

function announceReady(update: Update) {
  const { showToast } = useToastStore.getState();
  const { settings } = useSettingsStore.getState();

  showToast(
    `Nova versão (v${update.version}) pronta — reinicie para atualizar.`,
    'info',
    {
      duration: TOAST_TTL_MS,
      action: {
        label: 'Reiniciar',
        onClick: () => {
          applyUpdate(update);
        },
      },
    },
  );

  if (
    settings.notifications.enabled &&
    settings.notifications.showUpdateNotification
  ) {
    invoke('send_notification', {
      title: `Hat v${update.version} disponível`,
      body: 'Abra o app e clique em Reiniciar para aplicar.',
    }).catch(() => {});
  }
}

async function runCheck() {
  if (checkInFlight || pendingUpdate) return;
  checkInFlight = true;
  try {
    const update = await check();
    if (!update) return;

    // Auto-download in the background. downloadAndInstall emits progress
    // events we could surface, but for a 5-min cadence silent download is
    // fine — we only talk to the user once the binary is ready.
    await update.downloadAndInstall();
    pendingUpdate = update;
    announceReady(update);
  } catch (e) {
    // Network errors, signature mismatches, etc. Silent — next tick retries.
    console.warn('[autoUpdater] check skipped:', e);
  } finally {
    checkInFlight = false;
  }
}

export function startAutoUpdater() {
  if (intervalHandle || initialTimer) return; // idempotent

  initialTimer = setTimeout(() => {
    initialTimer = null;
    runCheck();
  }, INITIAL_DELAY_MS);

  intervalHandle = setInterval(runCheck, CHECK_INTERVAL_MS);
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
