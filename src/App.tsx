import { lazy, Suspense, useEffect, useRef, useCallback, useState } from 'react';
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
import { useChatStore } from './stores/chatStore';
import { useConversationStore, flushPendingSave } from './stores/conversationStore';
import { useClipboardStore } from './stores/clipboardStore';
import { useDraftsStore } from './stores/draftsStore';
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
const PopoverPage = lazy(() => import('./pages/PopoverPage'));
const FlashPage = lazy(() => import('./pages/FlashPage'));
const ThemeUnlockCelebration = lazy(() => import('./components/Settings/ThemeUnlockCelebration'));

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

/** Normalize legacy shortcut format (CmdOrCtrl → CommandOrControl) */
function normalizeShortcut(s: string): string {
  return s.replace(/CmdOrCtrl/g, 'CommandOrControl');
}

/**
 * Read clipboard text with short retry/backoff to beat the Windows
 * clipboard-ownership race. When the global shortcut fires microseconds after
 * Ctrl+C, the source application may still own the clipboard — OpenClipboard()
 * fails under the hood and readText() returns empty or throws. The tray-menu
 * path doesn't hit this because human reaction time (~200ms) already gives the
 * OS time to release ownership. This helper replicates that grace period.
 */
async function readClipboardTextWithRetry(attempts = 3, delayMs = 60): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    try {
      const text = await readText();
      if (text) return text;
    } catch (e) {
      // readText throws on non-text clipboard content (e.g. image-only) — the
      // retry is cheap and harmless; we'll return '' if it keeps throwing.
      if (i === attempts - 1) console.warn('[clipboard] readText failed after retries:', e);
    }
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return '';
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
      if (readyStream === null || readyStream === streamId) {
        finish();
      }
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
      withTimeout(
        invoke('flash_show', args),
        1_500,
        'flash show timed out',
      ),
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

  // Auto-dismiss splash after 2s (then 1s fade-out via AnimatePresence)
  useEffect(() => {
    if (!showSplash) return;
    const timer = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(timer);
  }, [showSplash]);

  const theme = useSettingsStore((s) => s.settings.theme);
  const language = useSettingsStore((s) => s.settings.language);
  const settingsLoadedFromDisk = useSettingsStore((s) => s._loadedFromDisk);
  const shortcuts = useSettingsStore((s) => s.settings.shortcuts);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const authUser = useAuthStore((s) => s.user);

  useEffect(() => {
    setBootReady(false);
    if (!canRunStartupHydration({ isTauri, isWindowsDesktop })) {
      useSettingsStore.setState({ _hydrated: true });
      useConversationStore.setState({ loaded: true });
      useDraftsStore.setState({ loaded: true });
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
        logDiagnostic('startup_settings_hydration_fallback', {
          error: error instanceof Error ? error.message : String(error),
        });
        useSettingsStore.setState({ _hydrated: true });
      }

      await Promise.all([
        withDiagnostic('startup_conversations_hydration', {}, () =>
          withTimeout(
            useConversationStore.getState().loadConversations(),
            5_000,
            'conversations hydration timed out',
          ),
        ).catch((error) => {
          console.error('[startup] conversations hydration fallback:', error);
          logDiagnostic('startup_conversations_hydration_fallback', {
            error: error instanceof Error ? error.message : String(error),
          });
          useConversationStore.setState({ conversations: [], loaded: true });
        }),
        withDiagnostic('startup_drafts_hydration', {}, () =>
          withTimeout(
            useDraftsStore.getState().loadDrafts(),
            5_000,
            'drafts hydration timed out',
          ),
        ).catch((error) => {
          console.error('[startup] drafts hydration fallback:', error);
          logDiagnostic('startup_drafts_hydration_fallback', {
            error: error instanceof Error ? error.message : String(error),
          });
          useDraftsStore.setState({ drafts: {}, loaded: true });
        }),
        withDiagnostic('startup_clipboard_hydration', {}, () =>
          withTimeout(
            useClipboardStore.getState().loadEntries(),
            5_000,
            'clipboard hydration timed out',
          ),
        ).catch((error) => {
          console.error('[startup] clipboard hydration fallback:', error);
          logDiagnostic('startup_clipboard_hydration_fallback', {
            error: error instanceof Error ? error.message : String(error),
          });
          useClipboardStore.setState({ entries: [], loaded: true });
        }),
        withDiagnostic('startup_auth_bootstrap', {}, () =>
          withTimeout(bootstrapAuth(), 10_000, 'auth bootstrap timed out'),
        ).catch((error) => {
          console.error('[startup] auth bootstrap fallback:', error);
          logDiagnostic('startup_auth_bootstrap_fallback', {
            error: error instanceof Error ? error.message : String(error),
          });
          useAuthStore.setState({ user: null, isLoading: false, isHydrated: true });
        }),
      ]);
      logDiagnostic('startup_hydration_done', { window: getCurrentWindow().label });
      setBootReady(true);
    })();
    setupSettingsSync();

    // Auto-updater: initial check 30s after launch, then every 5 min.
    // Only arm it on the main window so multi-window scenarios don't run
    // the 5-min cycle N times in parallel.
    if (getCurrentWindow().label === 'main') {
      logDiagnostic('startup_updater_arm', {});
      startAutoUpdater();
    }

    // Flush pending saves on window close to prevent data loss
    let unlistenClose: (() => void) | undefined;
    getCurrentWindow().onCloseRequested(() => {
      flushPendingSave();
      void withTimeout(
        Promise.all([
          useConversationStore.getState().saveConversations(),
          useSettingsStore.getState().saveSettings(),
          useDraftsStore.getState().saveDrafts(),
          useClipboardStore.getState().saveEntries(),
        ]),
        1_500,
        'close save timed out',
      ).catch((error) => console.error('[close] best-effort save failed:', error));
    }).then((unlisten) => { unlistenClose = unlisten; });

    return () => {
      unlistenClose?.();
    };
  }, [isMainWindow, isTauri, isWindowsDesktop, loadSettings]);

  useEffect(() => {
    if (!isMainWindow || !isTauri || !bootReady || !settingsLoadedFromDisk) return;
    const enabled = useSettingsStore.getState().settings.autoLaunch;
    withDiagnostic('startup_autostart_reconcile', { enabled }, () =>
      withTimeout(
        invoke('set_autostart', { enabled }),
        2_000,
        'autostart reconcile timed out',
      ),
    ).catch((error) => {
      console.error('[startup] autostart reconcile failed:', error);
    });
  }, [bootReady, isMainWindow, isTauri, settingsLoadedFromDisk]);

  useEffect(() => {
    if (!isMainWindow || !isTauri || !bootReady) return;
    withDiagnostic('tray_language_sync', { language }, () =>
      withTimeout(
        invoke('set_tray_language', { lang: language }),
        1_000,
        'tray language sync timed out',
      ),
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

  // Global shortcut registration via JS API (handles CommandOrControl correctly per platform)
  // Only in the main window — each Tauri window boots its own App instance, and
  // double-registering the same accelerator races on Linux/Windows (the second
  // call clobbers the first handler) and spawns duplicate listeners on macOS.
  const registeredShortcuts = useRef<{ clipboard: string; floatingChat: string; adjustFlashPosition: string; emergencyQuit: string }>({ clipboard: '', floatingChat: '', adjustFlashPosition: '', emergencyQuit: '' });
  useEffect(() => {
    if (!canRegisterGlobalShortcuts({ isMainWindow, isTauri, isWindowsDesktop })) return;
    const prev = registeredShortcuts.current;

    async function registerShortcuts() {
      const clipShortcut = normalizeShortcut(shortcuts.clipboard);
      const floatingChatShortcut = normalizeShortcut(shortcuts.floatingChat);
      const adjustFlashShortcut = normalizeShortcut(shortcuts.adjustFlashPosition);
      const emergencyQuitShortcut = normalizeShortcut(shortcuts.emergencyQuit);

      // Unregister old shortcuts if they changed
      if (prev.clipboard && prev.clipboard !== clipShortcut) {
        try { await unregister(prev.clipboard); } catch {}
      }
      if (prev.floatingChat && prev.floatingChat !== floatingChatShortcut) {
        try { await unregister(prev.floatingChat); } catch {}
      }
      if (prev.adjustFlashPosition && prev.adjustFlashPosition !== adjustFlashShortcut) {
        try { await unregister(prev.adjustFlashPosition); } catch {}
      }
      if (prev.emergencyQuit && prev.emergencyQuit !== emergencyQuitShortcut) {
        try { await unregister(prev.emergencyQuit); } catch {}
      }

      // Register clipboard shortcut
      if (clipShortcut && clipShortcut !== prev.clipboard) {
        try {
          await withDiagnostic('shortcut_register', { shortcutName: 'clipboard', accelerator: clipShortcut }, () =>
            withTimeout(
              register(clipShortcut, () => {
                emit('process-clipboard');
              }),
              750,
              'clipboard shortcut register timed out',
            ),
          );
          prev.clipboard = clipShortcut;
        } catch (e) {
          console.error('Failed to register clipboard shortcut:', e);
          prev.clipboard = '';
        }
      }

      // Register floating chat shortcut (toggle — time-based debounce handles auto-repeat
      // and the press/release double-fire; no event.state gate, since the plugin's event
      // shape isn't uniform across platforms and the check was silently killing the popover).
      if (floatingChatShortcut && floatingChatShortcut !== prev.floatingChat) {
        let lastToggleTime = 0;
        try {
          await withDiagnostic('shortcut_register', { shortcutName: 'floatingChat', accelerator: floatingChatShortcut }, () =>
            withTimeout(
              register(floatingChatShortcut, () => {
                const now = Date.now();
                if (now - lastToggleTime > 400) {
                  lastToggleTime = now;
                  invoke('toggle_popover_window').catch(() => {});
                }
              }),
              750,
              'floating chat shortcut register timed out',
            ),
          );
          prev.floatingChat = floatingChatShortcut;
        } catch (e) {
          console.error('Failed to register floating chat shortcut:', e);
          prev.floatingChat = '';
        }
      }

      // Register "Adjust Flash Position" shortcut — opens the flash window in
      // adjust mode straight from wherever the user is, so they don't need to
      // dig into Settings to retune the on-screen spot.
      if (adjustFlashShortcut && adjustFlashShortcut !== prev.adjustFlashPosition) {
        try {
          await withDiagnostic('shortcut_register', { shortcutName: 'adjustFlashPosition', accelerator: adjustFlashShortcut }, () =>
            withTimeout(
              register(adjustFlashShortcut, () => {
                const pos = useSettingsStore.getState().settings.clipboard.flash.position;
                invoke('flash_enter_adjust_mode', {
                  position: { x: pos.x, y: pos.y },
                }).catch((e) => console.error('[flash] enter adjust via shortcut failed:', e));
              }),
              750,
              'adjust flash shortcut register timed out',
            ),
          );
          prev.adjustFlashPosition = adjustFlashShortcut;
        } catch (e) {
          console.error('Failed to register adjust-flash shortcut:', e);
          prev.adjustFlashPosition = '';
        }
      }

      // Emergency quit — flush pending saves then exit. Works without the app
      // being focused so the user can kill it from anywhere.
      if (emergencyQuitShortcut && emergencyQuitShortcut !== prev.emergencyQuit) {
        try {
          await withDiagnostic('shortcut_register', { shortcutName: 'emergencyQuit', accelerator: emergencyQuitShortcut }, () =>
            withTimeout(
              register(emergencyQuitShortcut, async () => {
                try {
                  flushPendingSave();
                  await Promise.all([
                    useConversationStore.getState().saveConversations(),
                    useSettingsStore.getState().saveSettings(),
                    useDraftsStore.getState().saveDrafts(),
                    useClipboardStore.getState().saveEntries(),
                  ]);
                } catch (e) {
                  console.error('[emergency-quit] flush failed:', e);
                }
                invoke('quit_app').catch(() => {});
              }),
              750,
              'emergency quit shortcut register timed out',
            ),
          );
          prev.emergencyQuit = emergencyQuitShortcut;
        } catch (e) {
          console.error('Failed to register emergency-quit shortcut:', e);
          prev.emergencyQuit = '';
        }
      }
    }

    registerShortcuts();

    return () => {
      if (prev.clipboard) { unregister(prev.clipboard).catch(() => {}); prev.clipboard = ''; }
      if (prev.floatingChat) { unregister(prev.floatingChat).catch(() => {}); prev.floatingChat = ''; }
      if (prev.adjustFlashPosition) { unregister(prev.adjustFlashPosition).catch(() => {}); prev.adjustFlashPosition = ''; }
      if (prev.emergencyQuit) { unregister(prev.emergencyQuit).catch(() => {}); prev.emergencyQuit = ''; }
    };
  }, [shortcuts.clipboard, shortcuts.floatingChat, shortcuts.adjustFlashPosition, shortcuts.emergencyQuit, isMainWindow, isTauri]);

  // Flash position persistence — listens for the save event emitted by the
  // /flash route in adjust mode. Global so it works whether the user triggered
  // adjust from Settings or via the global shortcut.
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

  // Tray menu events
  useEffect(() => {
    if (!canListenTrayEvents({ isTauri, isWindowsDesktop })) return;
    const unlistenNew = listen('new-conversation', () => {
      useChatStore.getState().clearMessages();
      useConversationStore.getState().createConversation();
    });
    const unlistenSettings = listen('open-settings', () => {
      useSettingsStore.getState().setShowSettingsPanel(true);
    });
    const unlistenUpdates = listen('check-updates', async () => {
      try {
        logDiagnostic('update_tray_clicked', {});
        const result = await checkForUpdates('tray');
        const { notifications } = useSettingsStore.getState().settings;
        if (result.status === 'available') {
          useToastStore.getState().showToast(`Hat v${result.version} disponível.`, 'info', {
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
              title: `Hat v${result.version} disponível`,
              body: 'Abra o app e clique em Instalar para aplicar.',
            }).catch((e) => console.error('[notification] update-check failed:', e));
          }
          return;
        }

        if (notifications.enabled && notifications.showUpdateNotification) {
          invoke('send_notification', { title: 'Hat', body: 'Você já está na versão mais recente!' })
            .catch((e) => console.error('[notification] update-check failed:', e));
        }
      } catch (e) {
        console.error('Update check failed:', e);
        logDiagnostic('update_tray_error_visible', {
          error: e instanceof Error ? e.message : String(e),
        });
        useToastStore.getState().showToast(
          `Erro ao verificar atualização: ${e instanceof Error ? e.message : String(e)}`,
          'error',
          { duration: 8000 },
        );
      }
    });
    const unlistenLoadConv = listen<string>('load-conversation', (event) => {
      useConversationStore.getState().setActiveConversation(event.payload);
    });
    return () => {
      unlistenNew.then(fn => fn());
      unlistenSettings.then(fn => fn());
      unlistenUpdates.then(fn => fn());
      unlistenLoadConv.then(fn => fn());
    };
  }, [isTauri, isWindowsDesktop]);

  // Dynamic tray menu sync — rebuild when settings, conversations or streaming state change
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
      // Tray label reflects the active Hat credits mode (Mini/Standard/Plus).
      // Signed-out users get a neutral label since there's no active LLM.
      const authedLabel = useAuthStore.getState().user ? (
        AI_MODES.find((m) => m.id === useCreditsStore.getState().selectedMode)?.label ?? 'Hat'
      ) : 'Hat — entre para usar';
      const providerLabel = authedLabel;

      const conversations = useConversationStore.getState().conversations;
      const recentConversations = conversations.slice(0, 5).map(c => ({
        id: c.id,
        title: c.title,
      }));

      const isProcessing = useChatStore.getState().isStreaming;

      withDiagnostic('tray_rebuild_menu', {
        recentConversationCount: recentConversations.length,
        isProcessing,
      }, () =>
        withTimeout(
          invoke('rebuild_tray_menu', {
            state: { providerLabel, isProcessing, recentConversations },
          }),
          1_000,
          'tray menu rebuild timed out',
        ),
      ).then(recordTraySuccess).catch((error) => recordTrayFailure('rebuild', error));
    }, 300);
  }, [bootReady, isTauri, isWindowsDesktop, isTrayCircuitOpen, recordTrayFailure, recordTraySuccess]);

  useEffect(() => {
    if (!isTauri) return;
    // Subscribe to store changes and rebuild tray menu
    const unsubSettings = useSettingsStore.subscribe(rebuildTrayMenu);
    const unsubConversations = useConversationStore.subscribe(rebuildTrayMenu);
    let prevStreaming = useChatStore.getState().isStreaming;
    const unsubChat = useChatStore.subscribe((state) => {
      if (state.isStreaming !== prevStreaming) {
        prevStreaming = state.isStreaming;
        rebuildTrayMenu();
        if (canRebuildTrayMenu({ isTauri, isWindowsDesktop, bootReady }) && !isTrayCircuitOpen()) {
          withDiagnostic('tray_set_icon', { iconState: state.isStreaming ? 'processing' : 'idle' }, () =>
            withTimeout(
              invoke('set_tray_icon', { iconState: state.isStreaming ? 'processing' : 'idle' }),
              1_000,
              'tray icon update timed out',
            ),
          ).then(recordTraySuccess).catch((error) => recordTrayFailure('icon', error));
        }
      }
    });

    // Initial rebuild after settings load
    rebuildTrayMenu();

    return () => {
      unsubSettings();
      unsubConversations();
      unsubChat();
      if (rebuildTimerRef.current) clearTimeout(rebuildTimerRef.current);
    };
  }, [bootReady, isTauri, isWindowsDesktop, isTrayCircuitOpen, rebuildTrayMenu, recordTrayFailure, recordTraySuccess]);

  // Clipboard processing — core feature
  // Flow: user copies text/image → presses shortcut → AI processes → notification with response
  // Gated to the main window: Tauri broadcasts `process-clipboard` to every webview,
  // and without this gate the hidden analysis window also ran the full pipeline, producing
  // two "Processando" + two "Resposta" notifications per trigger on every OS.
  useEffect(() => {
    if (!canProcessClipboardEvents({ isMainWindow, isTauri, isWindowsDesktop })) return;
    let isProcessing = false;
    const setProc = (v: boolean) => {
      isProcessing = v;
      useClipboardStore.getState().setProcessing(v);
    };

    // Convert RGBA Image to base64 PNG via OffscreenCanvas
    async function imageToBase64(image: Awaited<ReturnType<typeof readImage>>): Promise<string> {
      const rgba = await image.rgba();
      const { width, height } = await image.size();
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d')!;
      const imageData = new ImageData(new Uint8ClampedArray(rgba), width, height);
      ctx.putImageData(imageData, 0, 0);
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    }

    const unlisten = listen('process-clipboard', async () => {
      if (isProcessing) return;
      setProc(true);

      let chunkUnlisten: (() => void) | null = null;

      try {
        const { settings } = useSettingsStore.getState();
        const clip = settings.clipboard;

        if (!clip.enabled) { setProc(false); return; }

        // Read text and (optionally) image from clipboard.
        // readClipboardTextWithRetry handles the Windows ownership race where the
        // source app may still hold the clipboard when a global shortcut fires.
        let clipText = await readClipboardTextWithRetry();
        const clipImages: string[] = [];

        if (clip.captureImages) {
          try {
            const clipImage = await readImage();
            if (clipImage) {
              const base64 = await imageToBase64(clipImage);
              if (base64) clipImages.push(base64);
            }
          } catch {
            // No image in clipboard — that's fine
          }
        }

        // Need at least text or image
        if (!clipText && clipImages.length === 0) {
          if (settings.notifications.enabled && settings.notifications.showClipboardEmptyNotification) {
            invoke('send_notification', { title: 'Hat', body: 'Clipboard vazio.' })
              .catch((e) => console.error('[notification] clipboard-empty failed:', e));
          }
          setProc(false);
          return;
        }

        // Notify processing started — suppressed when Flash Mode is enabled
        // (the flash itself is the user-facing signal).
        if (
          !clip.flash.enabled &&
          settings.notifications.enabled &&
          settings.notifications.showProcessingNotification
        ) {
          const hasImage = clipImages.length > 0;
          const preview = clipText
            ? (clipText.length > 80 ? clipText.slice(0, 80) + '...' : clipText)
            : '(imagem)';
          const title = hasImage && clipText ? 'Hat — Processando texto + imagem' :
                        hasImage ? 'Hat — Processando imagem' :
                        'Hat — Processando';
          invoke('send_notification', { title, body: preview })
            .catch((e) => console.error('[notification] processing-started failed:', e));
        }

        // Clipboard now only works when signed in — BYOK is gone, so bail
        // early (with a notification nudge) if the user hasn't logged in.
        const authUser = useAuthStore.getState().user;
        if (!authUser) {
          invoke('send_notification', {
            title: 'Hat — Entre para usar',
            body: 'Faça login com Google na aba Conta para processar o clipboard.',
          }).catch(() => {});
          setProc(false);
          return;
        }
        const { getIdToken } = await import('./services/auth/firebase');
        const hatToken = await getIdToken();
        if (!hatToken) {
          invoke('send_notification', {
            title: 'Hat — Sessão expirada',
            body: 'Entre de novo na aba Conta para continuar.',
          }).catch(() => {});
          setProc(false);
          return;
        }
        const hatMode = useCreditsStore.getState().selectedMode;
        const provider = 'Hat';
        const model = AI_MODES.find((m) => m.id === hatMode)?.label ?? 'Hat';

        // Clipboard blinda o system prompt: MCQ → letra só, dissertativa →
        // resposta completa sem padding.
        const systemPrompt =
          CLIPBOARD_SYSTEM_PROMPTS[settings.language] ?? CLIPBOARD_SYSTEM_PROMPTS['pt-BR'];

        // If only image and no text, provide a default prompt
        const messageText = clipText || 'Descreva e analise esta imagem.';

        // Budget dinâmico por tipo de pergunta. MCQ precisa de poucos
        // tokens (64 é sobra); dissertativa precisa de 2048 pra responder
        // completo. Antes era 400 pra tudo → dissertativa vinha truncada.
        const clipboardIntent = detectClipboardIntent(clipText);
        const clipboardMaxTokens = maxTokensForIntent(clipboardIntent);
        const roomState = useRoomStore.getState();
        const activeRoom = roomState.rooms.find((room) => room.id === roomState.activeRoomId) ?? null;
        const activeRoomMemberCount = roomState.members.length || activeRoom?.memberCount || 0;
        const shouldShareRoom =
          Boolean(activeRoom && activeRoom.status === 'open' && activeRoomMemberCount > 1);
        const sourceMessageId = crypto.randomUUID();

	        let response = '';
	        let hasReceivedContent = false;
	        const streamId = nextStreamId();
	        let flashTypewriterArmed = false;
	        const sendResponseNotification = (finalResponse: string) => {
	          const notifications = useSettingsStore.getState().settings.notifications;
	          if (!notifications.enabled || !notifications.showResponseNotification) return;
	          const notifBody = finalResponse.length > 500
	            ? finalResponse.slice(0, 500) + '...'
	            : finalResponse;
	          invoke('send_notification', {
	            title: clip.copyResponseToClipboard ? 'Hat — Copiado para clipboard' : 'Hat — Resposta',
	            body: notifBody,
	          }).catch((e) => console.error('[notification] response failed:', e));
	        };

	        chunkUnlisten = await listen<{ streamId: number; text: string; isFinished: boolean; contentType?: string }>(
          'chat-stream',
          (event) => {
            // Filter by streamId so we don't pick up chunks from other concurrent streams.
            if (event.payload.streamId !== streamId) return;
            if (event.payload.text && !event.payload.isFinished && event.payload.contentType !== 'thinking') {
              response += event.payload.text;
              hasReceivedContent = true;
            }
            if (event.payload.isFinished) {
              if (hasReceivedContent && response) {
                // Char truncation applies to MCQ only. Dissertative answers
                // need to land complete in clipboard/history — reported
                // 2026-04-23 that the default 4096-char cap was clipping
                // long answers with "..." mid-paragraph even after the
                // token budget was raised. Flash still uses its own
                // `previewLength` for the on-screen preview, so stealth
                // isn't affected.
                const maxLen = clip.maxResponseLength || 4096;
                const shouldCharTruncate =
                  clipboardIntent === 'mcq' && response.length > maxLen;
                const finalResponse = shouldCharTruncate
                  ? response.slice(0, maxLen) + '...'
                  : response;

                // Copy to clipboard (text response only)
                if (clip.copyResponseToClipboard) {
                  const textToWrite = clip.appendMode && clipText
                    ? `${clipText}\n\n---\n\n${finalResponse}`
                    : finalResponse;
                  writeText(textToWrite)
                    .catch((e) => console.error('[clipboard] writeText failed:', e));
                }

                // Response delivery: Flash Mode replaces the system notification
                // when enabled (typewriter streams are pre-armed before
	                // stream_chat_hat, so we only show non-typewriter modes here).
	                const currentFlash = useSettingsStore.getState().settings.clipboard.flash;
	                if (currentFlash.enabled) {
	                  if (currentFlash.timing.mode !== 'typewriter') {
	                    const preview = finalResponse.slice(0, currentFlash.previewLength);
	                    showFlashWindow({
	                      text: preview,
	                      position: currentFlash.position,
	                      timing: currentFlash.timing,
	                      appearance: currentFlash.appearance,
	                      streamId,
	                    }, { waitForReady: true }).then((shown) => {
	                      if (!shown) sendResponseNotification(finalResponse);
	                    });
	                  } else if (!flashTypewriterArmed) {
	                    sendResponseNotification(finalResponse);
	                  }
	                } else {
	                  sendResponseNotification(finalResponse);
	                }

                // Save to clipboard history (with images if present)
                useClipboardStore.getState().addEntry({
                  id: sourceMessageId,
                  originalText: clipText || '(imagem)',
                  response: finalResponse,
                  timestamp: Date.now(),
                  provider,
                  model,
                  ...(clipImages.length > 0 ? { images: clipImages } : {}),
                });

                // Sound
                if (clip.soundOnComplete) {
                  try {
                    const ctx = new AudioContext();
                    const osc = ctx.createOscillator();
                    const g = ctx.createGain();
                    osc.connect(g); g.connect(ctx.destination);
                    osc.frequency.value = 880; g.gain.value = 0.08;
                    osc.start(); osc.stop(ctx.currentTime + 0.12);
                  } catch {}
                }
              } else {
                // Error: isFinished without prior content — backend sent error text.
                // NEVER show the raw `error:<code>:...` wire string: it reveals
                // upstream model names ("Gemini 503") and HTTP details. Run it
                // through the same sanitizer the chat flow uses.
                const errorNotif = useSettingsStore.getState().settings.notifications;
                if (errorNotif.enabled && errorNotif.showErrorNotification) {
                  const safeBody = sanitizeBackendError(event.payload.text || '');
                  invoke('send_notification', { title: 'Hat — Erro', body: safeBody })
                    .catch((e) => console.error('[notification] stream-error failed:', e));
                }
              }

              chunkUnlisten?.();
              chunkUnlisten = null;
              setProc(false);
            }
          },
        );

	        // Typewriter flash mode: pre-show the (empty) flash window now so the
	        // FlashPage's chat-stream listener is mounted before chunks start.
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
          // Cap dinâmico por intent (ver detectClipboardIntent).
          // `maxResponseLength` segue governando só o truncamento de
          // caracteres pós-stream.
          maxTokens: clipboardMaxTokens,
          images: clipImages,
          roomId: shouldShareRoom ? activeRoom?.id : null,
          roomShare: shouldShareRoom,
          sourceMessageId: shouldShareRoom ? sourceMessageId : null,
          idToken: hatToken,
          idempotencyKey: crypto.randomUUID(),
        });
      } catch (e) {
        console.error('Clipboard processing failed:', e);
        if (chunkUnlisten) {
          chunkUnlisten();
          chunkUnlisten = null;
        }
        const catchNotif = useSettingsStore.getState().settings.notifications;
        if (catchNotif.enabled && catchNotif.showErrorNotification) {
          invoke('send_notification', { title: 'Hat — Erro', body: 'Falha ao processar clipboard.' })
            .catch((e) => console.error('[notification] processing-error failed:', e));
        }
        setProc(false);
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, [isMainWindow, isTauri]);

  return (
    <>
      {/* Splash screen — dramatic entrance with animated gradient logo */}
      <AnimatePresence>
        {showSplash && (
          <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: 'easeInOut' }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-primary)',
              overflow: 'hidden',
            }}
          >
            {/* Ambient glow */}
            <motion.div
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: 0.35, scale: 1.5 }}
              transition={{ duration: 2, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                width: 220,
                height: 220,
                borderRadius: '50%',
                background: 'radial-gradient(circle, var(--color-accent) 0%, transparent 70%)',
                filter: 'blur(60px)',
              }}
            />
            {/* Secondary glow pulse */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.2, 0.1, 0.25, 0.1] }}
              transition={{ duration: 3, ease: 'easeInOut' }}
              style={{
                position: 'absolute',
                width: 350,
                height: 350,
                borderRadius: '50%',
                background: 'radial-gradient(circle, var(--color-accent-hover) 0%, transparent 60%)',
                filter: 'blur(80px)',
              }}
            />

            {/* Horse logo with entrance animation */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 180, damping: 16, delay: 0.15 }}
              style={{ position: 'relative', zIndex: 1 }}
            >
              <HorseLogo size={130} animated />
            </motion.div>

            {/* App name */}
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.7, ease: 'easeOut' }}
              style={{
                position: 'relative',
                zIndex: 1,
                marginTop: 20,
                fontSize: 32,
                fontWeight: 800,
                letterSpacing: -1,
                color: 'var(--text-bright)',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              }}
            >
              Hat
            </motion.h1>

            {/* Tagline */}
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 0.5, y: 0 }}
              transition={{ delay: 0.7, duration: 0.6, ease: 'easeOut' }}
              style={{
                position: 'relative',
                zIndex: 1,
                marginTop: 6,
                fontSize: 13,
                color: 'var(--text-muted)',
                letterSpacing: 2,
                textTransform: 'uppercase',
              }}
            >
              Assistente IA
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/main" element={<MainPage />} />
          <Route path="/popover" element={<PopoverPage />} />
          <Route path="/flash" element={<FlashPage />} />
          <Route path="*" element={<Navigate to="/main" replace />} />
        </Routes>
      </Suspense>
      <Suspense fallback={null}>
        <ThemeUnlockCelebration />
      </Suspense>
      <ToastContainer />
    </>
  );
}

export default App;
