import { useEffect, useRef, useCallback, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { listen, emit } from '@tauri-apps/api/event';
import { readText, writeText, readImage } from '@tauri-apps/plugin-clipboard-manager';
import { invoke } from '@tauri-apps/api/core';
import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import { AnimatePresence, motion } from 'framer-motion';
import MainPage from './pages/MainPage';
import AnalysisPage from './pages/AnalysisPage';
import PopoverPage from './pages/PopoverPage';
import HorseLogo from './components/Shared/HorseLogo';
import ToastContainer from './components/Shared/ToastContainer';
import { useSettingsStore } from './stores/settingsStore';
import { useChatStore } from './stores/chatStore';
import { useConversationStore } from './stores/conversationStore';
import { useClipboardStore } from './stores/clipboardStore';
import { nextStreamId } from './services/ai';

/** Normalize legacy shortcut format (CmdOrCtrl → CommandOrControl) */
function normalizeShortcut(s: string): string {
  return s.replace(/CmdOrCtrl/g, 'CommandOrControl');
}

function App() {
  const location = useLocation();
  const isMainWindow = location.pathname === '/main' || location.pathname === '/';
  const perfSettings = useSettingsStore.getState().settings.performance;
  const [showSplash, setShowSplash] = useState(isMainWindow && !perfSettings?.disableSplashScreen);

  // Auto-dismiss splash after 2s (then 1s fade-out via AnimatePresence)
  useEffect(() => {
    if (!showSplash) return;
    const timer = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(timer);
  }, [showSplash]);

  const theme = useSettingsStore((s) => s.settings.theme);
  const shortcuts = useSettingsStore((s) => s.settings.shortcuts);
  const appearance = useSettingsStore((s) => s.settings.appearance);
  const performance = useSettingsStore((s) => s.settings.performance);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    loadSettings();
    useConversationStore.getState().loadConversations();
    useClipboardStore.getState().loadEntries();
  }, [loadSettings]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Apply appearance & performance settings as CSS vars and data attributes
  useEffect(() => {
    const el = document.documentElement;
    // Appearance
    if (appearance) {
      el.style.setProperty('--font-scale', String(appearance.fontScale ?? 1));
      el.style.setProperty('--bubble-opacity', String(appearance.messageBubbleOpacity ?? 1));
      el.style.setProperty('--ui-opacity', String(appearance.uiOpacity ?? 1));
      el.style.setProperty('--sidebar-width', `${appearance.sidebarWidth ?? 220}px`);
      el.setAttribute('data-bg-style', appearance.backgroundStyle ?? 'default');
      if (appearance.backgroundStyle === 'custom' || appearance.backgroundStyle === 'solid') {
        el.style.setProperty('--bg-override', appearance.customBackground ?? '#0C0C0E');
      }
    }
    // Performance
    if (performance) {
      el.setAttribute('data-reduce-motion', String(!!performance.reducedMotion));
      el.setAttribute('data-disable-blur', String(!!performance.disableBlur));
      el.setAttribute('data-disable-gradients', String(!!performance.disableAnimatedGradients));
    }
  }, [appearance, performance]);

  // Global shortcut registration via JS API (handles CommandOrControl correctly per platform)
  const registeredShortcuts = useRef<{ clipboard: string; screenCapture: string; floatingChat: string }>({ clipboard: '', screenCapture: '', floatingChat: '' });
  useEffect(() => {
    const prev = registeredShortcuts.current;

    async function registerShortcuts() {
      const clipShortcut = normalizeShortcut(shortcuts.clipboard);
      const captureShortcut = normalizeShortcut(shortcuts.screenCapture);
      const floatingChatShortcut = normalizeShortcut(shortcuts.floatingChat);

      // Unregister old shortcuts if they changed
      if (prev.clipboard && prev.clipboard !== clipShortcut) {
        try { await unregister(prev.clipboard); } catch {}
      }
      if (prev.screenCapture && prev.screenCapture !== captureShortcut) {
        try { await unregister(prev.screenCapture); } catch {}
      }
      if (prev.floatingChat && prev.floatingChat !== floatingChatShortcut) {
        try { await unregister(prev.floatingChat); } catch {}
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

      // Register screen capture shortcut
      if (captureShortcut && captureShortcut !== prev.screenCapture) {
        try {
          await register(captureShortcut, () => {
            invoke('open_analysis_window').catch(() => {});
          });
          prev.screenCapture = captureShortcut;
        } catch (e) {
          console.error('Failed to register screen capture shortcut:', e);
          prev.screenCapture = '';
        }
      }

      // Register floating chat shortcut
      if (floatingChatShortcut && floatingChatShortcut !== prev.floatingChat) {
        try {
          await register(floatingChatShortcut, () => {
            invoke('toggle_popover_window').catch(() => {});
          });
          prev.floatingChat = floatingChatShortcut;
        } catch (e) {
          console.error('Failed to register floating chat shortcut:', e);
          prev.floatingChat = '';
        }
      }
    }

    registerShortcuts();

    return () => {
      if (prev.clipboard) { unregister(prev.clipboard).catch(() => {}); prev.clipboard = ''; }
      if (prev.screenCapture) { unregister(prev.screenCapture).catch(() => {}); prev.screenCapture = ''; }
      if (prev.floatingChat) { unregister(prev.floatingChat).catch(() => {}); prev.floatingChat = ''; }
    };
  }, [shortcuts.clipboard, shortcuts.screenCapture, shortcuts.floatingChat]);

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
            invoke('send_notification', { title: 'Hat', body: 'Você já está na versão mais recente!' }).catch(() => {});
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
      const { settings, providerConfigs } = useSettingsStore.getState();
      const isLocal = settings.inferenceMode === 'local';
      const provider = isLocal ? 'Ollama' : settings.cloudProvider.charAt(0).toUpperCase() + settings.cloudProvider.slice(1);
      const cfg = isLocal ? null : providerConfigs[settings.cloudProvider];
      const model = isLocal ? (settings.localModel || 'local') : (cfg?.model || '');
      const providerLabel = `${provider} — ${model}`;

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
  useEffect(() => {
    let isProcessing = false;

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
      isProcessing = true;

      let chunkUnlisten: (() => void) | null = null;

      try {
        const { settings, providerConfigs } = useSettingsStore.getState();
        const clip = settings.clipboard;

        if (!clip.enabled) { isProcessing = false; return; }

        // Read text and (optionally) image from clipboard
        let clipText = '';
        const clipImages: string[] = [];

        try {
          clipText = await readText() || '';
        } catch {
          // readText can throw if clipboard has non-text content
        }

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
            invoke('send_notification', { title: 'Hat', body: 'Clipboard vazio.' }).catch(() => {});
          }
          isProcessing = false;
          return;
        }

        // Notify processing started
        if (settings.notifications.enabled && settings.notifications.showProcessingNotification) {
          const hasImage = clipImages.length > 0;
          const preview = clipText
            ? (clipText.length > 80 ? clipText.slice(0, 80) + '...' : clipText)
            : '(imagem)';
          const title = hasImage && clipText ? 'Hat — Processando texto + imagem' :
                        hasImage ? 'Hat — Processando imagem' :
                        'Hat — Processando';
          invoke('send_notification', { title, body: preview }).catch(() => {});
        }

        const isLocal = settings.inferenceMode === 'local';
        const provider = isLocal ? 'ollama' : settings.cloudProvider;
        const cfg = isLocal ? null : providerConfigs[settings.cloudProvider];
        const endpoint = isLocal ? 'http://localhost:11434' : cfg?.endpoint || '';
        const model = isLocal ? settings.localModel : cfg?.model || '';

        const systemPrompt = clip.useCustomPrompt && clip.customPrompt
          ? clip.customPrompt
          : settings.systemPrompt;

        // If only image and no text, provide a default prompt
        const messageText = clipText || 'Descreva e analise esta imagem.';

        let response = '';
        let hasReceivedContent = false;
        const streamId = nextStreamId();

        chunkUnlisten = await listen<{ streamId: number; text: string; isFinished: boolean }>(
          'chat-stream',
          (event) => {
            // Filter by streamId so we don't pick up chunks from other concurrent streams.
            if (event.payload.streamId !== streamId) return;
            if (event.payload.text && !event.payload.isFinished) {
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
                  writeText(textToWrite).catch(() => {});
                }

                // Notification with full response text
                const currentNotif = useSettingsStore.getState().settings.notifications;
                if (currentNotif.enabled && currentNotif.showResponseNotification) {
                  const notifBody = finalResponse.length > 500
                    ? finalResponse.slice(0, 500) + '...'
                    : finalResponse;
                  invoke('send_notification', {
                    title: clip.copyResponseToClipboard ? 'Hat — Copiado para clipboard' : 'Hat — Resposta',
                    body: notifBody,
                  }).catch(() => {});
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
                  invoke('send_notification', { title: 'Hat — Erro', body: errorMsg }).catch(() => {});
                }
              }

              chunkUnlisten?.();
              chunkUnlisten = null;
              isProcessing = false;
            }
          },
        );

        await invoke('stream_chat', {
          streamId,
          messages: [{ role: 'user', textContent: messageText }],
          systemPrompt,
          provider, endpoint, model,
          temperature: settings.temperature,
          maxTokens: clip.maxResponseLength || settings.maxTokens,
          images: clipImages,
        });
      } catch (e) {
        console.error('Clipboard processing failed:', e);
        if (chunkUnlisten) {
          chunkUnlisten();
          chunkUnlisten = null;
        }
        const catchNotif = useSettingsStore.getState().settings.notifications;
        if (catchNotif.enabled && catchNotif.showErrorNotification) {
          invoke('send_notification', { title: 'Hat — Erro', body: 'Falha ao processar clipboard.' }).catch(() => {});
        }
        isProcessing = false;
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

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
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/popover" element={<PopoverPage />} />
        <Route path="*" element={<Navigate to="/main" replace />} />
      </Routes>

      <ToastContainer />
    </>
  );
}

export default App;
