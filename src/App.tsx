import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { listen, emit } from '@tauri-apps/api/event';
import { readText, writeText, readImage } from '@tauri-apps/plugin-clipboard-manager';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import { AnimatePresence, motion } from 'framer-motion';
import HorseLogo from './components/Shared/HorseLogo';
import ToastContainer from './components/Shared/ToastContainer';
import { useSettingsStore, setupSettingsSync } from './stores/settingsStore';
import { useClipboardStore } from './stores/clipboardStore';
import { bootstrapAuth, useAuthStore } from './stores/authStore';
import { useToastStore } from './stores/toastStore';
import { useCreditsStore } from './stores/creditsStore';
import { useRoomStore } from './stores/roomStore';
import { nextStreamId } from './services/ai';
import { AI_MODES } from './types/account';
import { CLIPBOARD_SYSTEM_PROMPTS } from './i18n/defaults';
import {
  detectClipboardIntent,
  maxTokensForIntent,
} from './utils/detectClipboardIntent';
import { sanitizeBackendError } from './services/ai';
import { isTauriRuntime } from './utils/tauriRuntime';
import { withTimeout } from './utils/async';
import { logDiagnostic, withDiagnostic } from './services/diagnostics';
import { checkForUpdates, installAvailableUpdate, startAutoUpdater } from './services/autoUpdater';
import { cleanupLegacyConversationData } from './services/legacyCleanup';
import type { FlashAppearance, FlashPosition, FlashTiming } from './types';
import {
  canProcessClipboardEvents,
  canRebuildTrayMenu,
  canRunStartupHydration,
  canListenTrayEvents,
  canRegisterGlobalShortcuts,
  isWindowsDesktopPlatform,
} from './utils/desktopFeatureGates';

const MainPage = lazy(() => import('./pages/MainPage'));
const FlashPage = lazy(() => import('./pages/FlashPage'));

const TRAY_CIRCUIT_FAILURE_LIMIT = 2;
const TRAY_CIRCUIT_OPEN_MS = 45_000;

interface FlashShowArgs extends Record<string, unknown> {
  text: string;
  position: FlashPosition;
  timing: FlashTiming;
  appearance: FlashAppearance;
  streamId: number;
}

interface FlashReadyPayload {
  streamId?: number | null;
}

function normalizeShortcut(shortcut: string): string {
  return shortcut.replace(/CmdOrCtrl/g, 'CommandOrControl');
}

