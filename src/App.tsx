import { useEffect, useRef, useCallback, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { listen, emit } from '@tauri-apps/api/event';
import { readText, writeText, readImage } from '@tauri-apps/plugin-clipboard-manager';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import { AnimatePresence, motion } from 'framer-motion';
import MainPage from './pages/MainPage';
import PopoverPage from './pages/PopoverPage';
import FlashPage from './pages/FlashPage';
import HorseLogo from './components/Shared/HorseLogo';
import ToastContainer from './components/Shared/ToastContainer';
import ThemeUnlockCelebration from './components/Settings/ThemeUnlockCelebration';
import { useSettingsStore, setupSettingsSync } from './stores/settingsStore';
import { useChatStore } from './stores/chatStore';
import { useConversationStore, flushPendingSave } from './stores/conversationStore';
import { useClipboardStore } from './stores/clipboardStore';
import { useDraftsStore } from './stores/draftsStore';
import { useAuthStore } from './stores/authStore';
import { useCreditsStore } from './stores/creditsStore';
import { nextStreamId } from './services/ai';
import { getIdToken } from './services/auth/firebase';
import { startAutoUpdater } from './services/autoUpdater';
import { AI_MODES } from './types/account';

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

function App() {
  const location = useLocation();
  const isMainWindow = location.pathname === '/main' || location.pathname === '/';
  const [showSplash, setShowSplash] = useState(isMainWindow);

  // Auto-dismiss splash after 2s (then 1s fade-out via AnimatePresence)
  useEffect(() => {
    if (!showSplash) return;
    const timer = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(timer);
  }, [showSplash]);

  const theme = useSettingsStore((s) => s.settings.theme);
  const shortcuts = useSettingsStore((s) => s.settings.shortcuts);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    (async () => {
      await loadSettings();
      await Promise.all([
        useConversationStore.getState().loadConversations(),
        useDraftsStore.getState().loadDrafts(),
      ]);
    })();
    setupSettingsSync();
    useClipboardStore.getState().loadEntries();

    // Auto-updater: initial check 30s after launch, then every 5 min.
    // Only arm it on the main window so multi-window scenarios don't run
    // the 5-min cycle N times in parallel.
    if (getCurrentWindow().label === 'main') {
      startAutoUpdater();
      // Pre-create the (hidden) flash window so typewriter mode has a live
      // webview listening to `chat-stream` before the first stream begins.
      invoke('flash_ensure').catch((e) => console.error('[flash] ensure failed:', e));
    }

    // Flush pending saves on window close to prevent data loss
    let unlistenClose: (() => void) | undefined;
    getCurrentWindow().onCloseRequested(async () => {
      flushPendingSave();
      await useConversationStore.getState().saveConversations();
    }).then((unlisten) => { unlistenClose = unlisten; });

    return () => {
      unlistenClose?.();
    };
  }, [loadSettings]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Global shortcut registration via JS API (handles CommandOrControl correctly per platform)
  // Only in the main window — each Tauri window boots its own App instance, and
  // double-registering the same accelerator races on Linux/Windows (the second
  // call clobbers the first handler) and spawns duplicate listeners on macOS.
  const registeredShortcuts = useRef<{ clipboard: string; floatingChat: string; adjustFlashPosition: string; emergencyQuit: string }>({ clipboard: '', floatingChat: '', adjustFlashPosition: '', emergencyQuit: '' });
  useEffect(() => {
    if (!isMainWindow) return;
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
          await register(clipShortcut, () => {
            emit('process-clipboard');
          });
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
          await register(floatingChatShortcut, () => {
            const now = Date.now();
            if (now - lastToggleTime > 400) {
              lastToggleTime = now;
              invoke('toggle_popover_window').catch(() => {});
            }
          });
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
          await register(adjustFlashShortcut, () => {
            const pos = useSettingsStore.getState().settings.clipboard.flash.position;
            invoke('flash_enter_adjust_mode', {
              position: { x: pos.x, y: pos.y },
            }).catch((e) => console.error('[flash] enter adjust via shortcut failed:', e));
          });
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
          await register(emergencyQuitShortcut, async () => {
            try {
              flushPendingSave();
              await useConversationStore.getState().saveConversations();
              await useSettingsStore.getState().saveSettings();
            } catch (e) {
              console.error('[emergency-quit] flush failed:', e);
            }
            invoke('quit_app').catch(() => {});
          });
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
  }, [shortcuts.clipboard, shortcuts.floatingChat, shortcuts.adjustFlashPosition, shortcuts.emergencyQuit, isMainWindow]);

  // Flash position persistence — listens for the save event emitted by the
  // /flash route in adjust mode. Global so it works whether the user triggered
  // adjust from Settings or via the global shortcut.
  useEffect(() => {
    if (!isMainWindow) return;
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
  }, [isMainWindow]);

  // Tray menu events
  useEffect(() => {
    const unlistenNew = listen('new-conversation', () => {
      useChatStore.getState().clearMessages();
      useConversationStore.getState().createConversation();
    });
    const unlistenSettings = listen('open-settings', () => {
      useSettingsStore.getState().setShowSettingsPanel(true);
    });
    const unlistenUpdates = listen('check-updates', async () => {
      try {
        const { check } = await import('@tauri-apps/plugin-updater');
        const update = await check();
        if (update) {
          await update.downloadAndInstall();
          // Flush settings to disk before relaunching to preserve API keys
          await useSettingsStore.getState().saveSettings();
          const { relaunch } = await import('@tauri-apps/plugin-process');
          await relaunch();
        } else {
          const { notifications } = useSettingsStore.getState().settings;
          if (notifications.enabled && notifications.showUpdateNotification) {
            invoke('send_notification', { title: 'Hat', body: 'Você já está na versão mais recente!' })
              .catch((e) => console.error('[notification] update-check failed:', e));
          }
        }
      } catch (e) {
        console.error('Update check failed:', e);
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
  }, []);

  // Dynamic tray menu sync — rebuild when settings, conversations or streaming state change
  const rebuildTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rebuildTrayMenu = useCallback(() => {
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

      invoke('rebuild_tray_menu', {
        state: { providerLabel, isProcessing, recentConversations },
      }).catch(() => {});
    }, 300);
  }, []);

  useEffect(() => {
    // Subscribe to store changes and rebuild tray menu
    const unsubSettings = useSettingsStore.subscribe(rebuildTrayMenu);
    const unsubConversations = useConversationStore.subscribe(rebuildTrayMenu);
    let prevStreaming = useChatStore.getState().isStreaming;
    const unsubChat = useChatStore.subscribe((state) => {
      if (state.isStreaming !== prevStreaming) {
        prevStreaming = state.isStreaming;
        rebuildTrayMenu();
        invoke('set_tray_icon', { iconState: state.isStreaming ? 'processing' : 'idle' }).catch(() => {});
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
  }, [rebuildTrayMenu]);

  // Clipboard processing — core feature
  // Flow: user copies text/image → presses shortcut → AI processes → notification with response
  // Gated to the main window: Tauri broadcasts `process-clipboard` to every webview,
  // and without this gate the hidden analysis window also ran the full pipeline, producing
  // two "Processando" + two "Resposta" notifications per trigger on every OS.
  useEffect(() => {
    if (!isMainWindow) return;
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

        const systemPrompt = clip.useCustomPrompt && clip.customPrompt
          ? clip.customPrompt
          : settings.systemPrompt;

        // If only image and no text, provide a default prompt
        const messageText = clipText || 'Descreva e analise esta imagem.';

        let response = '';
        let hasReceivedContent = false;
        const streamId = nextStreamId();

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
                // Truncate if configured
                const maxLen = clip.maxResponseLength || 4096;
                const finalResponse = response.length > maxLen ? response.slice(0, maxLen) + '...' : response;

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
                const currentNotif = useSettingsStore.getState().settings.notifications;
                const currentFlash = useSettingsStore.getState().settings.clipboard.flash;
                if (currentFlash.enabled) {
                  if (currentFlash.timing.mode !== 'typewriter') {
                    const preview = finalResponse.slice(0, currentFlash.previewLength);
                    invoke('flash_show', {
                      text: preview,
                      position: currentFlash.position,
                      timing: currentFlash.timing,
                      appearance: currentFlash.appearance,
                      streamId,
                    }).catch((e) => console.error('[flash] show failed:', e));
                  }
                } else if (currentNotif.enabled && currentNotif.showResponseNotification) {
                  const notifBody = finalResponse.length > 500
                    ? finalResponse.slice(0, 500) + '...'
                    : finalResponse;
                  invoke('send_notification', {
                    title: clip.copyResponseToClipboard ? 'Hat — Copiado para clipboard' : 'Hat — Resposta',
                    body: notifBody,
                  }).catch((e) => console.error('[notification] response failed:', e));
                }

                // Save to clipboard history (with images if present)
                useClipboardStore.getState().addEntry({
                  id: crypto.randomUUID(),
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
                // Error: isFinished without prior content — backend sent error text
                const errorNotif = useSettingsStore.getState().settings.notifications;
                if (errorNotif.enabled && errorNotif.showErrorNotification) {
                  const errorMsg = event.payload.text || 'Erro desconhecido';
                  invoke('send_notification', { title: 'Hat — Erro', body: errorMsg })
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
          invoke('flash_show', {
            text: '',
            position: clip.flash.position,
            timing: clip.flash.timing,
            appearance: clip.flash.appearance,
            streamId,
          }).catch((e) => console.error('[flash] typewriter pre-show failed:', e));
        }

        await invoke('stream_chat_hat', {
          streamId,
          messages: [{ role: 'user', textContent: messageText }],
          systemPrompt,
          mode: hatMode,
          temperature: settings.temperature,
          maxTokens: clip.maxResponseLength || settings.maxTokens,
          images: clipImages,
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
  }, [isMainWindow]);

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
                fontFamily: "'General Sans', -apple-system, sans-serif",
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

      <Routes>
        <Route path="/main" element={<MainPage />} />
        <Route path="/popover" element={<PopoverPage />} />
        <Route path="/flash" element={<FlashPage />} />
        <Route path="*" element={<Navigate to="/main" replace />} />
      </Routes>

      <ToastContainer />
      <ThemeUnlockCelebration />
    </>
  );
}

export default App;
