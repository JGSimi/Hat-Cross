import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Settings2, Check, AlertCircle, RefreshCw, Download } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import SettingsCard from './SettingsCard';
import { Row, Section, Toggle, ShortcutRecorder } from './primitives';
import { useSettingsStore } from '../../../stores/settingsStore';

type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'uptodate' | 'error';

export default function GeneralCard() {
  const { settings, updateSettings } = useSettingsStore();
  const [version, setVersion] = useState('');
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
  const [updateProgress, setUpdateProgress] = useState(0);

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion(''));
  }, []);

  const preview = version ? `v${version}` : 'Geral';

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

  const updateBusy = updateStatus === 'checking' || updateStatus === 'downloading';

  return (
    <SettingsCard
      title="Geral"
      icon={<Settings2 size={14} strokeWidth={2} />}
      preview={preview}
      defaultOpen
    >
      <Section title="Atalho">
        <Row
          label="Fechar em emergência"
          hint="Fecha o Hat completamente mesmo sem ele estar em foco. Útil se algo travar ou se precisar esconder o app rapidamente."
        >
          <ShortcutRecorder
            value={settings.shortcuts.emergencyQuit}
            onChange={(v) =>
              updateSettings({
                shortcuts: { ...settings.shortcuts, emergencyQuit: v },
              })
            }
          />
        </Row>
      </Section>

      <Section title="Sistema">
        <Row label="Iniciar com o sistema">
          <Toggle
            checked={settings.autoLaunch}
            onChange={(v) => {
              updateSettings({ autoLaunch: v });
              invoke('set_autostart', { enabled: v }).catch(console.error);
            }}
          />
        </Row>
      </Section>

      <Section title="Atualizações" meta={version ? `v${version}` : undefined}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <motion.button
            whileHover={{ scale: updateBusy ? 1 : 1.02 }}
            whileTap={{ scale: updateBusy ? 1 : 0.97 }}
            onClick={handleCheckUpdate}
            disabled={updateBusy}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '7px 14px',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 600,
              background:
                updateStatus === 'uptodate'
                  ? 'color-mix(in srgb, var(--success, #22c55e) 18%, transparent)'
                  : updateStatus === 'error'
                    ? 'color-mix(in srgb, var(--error, #ef4444) 18%, transparent)'
                    : 'var(--color-accent)',
              color:
                updateStatus === 'uptodate'
                  ? 'var(--success, #22c55e)'
                  : updateStatus === 'error'
                    ? 'var(--error, #ef4444)'
                    : 'var(--on-accent)',
              border: 'none',
              cursor: updateBusy ? 'default' : 'pointer',
              opacity: updateBusy ? 0.75 : 1,
              transition: 'background 0.18s ease',
              boxShadow:
                updateStatus === 'idle'
                  ? '0 2px 8px color-mix(in srgb, var(--color-accent) 30%, transparent), inset 0 1px 0 rgba(255,255,255,0.22)'
                  : 'none',
            }}
          >
            {updateStatus === 'checking' && (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                style={{ display: 'inline-flex' }}
              >
                <RefreshCw size={12} />
              </motion.span>
            )}
            {updateStatus === 'downloading' && <Download size={12} />}
            {updateStatus === 'uptodate' && <Check size={12} />}
            {updateStatus === 'error' && <AlertCircle size={12} />}
            {updateStatus === 'idle' && <RefreshCw size={12} />}
            {updateStatus === 'checking' ? 'Verificando…' :
             updateStatus === 'downloading' ? `Baixando ${updateProgress}%` :
             updateStatus === 'uptodate' ? 'Atualizado' :
             updateStatus === 'error' ? 'Erro ao verificar' :
             'Verificar atualizações'}
          </motion.button>
        </div>
      </Section>
    </SettingsCard>
  );
}