async function readClipboardTextWithRetry(attempts = 3, delayMs = 60): Promise<string> {
  for (let index = 0; index < attempts; index++) {
    try {
      const text = await readText();
      if (text) return text;
    } catch (error) {
      if (index === attempts - 1) console.warn('[clipboard] readText failed after retries:', error);
    }
    if (index < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return '';
}

async function imageToBase64(image: Awaited<ReturnType<typeof readImage>>): Promise<string> {
  const rgba = await image.rgba();
  const { width, height } = await image.size();
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const imageData = new ImageData(new Uint8ClampedArray(rgba), width, height);
  ctx.putImageData(imageData, 0, 0);
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.length; index++) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

async function waitForFlashReady(streamId: number): Promise<void> {
  let unlisten: (() => void) | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let settled = false;

  await new Promise<void>((resolve) => {
    const finish = () => {
      if (settled) return;
      settled = true;
      if (timeoutId) clearTimeout(timeoutId);
      unlisten?.();
      resolve();
    };

    timeoutId = setTimeout(finish, 1_500);

    listen<FlashReadyPayload>('flash-ready', (event) => {
      const readyStream = event.payload?.streamId ?? null;
      if (readyStream === null || readyStream === streamId) finish();
    }).then((fn) => {
      if (settled) {
        fn();
        return undefined;
      }
      unlisten = fn;
      return invoke('flash_ensure');
    }).then(() => {
      if (settled) return undefined;
      return emit('flash-ready-request', { streamId });
    }).catch((error) => {
      console.error('[flash] ready wait failed:', error);
      finish();
    });
  });
}

async function showFlashWindow(args: FlashShowArgs, options: { waitForReady?: boolean } = {}): Promise<boolean> {
  try {
    if (options.waitForReady) {
      await withDiagnostic('flash_ready_wait', { streamId: args.streamId, mode: args.timing.mode }, () =>
        withTimeout(waitForFlashReady(args.streamId), 1_800, 'flash ready timed out'),
      );
    }

    await withDiagnostic('flash_show', { streamId: args.streamId, mode: args.timing.mode }, () =>
      withTimeout(invoke('flash_show', args), 1_500, 'flash show timed out'),
    );
    return true;
  } catch (error) {
    console.error('[flash] show failed:', error);
    return false;
  }
}

function App() {
  const location = useLocation();
  const isMainWindow = location.pathname === '/main' || location.pathname === '/';
  const isTauri = isTauriRuntime();
  const isWindowsDesktop = typeof navigator !== 'undefined' && isWindowsDesktopPlatform();
  const [showSplash, setShowSplash] = useState(isMainWindow);
  const [bootReady, setBootReady] = useState(!isTauri);

  const theme = useSettingsStore((state) => state.settings.theme);
  const language = useSettingsStore((state) => state.settings.language);
  const settingsLoadedFromDisk = useSettingsStore((state) => state._loadedFromDisk);
  const shortcuts = useSettingsStore((state) => state.settings.shortcuts);
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const authUser = useAuthStore((state) => state.user);

  useEffect(() => {
    if (!showSplash) return;
    const timer = setTimeout(() => setShowSplash(false), 1200);
    return () => clearTimeout(timer);
  }, [showSplash]);

  useEffect(() => {
    setBootReady(false);
    if (!canRunStartupHydration({ isTauri, isWindowsDesktop })) {
      useSettingsStore.setState({ _hydrated: true });
      useClipboardStore.setState({ loaded: true });
      useAuthStore.setState({ user: null, isLoading: false, isHydrated: true });
      setBootReady(true);
      return;
    }

    (async () => {
      logDiagnostic('startup_hydration_begin', { window: getCurrentWindow().label });
      try {
        await withDiagnostic('startup_settings_hydration', {}, () =>
          withTimeout(loadSettings(), 5_000, 'settings hydration timed out'),
        );
      } catch (error) {
        console.error('[startup] settings hydration fallback:', error);
        useSettingsStore.setState({ _hydrated: true });
      }

      await Promise.all([
        withDiagnostic('startup_legacy_cleanup', {}, () =>
          withTimeout(cleanupLegacyConversationData(), 5_000, 'legacy cleanup timed out'),
        ).catch((error) => {
          console.error('[startup] legacy cleanup failed:', error);
        }),
        withDiagnostic('startup_clipboard_hydration', {}, () =>
          withTimeout(
            useClipboardStore.getState().loadEntries(),
            5_000,
            'clipboard hydration timed out',
          ),
        ).catch((error) => {
          console.error('[startup] clipboard hydration fallback:', error);
          useClipboardStore.setState({ entries: [], loaded: true });
        }),
        withDiagnostic('startup_auth_bootstrap', {}, () =>
          withTimeout(bootstrapAuth(), 10_000, 'auth bootstrap timed out'),
        ).catch((error) => {
          console.error('[startup] auth bootstrap fallback:', error);
          useAuthStore.setState({ user: null, isLoading: false, isHydrated: true });
        }),
      ]);

      logDiagnostic('startup_hydration_done', { window: getCurrentWindow().label });
      setBootReady(true);
    })();

    setupSettingsSync();

    if (getCurrentWindow().label === 'main') {
      logDiagnostic('startup_updater_arm', {});
      startAutoUpdater();
    }

    let unlistenClose: (() => void) | undefined;
    getCurrentWindow().onCloseRequested(() => {
      void withTimeout(
        Promise.all([
          useSettingsStore.getState().saveSettings(),
          useClipboardStore.getState().saveEntries(),
        ]),
        1_500,
        'close save timed out',
      ).catch((error) => console.error('[close] best-effort save failed:', error));
    }).then((unlisten) => { unlistenClose = unlisten; });

    return () => {
      unlistenClose?.();
    };
  }, [isTauri, isWindowsDesktop, loadSettings]);

  useEffect(() => {
    if (!isMainWindow || !isTauri || !bootReady || !settingsLoadedFromDisk) return;
    const enabled = useSettingsStore.getState().settings.autoLaunch;
    withDiagnostic('startup_autostart_reconcile', { enabled }, () =>
      withTimeout(invoke('set_autostart', { enabled }), 2_000, 'autostart reconcile timed out'),
    ).catch((error) => {
      console.error('[startup] autostart reconcile failed:', error);
    });
  }, [bootReady, isMainWindow, isTauri, settingsLoadedFromDisk]);

  useEffect(() => {
    if (!isMainWindow || !isTauri || !bootReady) return;
    withDiagnostic('tray_language_sync', { language }, () =>
      withTimeout(invoke('set_tray_language', { lang: language }), 1_000, 'tray language sync timed out'),
    ).catch((error) => {
      console.error('[tray] language sync failed:', error);
    });
  }, [bootReady, isMainWindow, isTauri, language]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!authUser) {
      useRoomStore.getState().setRooms([]);
      useRoomStore.getState().setActiveRoom(null);
      useRoomStore.getState().clearRoomData();
    }
  }, [authUser]);

  const registeredShortcuts = useRef<{
    processClipboardFlash: string;
    adjustFlashPosition: string;
    emergencyQuit: string;
  }>({ processClipboardFlash: '', adjustFlashPosition: '', emergencyQuit: '' });

  useEffect(() => {
    if (!canRegisterGlobalShortcuts({ isMainWindow, isTauri, isWindowsDesktop })) return;
    const previous = registeredShortcuts.current;

    async function registerShortcuts() {
      const clipboardShortcut = normalizeShortcut(shortcuts.processClipboardFlash);
      const adjustFlashShortcut = normalizeShortcut(shortcuts.adjustFlashPosition);
      const emergencyQuitShortcut = normalizeShortcut(shortcuts.emergencyQuit);

      if (previous.processClipboardFlash && previous.processClipboardFlash !== clipboardShortcut) {
        try { await unregister(previous.processClipboardFlash); } catch {}
      }
      if (previous.adjustFlashPosition && previous.adjustFlashPosition !== adjustFlashShortcut) {
        try { await unregister(previous.adjustFlashPosition); } catch {}
      }
      if (previous.emergencyQuit && previous.emergencyQuit !== emergencyQuitShortcut) {
        try { await unregister(previous.emergencyQuit); } catch {}
      }

      if (clipboardShortcut && clipboardShortcut !== previous.processClipboardFlash) {
        try {
          await withDiagnostic('shortcut_register', { shortcutName: 'processClipboardFlash', accelerator: clipboardShortcut }, () =>
            withTimeout(register(clipboardShortcut, () => emit('process-clipboard')), 750, 'clipboard shortcut register timed out'),
          );
          previous.processClipboardFlash = clipboardShortcut;
        } catch (error) {
          console.error('Failed to register clipboard shortcut:', error);
          previous.processClipboardFlash = '';
        }
      }

      if (adjustFlashShortcut && adjustFlashShortcut !== previous.adjustFlashPosition) {
        try {
          await withDiagnostic('shortcut_register', { shortcutName: 'adjustFlashPosition', accelerator: adjustFlashShortcut }, () =>
            withTimeout(
              register(adjustFlashShortcut, () => {
                const pos = useSettingsStore.getState().settings.clipboard.flash.position;
                invoke('flash_enter_adjust_mode', {
                  position: { x: pos.x, y: pos.y },
                }).catch((error) => console.error('[flash] enter adjust via shortcut failed:', error));
              }),
              750,
              'adjust flash shortcut register timed out',
            ),
          );
          previous.adjustFlashPosition = adjustFlashShortcut;
        } catch (error) {
          console.error('Failed to register adjust-flash shortcut:', error);
          previous.adjustFlashPosition = '';
        }
      }

      if (emergencyQuitShortcut && emergencyQuitShortcut !== previous.emergencyQuit) {
        try {
          await withDiagnostic('shortcut_register', { shortcutName: 'emergencyQuit', accelerator: emergencyQuitShortcut }, () =>
            withTimeout(
              register(emergencyQuitShortcut, async () => {
                try {
                  await Promise.all([
                    useSettingsStore.getState().saveSettings(),
                    useClipboardStore.getState().saveEntries(),
                  ]);
                } catch (error) {
                  console.error('[emergency-quit] flush failed:', error);
                }
                invoke('quit_app').catch(() => {});
              }),
              750,
              'emergency quit shortcut register timed out',
            ),
          );
          previous.emergencyQuit = emergencyQuitShortcut;
        } catch (error) {
          console.error('Failed to register emergency-quit shortcut:', error);
          previous.emergencyQuit = '';
        }
      }
    }

    registerShortcuts();

    return () => {
      if (previous.processClipboardFlash) {
        unregister(previous.processClipboardFlash).catch(() => {});
        previous.processClipboardFlash = '';
      }
      if (previous.adjustFlashPosition) {
        unregister(previous.adjustFlashPosition).catch(() => {});
        previous.adjustFlashPosition = '';
      }
      if (previous.emergencyQuit) {
        unregister(previous.emergencyQuit).catch(() => {});
        previous.emergencyQuit = '';
      }
    };
  }, [
    shortcuts.processClipboardFlash,
    shortcuts.adjustFlashPosition,
    shortcuts.emergencyQuit,
    isMainWindow,
    isTauri,
    isWindowsDesktop,
  ]);

  useEffect(() => {
    if (!isMainWindow || !isTauri) return;
    const unlisten = listen<{ x: number; y: number }>('flash-position-saved', (event) => {
      const current = useSettingsStore.getState().settings;
      useSettingsStore.getState().updateSettings({
        clipboard: {
          ...current.clipboard,
          flash: {
            ...current.clipboard.flash,
            position: {
              ...current.clipboard.flash.position,
              x: event.payload.x,
              y: event.payload.y,
            },
          },
        },
      });
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [isMainWindow, isTauri]);

  useEffect(() => {
    if (!canListenTrayEvents({ isTauri, isWindowsDesktop })) return;
    const unlistenSettings = listen('open-settings', () => {
      useSettingsStore.getState().setShowSettingsPanel(true);
    });
    const unlistenUpdates = listen('check-updates', async () => {
      try {
        logDiagnostic('update_tray_clicked', {});
        const result = await checkForUpdates('tray');
        const { notifications } = useSettingsStore.getState().settings;
        if (result.status === 'available') {
          useToastStore.getState().showToast(`Hat v${result.version} disponivel.`, 'info', {
            duration: 60_000,
            action: {
              label: 'Instalar',
              onClick: () => {
                installAvailableUpdate('tray').catch(() => {});
              },
            },
          });
          if (notifications.enabled && notifications.showUpdateNotification) {
            invoke('send_notification', {
              title: `Hat v${result.version} disponivel`,
              body: 'Abra o app e clique em Instalar para aplicar.',
            }).catch((error) => console.error('[notification] update-check failed:', error));
          }
          return;
        }

        if (notifications.enabled && notifications.showUpdateNotification) {
          invoke('send_notification', { title: 'Hat', body: 'Voce ja esta na versao mais recente!' })
            .catch((error) => console.error('[notification] update-check failed:', error));
        }
      } catch (error) {
        console.error('Update check failed:', error);
        useToastStore.getState().showToast(
          `Erro ao verificar atualizacao: ${error instanceof Error ? error.message : String(error)}`,
          'error',
          { duration: 8000 },
        );
      }
    });
    return () => {
      unlistenSettings.then((fn) => fn());
      unlistenUpdates.then((fn) => fn());
    };
  }, [isTauri, isWindowsDesktop]);

  const rebuildTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trayFailureCountRef = useRef(0);
  const trayCircuitOpenUntilRef = useRef(0);
  const isTrayCircuitOpen = useCallback(() => {
    const now = Date.now();
    if (trayCircuitOpenUntilRef.current > now) return true;
    if (trayCircuitOpenUntilRef.current !== 0) {
      trayCircuitOpenUntilRef.current = 0;
      trayFailureCountRef.current = 0;
      logDiagnostic('tray_circuit_half_open', {});
    }
    return false;
  }, []);
  const recordTraySuccess = useCallback(() => {
    trayFailureCountRef.current = 0;
    trayCircuitOpenUntilRef.current = 0;
  }, []);
  const recordTrayFailure = useCallback((operation: string, error: unknown) => {
    trayFailureCountRef.current += 1;
    console.error(`[tray] ${operation} failed:`, error);
    if (trayFailureCountRef.current >= TRAY_CIRCUIT_FAILURE_LIMIT) {
      trayCircuitOpenUntilRef.current = Date.now() + TRAY_CIRCUIT_OPEN_MS;
      logDiagnostic('tray_circuit_open', {
        operation,
        failureCount: trayFailureCountRef.current,
        openMs: TRAY_CIRCUIT_OPEN_MS,
      });
    }
  }, []);

  const rebuildTrayMenu = useCallback(() => {
    if (!canRebuildTrayMenu({ isTauri, isWindowsDesktop, bootReady })) return;
    if (isTrayCircuitOpen()) return;
    if (rebuildTimerRef.current) clearTimeout(rebuildTimerRef.current);
    rebuildTimerRef.current = setTimeout(() => {
      const providerLabel = useAuthStore.getState().user
        ? (AI_MODES.find((mode) => mode.id === useCreditsStore.getState().selectedMode)?.label ?? 'Hat')
        : 'Hat - entre para usar';
      const isProcessing = useClipboardStore.getState().isProcessing;

      withDiagnostic('tray_rebuild_menu', { isProcessing }, () =>
        withTimeout(
          invoke('rebuild_tray_menu', {
            state: { providerLabel, isProcessing },
          }),
          1_000,
          'tray menu rebuild timed out',
        ),
      ).then(recordTraySuccess).catch((error) => recordTrayFailure('rebuild', error));
    }, 300);
  }, [bootReady, isTauri, isWindowsDesktop, isTrayCircuitOpen, recordTrayFailure, recordTraySuccess]);

  useEffect(() => {
    if (!isTauri) return;
    const unsubSettings = useSettingsStore.subscribe(rebuildTrayMenu);
    let prevProcessing = useClipboardStore.getState().isProcessing;
    const unsubClipboard = useClipboardStore.subscribe((state) => {
      if (state.isProcessing !== prevProcessing) {
        prevProcessing = state.isProcessing;
        rebuildTrayMenu();
        if (canRebuildTrayMenu({ isTauri, isWindowsDesktop, bootReady }) && !isTrayCircuitOpen()) {
          const iconState = state.isProcessing ? 'processing' : 'idle';
          withDiagnostic('tray_set_icon', { iconState }, () =>
            withTimeout(invoke('set_tray_icon', { iconState }), 1_000, 'tray icon update timed out'),
          ).then(recordTraySuccess).catch((error) => recordTrayFailure('icon', error));
        }
      }
    });

    rebuildTrayMenu();

    return () => {
      unsubSettings();
      unsubClipboard();
      if (rebuildTimerRef.current) clearTimeout(rebuildTimerRef.current);
    };
  }, [bootReady, isTauri, isWindowsDesktop, isTrayCircuitOpen, rebuildTrayMenu, recordTrayFailure, recordTraySuccess]);

  useEffect(() => {
    if (!canProcessClipboardEvents({ isMainWindow, isTauri, isWindowsDesktop })) return;
    let isProcessing = false;
    const setProcessing = (value: boolean) => {
      isProcessing = value;
      useClipboardStore.getState().setProcessing(value);
    };

    const unlisten = listen('process-clipboard', async () => {
      if (isProcessing) return;
      setProcessing(true);
      let chunkUnlisten: (() => void) | null = null;

      try {
        const { settings } = useSettingsStore.getState();
        const clip = settings.clipboard;
        if (!clip.enabled) {
          setProcessing(false);
          return;
        }

        const clipText = await readClipboardTextWithRetry();
        const clipImages: string[] = [];
        if (clip.captureImages) {
          try {
            const clipImage = await readImage();
            if (clipImage) {
              const base64 = await imageToBase64(clipImage);
              if (base64) clipImages.push(base64);
            }
          } catch {
            // Clipboard may contain text only.
          }
        }

        if (!clipText && clipImages.length === 0) {
          if (settings.notifications.enabled && settings.notifications.showClipboardEmptyNotification) {
            invoke('send_notification', { title: 'Hat', body: 'Clipboard vazio.' })
              .catch((error) => console.error('[notification] clipboard-empty failed:', error));
          }
          setProcessing(false);
          return;
        }

        if (!clip.flash.enabled && settings.notifications.enabled && settings.notifications.showProcessingNotification) {
          const hasImage = clipImages.length > 0;
          const preview = clipText
            ? (clipText.length > 80 ? `${clipText.slice(0, 80)}...` : clipText)
            : '(imagem)';
          const title = hasImage && clipText
            ? 'Hat - Processando texto + imagem'
            : hasImage
              ? 'Hat - Processando imagem'
              : 'Hat - Processando';
          invoke('send_notification', { title, body: preview })
            .catch((error) => console.error('[notification] processing-started failed:', error));
        }

        const currentUser = useAuthStore.getState().user;
        if (!currentUser) {
          invoke('send_notification', {
            title: 'Hat - Entre para usar',
            body: 'Faca login com Google na aba Conta para processar o clipboard.',
          }).catch(() => {});
          setProcessing(false);
          return;
        }

        const { getIdToken } = await import('./services/auth/firebase');
        const hatToken = await getIdToken();
        if (!hatToken) {
          invoke('send_notification', {
            title: 'Hat - Sessao expirada',
            body: 'Entre de novo na aba Conta para continuar.',
          }).catch(() => {});
          setProcessing(false);
          return;
        }

        const hatMode = useCreditsStore.getState().selectedMode;
        const provider = 'Hat';
        const model = AI_MODES.find((mode) => mode.id === hatMode)?.label ?? 'Hat';
        const systemPrompt = CLIPBOARD_SYSTEM_PROMPTS[settings.language] ?? CLIPBOARD_SYSTEM_PROMPTS['pt-BR'];
        const messageText = clipText || 'Descreva e analise esta imagem.';
        const clipboardIntent = detectClipboardIntent(clipText);
        const clipboardMaxTokens = maxTokensForIntent(clipboardIntent);
        const roomState = useRoomStore.getState();
        const activeRoom = roomState.rooms.find((room) => room.id === roomState.activeRoomId) ?? null;
        const shouldShareRoom = Boolean(activeRoom && activeRoom.status === 'open');
        const sourceMessageId = crypto.randomUUID();

        let response = '';
        let hasReceivedContent = false;
        const streamId = nextStreamId();
        let flashTypewriterArmed = false;
        let flashShown = false;

        const sendResponseNotification = (finalResponse: string) => {
          const notifications = useSettingsStore.getState().settings.notifications;
          if (!notifications.enabled || !notifications.showResponseNotification) return;
          const body = finalResponse.length > 500 ? `${finalResponse.slice(0, 500)}...` : finalResponse;
          invoke('send_notification', {
            title: clip.copyResponseToClipboard ? 'Hat - Copiado para clipboard' : 'Hat - Resposta',
            body,
          }).catch((error) => console.error('[notification] response failed:', error));
        };

        chunkUnlisten = await listen<{ streamId: number; text: string; isFinished: boolean; contentType?: string }>(
          'chat-stream',
          async (event) => {
            if (event.payload.streamId !== streamId) return;
            if (event.payload.text && !event.payload.isFinished && event.payload.contentType !== 'thinking') {
              response += event.payload.text;
              hasReceivedContent = true;
            }
            if (!event.payload.isFinished) return;

            if (hasReceivedContent && response) {
              const maxLen = clip.maxResponseLength || 4096;
              const shouldCharTruncate = clipboardIntent === 'mcq' && response.length > maxLen;
              const finalResponse = shouldCharTruncate ? `${response.slice(0, maxLen)}...` : response;

              if (clip.copyResponseToClipboard) {
                const textToWrite = clip.appendMode && clipText
                  ? `${clipText}\n\n---\n\n${finalResponse}`
                  : finalResponse;
                writeText(textToWrite).catch((error) => console.error('[clipboard] writeText failed:', error));
              }

              const currentFlash = useSettingsStore.getState().settings.clipboard.flash;
              if (currentFlash.enabled) {
                if (currentFlash.timing.mode === 'typewriter') {
                  if (flashTypewriterArmed) {
                    flashShown = true;
                  } else {
                    const fadeTiming: FlashTiming = { ...currentFlash.timing, mode: 'fade' };
                    const preview = finalResponse.slice(0, currentFlash.previewLength);
                    flashShown = await showFlashWindow({
                      text: preview,
                      position: currentFlash.position,
                      timing: fadeTiming,
                      appearance: currentFlash.appearance,
                      streamId,
                    }, { waitForReady: true });
                    if (!flashShown) sendResponseNotification(finalResponse);
                  }
                } else {
                  const preview = finalResponse.slice(0, currentFlash.previewLength);
                  flashShown = await showFlashWindow({
                    text: preview,
                    position: currentFlash.position,
                    timing: currentFlash.timing,
                    appearance: currentFlash.appearance,
                    streamId,
                  }, { waitForReady: true });
                  if (!flashShown) sendResponseNotification(finalResponse);
                }
              } else {
                sendResponseNotification(finalResponse);
              }

              useClipboardStore.getState().addEntry({
                id: sourceMessageId,
                originalText: clipText || '(imagem)',
                response: finalResponse,
                timestamp: Date.now(),
                provider,
                model,
                ...(clipImages.length > 0 ? { images: clipImages } : {}),
                ...(shouldShareRoom && activeRoom ? {
                  roomId: activeRoom.id,
                  roomTitle: activeRoom.title,
                  sharedToRoom: true,
                } : { sharedToRoom: false }),
                flashShown,
              });

              if (clip.soundOnComplete) {
                try {
                  const ctx = new AudioContext();
                  const osc = ctx.createOscillator();
                  const gain = ctx.createGain();
                  osc.connect(gain);
                  gain.connect(ctx.destination);
                  osc.frequency.value = 880;
                  gain.gain.value = 0.08;
                  osc.start();
                  osc.stop(ctx.currentTime + 0.12);
                } catch {}
              }
            } else {
              const errorNotif = useSettingsStore.getState().settings.notifications;
              if (errorNotif.enabled && errorNotif.showErrorNotification) {
                const safeBody = sanitizeBackendError(event.payload.text || '');
                invoke('send_notification', { title: 'Hat - Erro', body: safeBody })
                  .catch((error) => console.error('[notification] stream-error failed:', error));
              }
            }

            chunkUnlisten?.();
            chunkUnlisten = null;
            setProcessing(false);
          },
        );

        if (clip.flash.enabled && clip.flash.timing.mode === 'typewriter') {
          flashTypewriterArmed = await showFlashWindow({
            text: '',
            position: clip.flash.position,
            timing: clip.flash.timing,
            appearance: clip.flash.appearance,
            streamId,
          }, { waitForReady: true });
        }

        await invoke('stream_chat_hat', {
          streamId,
          messages: [{ role: 'user', textContent: messageText }],
          systemPrompt,
          mode: hatMode,
          temperature: settings.temperature,
          maxTokens: clipboardMaxTokens,
          images: clipImages,
          roomId: shouldShareRoom ? activeRoom?.id : null,
          roomShare: shouldShareRoom,
          sourceMessageId: shouldShareRoom ? sourceMessageId : null,
          idToken: hatToken,
          idempotencyKey: crypto.randomUUID(),
        });
      } catch (error) {
        console.error('Clipboard processing failed:', error);
        if (chunkUnlisten) {
          chunkUnlisten();
          chunkUnlisten = null;
        }
        const catchNotif = useSettingsStore.getState().settings.notifications;
        if (catchNotif.enabled && catchNotif.showErrorNotification) {
          invoke('send_notification', { title: 'Hat - Erro', body: 'Falha ao processar clipboard.' })
            .catch((notificationError) => console.error('[notification] processing-error failed:', notificationError));
        }
        setProcessing(false);
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [isMainWindow, isTauri, isWindowsDesktop]);

  return (
    <>
      <AnimatePresence>
        {showSplash && (
          <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeInOut' }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-primary)',
            }}
          >
            <motion.div
              initial={{ scale: 0.76, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 180, damping: 16 }}
            >
              <HorseLogo size={118} animated />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.28, ease: 'easeOut' }}
              style={{
                marginTop: 16,
                fontSize: 28,
                fontWeight: 800,
                color: 'var(--text-bright)',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              }}
            >
              Hat Flash
            </motion.h1>
          </motion.div>
        )}
      </AnimatePresence>

      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/main" element={<MainPage />} />
          <Route path="/flash" element={<FlashPage />} />
          <Route path="*" element={<Navigate to="/main" replace />} />
        </Routes>
      </Suspense>
      <ToastContainer />
    </>
  );
}

export default App;
