import { useState, useCallback } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { useSettingsStore } from '../stores/settingsStore';
import { useConversationStore } from '../stores/conversationStore';

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';

export function useUpdater() {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [newVersion, setNewVersion] = useState<string | null>(null);

  const checkForUpdates = useCallback(async () => {
    setStatus('checking');
    setError(null);

    try {
      const update = await check();

      if (update) {
        setNewVersion(update.version);
        setStatus('available');
        return update;
      } else {
        setStatus('idle');
        return null;
      }
    } catch (e) {
      setError(String(e));
      setStatus('error');
      return null;
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    setStatus('checking');

    try {
      const update = await check();
      if (!update) {
        setStatus('idle');
        return;
      }

      setStatus('downloading');
      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength ?? 0;
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              setProgress(Math.round((downloaded / contentLength) * 100));
            }
            break;
          case 'Finished':
            setStatus('ready');
            break;
        }
      });

      setStatus('ready');
      // Flush ALL stores before relaunching to prevent data loss
      await useSettingsStore.getState().saveSettings();
      await useConversationStore.getState().saveConversations();
      await relaunch();
    } catch (e) {
      setError(String(e));
      setStatus('error');
    }
  }, []);

  return {
    status,
    progress,
    error,
    newVersion,
    checkForUpdates,
    downloadAndInstall,
  };
}
