import { useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

export function useSettings() {
  const { settings, _hydrated, loadSettings, updateSettings } = useSettingsStore();

  useEffect(() => {
    if (!_hydrated) {
      loadSettings();
    }
  }, [_hydrated, loadSettings]);

  return {
    settings,
    loaded: _hydrated,
    updateSettings: async (partial: Parameters<typeof updateSettings>[0]) => {
      updateSettings(partial);
    },
  };
}
