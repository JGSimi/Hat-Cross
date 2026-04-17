import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Palette } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import SettingsCard from './SettingsCard';
import ThemePicker from '../ThemePicker';
import { SubHeading, SettingRow, Toggle } from './primitives';
import { useSettingsStore } from '../../../stores/settingsStore';
import { THEME_PRESETS } from '../../../types';

type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'uptodate' | 'error';

export default function AppearanceCard() {
  const { settings, updateSettings, setTheme } = useSettingsStore();
  const [version, setVersion] = useState('');
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
  const [updateProgress, setUpdateProgress] = useState(0);

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion('2.0.0'));
  }, []);

  const themeLabel = THEME_PRESETS.find((t) => t.name === settings.theme)?.label ?? settings.theme;

  const handleCheckUpdate = async () => {
    setUpdateStatus('checking');
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update) {
        setUpdateStatus('downloading');
        let downloaded = 0;
        let contentLength = 0;
        await update.downloadAndInstall((event) => {
          if (event.event === 'Started') contentLength = event.data.contentLength ?? 0;
          if (event.event === 'Progress') {
            downloaded += event.data.chunkLength;
            if (contentLength > 0) setUpdateProgress(Math.round((downloaded / contentLength) * 100));
          }
        });
        await useSettingsStore.getState().saveSettings();
        const { relaunch } = await import('@tauri-apps/plugin-process');
        await relaunch();
      } else {
        setUpdateStatus('uptodate');
        setTimeout(() => setUpdateStatus('idle'), 3000);
      }
    } catch (e) {
      console.error('Update check failed:', e);
      setUpdateStatus('error');
      setTimeout(() => setUpdateStatus('idle'), 3000);
    }
  };

  return (
    <SettingsCard
      title="Aparência"
      icon={<Palette size={14} strokeWidth={2} />}
      preview={themeLabel}
    >
      <SubHeading>Tema</SubHeading>
      <ThemePicker current={settings.theme} onChange={setTheme} />

      <SubHeading>Sistema</SubHeading>
      <SettingRow label="Iniciar com o sistema">
        <Toggle
          checked={settings.autoLaunch}
          onChange={(v) => {
            updateSettings({ autoLaunch: v });
            invoke('set_autostart', { enabled: v }).catch(console.error);
          }}
        />
      </SettingRow>

      <SubHeading>Atualizações</SubHeading>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleCheckUpdate}
          disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
          style={{
            padding: '6px 14px',
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 500,
            background: 'var(--color-accent)',
            color: 'white',
            border: 'none',
            cursor: updateStatus === 'checking' || updateStatus === 'downloading' ? 'default' : 'pointer',
            opacity: updateStatus === 'checking' || updateStatus === 'downloading' ? 0.5 : 1,
            transition: 'opacity 0.15s ease',
          }}
        >
          {updateStatus === 'checking' ? 'Verificando...' :
           updateStatus === 'downloading' ? `Baixando ${updateProgress}%` :
           updateStatus === 'uptodate' ? 'Atualizado!' :
           updateStatus === 'error' ? 'Erro ao verificar' :
           'Verificar atualizações'}
        </motion.button>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          Hat v{version}
        </span>
      </div>
    </SettingsCard>
  );
}
