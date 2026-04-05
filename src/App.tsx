import { useEffect, useRef, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { listen } from '@tauri-apps/api/event';
import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';
import { invoke } from '@tauri-apps/api/core';
import MainPage from './pages/MainPage';
import QuickInputPage from './pages/QuickInputPage';
import AnalysisPage from './pages/AnalysisPage';
import { useSettingsStore } from './stores/settingsStore';
import { useChatStore } from './stores/chatStore';
import { useConversationStore } from './stores/conversationStore';

function App() {
  const theme = useSettingsStore((s) => s.settings.theme);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

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
          invoke('send_notification', { title: 'Hat', body: 'Você já está na versão mais recente!' }).catch(() => {});
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
  // Flow: user copies text → presses shortcut → AI processes → notification with response
  useEffect(() => {
    const unlisten = listen('process-clipboard', async () => {
      try {
        const { settings, providerConfigs } = useSettingsStore.getState();
        const clip = settings.clipboard;

        if (!clip.enabled) return;

        const clipText = await readText();
        if (!clipText) {
          invoke('send_notification', { title: 'Hat', body: 'Clipboard vazio.' }).catch(() => {});
          return;
        }

        // Notify processing started
        const preview = clipText.length > 80 ? clipText.slice(0, 80) + '...' : clipText;
        invoke('send_notification', { title: 'Hat — Processando', body: preview }).catch(() => {});

        const isLocal = settings.inferenceMode === 'local';
        const provider = isLocal ? 'ollama' : settings.cloudProvider;
        const cfg = isLocal ? null : providerConfigs[settings.cloudProvider];
        const endpoint = isLocal ? 'http://localhost:11434' : cfg?.endpoint || '';
        const model = isLocal ? settings.localModel : cfg?.model || '';

        const systemPrompt = clip.useCustomPrompt && clip.customPrompt
          ? clip.customPrompt
          : settings.systemPrompt;

        let response = '';
        const chunkUnlisten = await listen<{ text: string; isFinished: boolean }>(
          'chat-stream',
          (event) => {
            if (event.payload.text) response += event.payload.text;
            if (event.payload.isFinished && response) {
              // Truncate if configured
              const maxLen = clip.maxResponseLength || 4096;
              const finalResponse = response.length > maxLen ? response.slice(0, maxLen) + '...' : response;

              // Copy to clipboard
              if (clip.copyResponseToClipboard) {
                const textToWrite = clip.appendMode
                  ? `${clipText}\n\n---\n\n${finalResponse}`
                  : finalResponse;
                writeText(textToWrite).catch(() => {});
              }

              // Notification with full response text
              if (clip.showNotificationWithResponse) {
                const notifBody = finalResponse.length > 500
                  ? finalResponse.slice(0, 500) + '...'
                  : finalResponse;
                invoke('send_notification', {
                  title: clip.copyResponseToClipboard ? 'Hat — Copiado para clipboard' : 'Hat — Resposta',
                  body: notifBody,
                }).catch(() => {});
              }

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

              chunkUnlisten();
            }
          },
        );

        await invoke('stream_chat', {
          messages: [{ role: 'user', textContent: clipText }],
          systemPrompt,
          provider, endpoint, model,
          temperature: settings.temperature,
          maxTokens: clip.maxResponseLength || settings.maxTokens,
          images: [],
        });
      } catch (e) {
        console.error('Clipboard processing failed:', e);
        invoke('send_notification', { title: 'Hat — Erro', body: 'Falha ao processar clipboard.' }).catch(() => {});
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  return (
    <Routes>
      <Route path="/main" element={<MainPage />} />
      <Route path="/quickinput" element={<QuickInputPage />} />
      <Route path="/analysis" element={<AnalysisPage />} />
      <Route path="*" element={<Navigate to="/main" replace />} />
    </Routes>
  );
}

export default App;
