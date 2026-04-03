import { useEffect } from 'react';
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
      // MainLayout handles this
    });
    const unlistenUpdates = listen('check-updates', async () => {
      try {
        const { check } = await import('@tauri-apps/plugin-updater');
        const update = await check();
        if (update) {
          await update.downloadAndInstall();
          const { relaunch } = await import('@tauri-apps/plugin-process');
          await relaunch();
        } else {
          invoke('send_notification', {
            title: 'Hat',
            body: 'Você já está na versão mais recente!',
          }).catch(() => {});
        }
      } catch (e) {
        console.error('Update check failed:', e);
      }
    });
    return () => {
      unlistenNew.then(fn => fn());
      unlistenSettings.then(fn => fn());
      unlistenUpdates.then(fn => fn());
    };
  }, []);

  // Clipboard processing
  useEffect(() => {
    const unlisten = listen('process-clipboard', async () => {
      try {
        const clipText = await readText();
        if (!clipText) return;

        const { settings, providerConfigs } = useSettingsStore.getState();
        const isLocal = settings.inferenceMode === 'local';
        const provider = isLocal ? 'ollama' : settings.cloudProvider;
        const cfg = isLocal ? null : providerConfigs[settings.cloudProvider];
        const endpoint = isLocal ? 'http://localhost:11434' : cfg?.endpoint || '';
        const model = isLocal ? settings.localModel : cfg?.model || '';

        let response = '';
        const chunkUnlisten = await listen<{ text: string; isFinished: boolean }>(
          'chat-stream',
          (event) => {
            if (event.payload.text) response += event.payload.text;
            if (event.payload.isFinished && response) {
              writeText(response).catch(() => {});
              invoke('send_notification', {
                title: 'Hat',
                body: 'Resposta copiada para a area de transferencia',
              }).catch(() => {});
              chunkUnlisten();
            }
          },
        );

        await invoke('stream_chat', {
          messages: [{ role: 'user', textContent: clipText }],
          systemPrompt: settings.systemPrompt,
          provider, endpoint, model,
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
          images: [],
        });
      } catch (e) {
        console.error('Clipboard processing failed:', e);
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
