import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Settings2, Check, AlertCircle, RefreshCw, Download, Languages } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { useTranslation } from 'react-i18next';
import SettingsCard from './SettingsCard';
import { Row, Section, Toggle, ShortcutRecorder } from './primitives';
import { useSettingsStore } from '../../../stores/settingsStore';
import { useToastStore } from '../../../stores/toastStore';
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES, type AppLanguage } from '../../../i18n/defaults';

type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'uptodate' | 'error';

export default function GeneralCard() {
  const { settings, updateSettings, setLanguage } = useSettingsStore();
  const [version, setVersion] = useState('');
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
  const [updateProgress, setUpdateProgress] = useState(0);
  const { t } = useTranslation('settings');
  const showToast = useToastStore((s) => s.showToast);

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion(''));
  }, []);

  const preview = version ? `v${version}` : t('general.preview');

  const handleLanguageChange = (lang: AppLanguage) => {
    if (lang === settings.language) return;
    const autoSwapped = setLanguage(lang);
    if (!autoSwapped) {
      showToast(
        t('ai.promptChangedToast', { language: LANGUAGE_LABELS[lang].native }),
        'info',
        { duration: 5000 },
      );
    }
  };

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
      title={t('general.title')}
      icon={<Settings2 size={14} strokeWidth={2} />}
      preview={preview}
      defaultOpen
    >
      <Section title={t('general.language.title')}>
        <Row
          label={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Languages size={12} />
              {LANGUAGE_LABELS[settings.language].native}
            </span>
          }
          hint={t('general.language.hint')}
        >
          <div
            role="radiogroup"
            aria-label={t('general.language.title')}
            style={{
              position: 'relative',
              display: 'inline-flex',
              background: 'var(--surface-secondary)',
              border: '0.5px solid var(--border-subtle)',
              borderRadius: 999,
              padding: 3,
              gap: 2,
              isolation: 'isolate',
            }}
          >
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isActive = settings.language === lang;
              const info = LANGUAGE_LABELS[lang];
              return (
                <motion.button
                  key={lang}
                  role="radio"
                  aria-checked={isActive}
                  type="button"
                  onClick={() => handleLanguageChange(lang)}
                  whileHover={isActive ? undefined : { y: -1 }}
                  whileTap={{ scale: 0.94 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                  style={{
                    position: 'relative',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 10px',
                    borderRadius: 999,
                    fontSize: 10.5,
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'var(--on-accent)' : 'var(--text-muted)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    letterSpacing: 0.2,
                    zIndex: 1,
                    // color muda rapidamente pra acompanhar a slide da pílula
                    transition: 'color 0.22s ease',
                  }}
                >
                  {/* Pílula ativa compartilhada — desliza suave entre posições
                      via layoutId do Framer Motion. Um único elemento no DOM
                      que "viaja" da tab antiga pra nova. */}
                  {isActive && (
                    <motion.span
                      layoutId="lang-pill-bg"
                      aria-hidden
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: 999,
                        background: 'var(--color-accent)',
                        boxShadow:
                          '0 2px 8px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.2)',
                        zIndex: -1,
                      }}
                      transition={{
                        type: 'spring',
                        stiffness: 440,
                        damping: 34,
                        mass: 0.8,
                      }}
                    />
                  )}
                  <motion.span
                    style={{ fontSize: 11, display: 'inline-flex' }}
                    animate={{
                      scale: isActive ? 1.12 : 1,
                      filter: isActive ? 'saturate(1.15)' : 'saturate(0.85)',
                    }}
                    transition={{ type: 'spring', stiffness: 360, damping: 22 }}
                  >
                    {info.flag}
                  </motion.span>
                  {info.short}
                </motion.button>
              );
            })}
          </div>
        </Row>
      </Section>

      <Section title={t('general.shortcut.title')}>
        <Row
          label={t('general.shortcut.emergencyQuit')}
          hint={t('general.shortcut.emergencyQuitHint')}
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

      <Section title={t('general.system.title')}>
        <Row label={t('general.system.autoLaunch')}>
          <Toggle
            checked={settings.autoLaunch}
            onChange={(v) => {
              updateSettings({ autoLaunch: v });
              invoke('set_autostart', { enabled: v }).catch(console.error);
            }}
          />
        </Row>
      </Section>

      <Section title={t('general.updates.title')} meta={version ? `v${version}` : undefined}>
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
            {updateStatus === 'checking' ? t('general.updates.checking') :
             updateStatus === 'downloading' ? t('general.updates.downloading', { progress: updateProgress }) :
             updateStatus === 'uptodate' ? t('general.updates.upToDate') :
             updateStatus === 'error' ? t('general.updates.error') :
             t('general.updates.check')}
          </motion.button>
        </div>
      </Section>
    </SettingsCard>
  );
}
