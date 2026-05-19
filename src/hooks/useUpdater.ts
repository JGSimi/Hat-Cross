import { useState, useCallback } from 'react';
import {
  checkForUpdates as checkForUpdatesService,
  installAvailableUpdate,
} from '../services/autoUpdater';

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
      const result = await checkForUpdatesService('settings');
      if (result.status === 'available') {
        setNewVersion(result.version);
        setStatus('available');
        return result;
      }
      setStatus('idle');
      return null;
    } catch (e) {
      setError(String(e));
      setStatus('error');
      return null;
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    setStatus('checking');

    try {
      const result = await checkForUpdatesService('settings');
      if (result.status !== 'available') {
        setStatus('idle');
        return;
      }

      setStatus('downloading');
      let downloaded = 0;
      let contentLength = 0;

      await installAvailableUpdate('settings', (event) => {
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
