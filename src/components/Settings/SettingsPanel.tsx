import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Zap } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import ThemePicker from './ThemePicker';
import WindowControls from '../Shared/WindowControls';
import AccountTab from '../Account/AccountTab';
import { usePlatform } from '../../hooks/usePlatform';
import { useSettingsStore } from '../../stores/settingsStore';

interface Props {
  onClose: () => void;
}

type Tab = 'account' | 'general' | 'notifications' | 'clipboard' | 'appearance' | 'behavior' | 'shortcuts' | 'popover';

const tabContentVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export default function SettingsPanel({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('account');
  const platform = usePlatform();
  const {
    settings,
    updateSettings,
    setTheme,
  } = useSettingsStore();

  const tabs: { id: Tab; label: string }[] = [
    { id: 'account', label: 'Conta' },
    { id: 'general', label: 'Geral' },
    { id: 'appearance', label: 'Aparência' },
    { id: 'behavior', label: 'Comportamento' },
    { id: 'clipboard', label: 'Clipboard' },
    { id: 'notifications', label: 'Notificações' },
    { id: 'shortcuts', label: 'Atalhos' },
    { id: 'popover', label: 'Chat Flutuante' },
  ];

  return (
    <motion.div
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-primary)',
      }}
      className="bg-atmosphere"
    >
      {/* Header — drag region for custom titlebar */}
      <div
        data-tauri-drag-region
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          borderBottom: '0.5px solid var(--border-subtle)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClose}
          aria-label="Voltar"
          style={{
            padding: 6,
            borderRadius: 6,
            color: 'var(--text-secondary)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ArrowLeft size={16} />
        </motion.button>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0, flex: 1 }}>
          Configurações
        </h2>
        {platform !== 'macos' && <WindowControls variant="header" />}
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        {/* Tab sidebar */}
        <div style={{ width: 160, borderRight: '0.5px solid var(--border-subtle)', paddingTop: 8, background: 'linear-gradient(to bottom, transparent 70%, color-mix(in srgb, var(--color-accent) 3%, transparent))' }}>
          {tabs.map((tab) => (
            <motion.button
              key={tab.id}
              whileHover={{ backgroundColor: activeTab === tab.id ? undefined : 'var(--surface-hover)' }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab(tab.id)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '8px 16px',
                fontSize: 11,
                fontWeight: activeTab === tab.id ? 600 : 400,
                color: activeTab === tab.id ? 'var(--color-accent)' : 'var(--text-secondary)',
                background: activeTab === tab.id ? 'linear-gradient(to right, color-mix(in srgb, var(--color-accent) 12%, transparent), color-mix(in srgb, var(--color-accent) 4%, transparent))' : 'transparent',
                border: 'none',
                borderRight: activeTab === tab.id ? '2px solid var(--color-accent)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'color 0.15s ease',
              }}
            >
              {tab.label}
            </motion.button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              variants={tabContentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              {activeTab === 'account' && <AccountTab />}
              {activeTab === 'general' && <GeneralTab />}
              {activeTab === 'notifications' && (
                <NotificationsTab settings={settings} updateSettings={updateSettings} />
              )}
              {activeTab === 'clipboard' && (
                <ClipboardTab settings={settings} updateSettings={updateSettings} />
              )}
              {activeTab === 'appearance' && (
                <AppearanceTab
                  settings={settings}
                  updateSettings={updateSettings}
                  setTheme={setTheme}
                />
              )}
              {activeTab === 'behavior' && (
                <BehaviorTab settings={settings} updateSettings={updateSettings} />
              )}
              {activeTab === 'shortcuts' && (
                <ShortcutsTab settings={settings} updateSettings={updateSettings} />
              )}
              {activeTab === 'popover' && (
                <PopoverTab settings={settings} updateSettings={updateSettings} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 10,
        fontWeight: 600,
        color: 'color-mix(in srgb, var(--text-muted) 70%, var(--color-accent))',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 12,
        marginTop: 4,
      }}
    >
      {children}
    </h3>
  );
}

function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--glass-secondary)',
        border: '0.5px solid var(--glass-border-subtle)',
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
        boxShadow: 'var(--shadow-soft), inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
    >
      {children}
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
      <div>{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        background: checked ? 'var(--color-accent)' : 'var(--surface-secondary)',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s ease',
      }}
    >
      <motion.div
        animate={{
          x: checked ? 18 : 2,
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: 'white',
          position: 'absolute',
          top: 3,
          left: 0,
          boxShadow: 'var(--shadow-soft)',
        }}
      />
    </button>
  );
}

function CustomSlider({
  min,
  max,
  step,
  value,
  onChange,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{
        width: 128,
        accentColor: 'var(--color-accent)',
        cursor: 'pointer',
      }}
    />
  );
}

function GeneralTab() {
  const { settings, updateSettings } = useSettingsStore();
  const [version, setVersion] = useState('');
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'uptodate' | 'error'>('idle');
  const [updateProgress, setUpdateProgress] = useState(0);
  useEffect(() => { getVersion().then(setVersion).catch(() => setVersion('2.0.0')); }, []);

  const handleCheckUpdate = async () => {
    setUpdateStatus('checking');
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update) {
        setUpdateStatus('available');
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
        // Flush settings to disk before relaunching to preserve API keys
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
    <>
      <SectionTitle>Geral</SectionTitle>
      <GlassCard>
        <SettingRow label="Iniciar com o sistema">
          <Toggle
            checked={settings.autoLaunch}
            onChange={(v) => {
              updateSettings({ autoLaunch: v });
              invoke('set_autostart', { enabled: v }).catch(console.error);
            }}
          />
        </SettingRow>
        <SettingRow label="Sons">
          <Toggle
            checked={settings.soundEnabled}
            onChange={(v) => updateSettings({ soundEnabled: v })}
          />
        </SettingRow>
      </GlassCard>

      <SectionTitle>Atualizações</SectionTitle>
      <GlassCard>
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
        </div>
        <div style={{ paddingTop: 12, fontSize: 10, color: 'var(--text-muted)' }}>
          Hat v{version}
        </div>
      </GlassCard>
    </>
  );
}

function NotificationsTab({
  settings,
  updateSettings,
}: {
  settings: ReturnType<typeof useSettingsStore.getState>['settings'];
  updateSettings: ReturnType<typeof useSettingsStore.getState>['updateSettings'];
}) {
  const notif = settings.notifications;
  const update = (partial: Partial<typeof notif>) => {
    updateSettings({ notifications: { ...notif, ...partial } });
  };

  const disabledStyle = {
    opacity: notif.enabled ? 1 : 0.4,
    pointerEvents: (notif.enabled ? 'auto' : 'none') as React.CSSProperties['pointerEvents'],
    transition: 'opacity 0.2s ease',
  };

  return (
    <>
      <SectionTitle>Geral</SectionTitle>
      <GlassCard>
        <SettingRow label="Notificações ativas">
          <Toggle checked={notif.enabled} onChange={(v) => update({ enabled: v })} />
        </SettingRow>
      </GlassCard>

      <SectionTitle>Clipboard</SectionTitle>
      <div style={disabledStyle}>
        <GlassCard>
          <SettingRow label="Notificação de processamento">
            <Toggle checked={notif.showProcessingNotification} onChange={(v) => update({ showProcessingNotification: v })} />
          </SettingRow>
          <SettingRow label="Notificação de resposta">
            <Toggle checked={notif.showResponseNotification} onChange={(v) => update({ showResponseNotification: v })} />
          </SettingRow>
          <SettingRow label="Notificação de clipboard vazio">
            <Toggle checked={notif.showClipboardEmptyNotification} onChange={(v) => update({ showClipboardEmptyNotification: v })} />
          </SettingRow>
          <SettingRow label="Notificação de erro">
            <Toggle checked={notif.showErrorNotification} onChange={(v) => update({ showErrorNotification: v })} />
          </SettingRow>
        </GlassCard>
      </div>

      <SectionTitle>Chat</SectionTitle>
      <div style={disabledStyle}>
        <GlassCard>
          <SettingRow label="Resposta recebida (janela sem foco)">
            <Toggle checked={notif.showChatResponseNotification} onChange={(v) => update({ showChatResponseNotification: v })} />
          </SettingRow>
        </GlassCard>
      </div>

      <SectionTitle>Sistema</SectionTitle>
      <div style={disabledStyle}>
        <GlassCard>
          <SettingRow label="Notificação de atualização">
            <Toggle checked={notif.showUpdateNotification} onChange={(v) => update({ showUpdateNotification: v })} />
          </SettingRow>
        </GlassCard>
      </div>

      <SectionTitle>Tempo de exibição</SectionTitle>
      <GlassCard>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <p>
            O tempo de exibição das notificações é controlado pelo sistema operacional
            e não pode ser alterado pelo Hat.
          </p>
          <p style={{ marginTop: 8 }}>
            <strong style={{ color: 'var(--text-primary)' }}>macOS:</strong> Ajuste em{' '}
            <em>Preferências do Sistema &gt; Notificações &gt; Hat</em>.
          </p>
          <p style={{ marginTop: 6 }}>
            <strong style={{ color: 'var(--text-primary)' }}>Windows:</strong> Ajuste em{' '}
            <em>Configurações &gt; Acessibilidade &gt; Efeitos visuais &gt; Tempo de exibição de notificações</em>.
          </p>
        </div>
      </GlassCard>
    </>
  );
}

function ClipboardTab({
  settings,
  updateSettings,
}: {
  settings: ReturnType<typeof useSettingsStore.getState>['settings'];
  updateSettings: ReturnType<typeof useSettingsStore.getState>['updateSettings'];
}) {
  const clip = settings.clipboard;
  const update = (partial: Partial<typeof clip>) => {
    updateSettings({ clipboard: { ...clip, ...partial } });
  };

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Copie qualquer texto e pressione <kbd style={{
            fontFamily: "'SF Mono', monospace", fontSize: 10, padding: '2px 6px',
            background: 'var(--surface-secondary)', border: '1px solid var(--border-subtle)',
            borderRadius: 4, color: 'var(--text-primary)',
          }}>
            {settings.shortcuts.clipboard}
          </kbd> para a IA processar automaticamente.
        </p>
      </div>

      <SectionTitle>Geral</SectionTitle>
      <GlassCard>
        <SettingRow label="Clipboard Processing ativo">
          <Toggle checked={clip.enabled} onChange={(v) => update({ enabled: v })} />
        </SettingRow>
        <SettingRow label="Capturar imagens do clipboard">
          <Toggle checked={clip.captureImages} onChange={(v) => update({ captureImages: v })} />
        </SettingRow>
        {clip.captureImages && (
          <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
            Quando ativo, imagens copiadas (screenshots, prints) também são enviadas para a IA junto com o texto.
          </p>
        )}
        <SettingRow label="Som ao completar">
          <Toggle checked={clip.soundOnComplete} onChange={(v) => update({ soundOnComplete: v })} />
        </SettingRow>
      </GlassCard>

      <SectionTitle>Resposta</SectionTitle>
      <GlassCard>
        <SettingRow label="Copiar resposta para o clipboard">
          <Toggle checked={clip.copyResponseToClipboard} onChange={(v) => update({ copyResponseToClipboard: v })} />
        </SettingRow>
        <SettingRow label="Modo anexar (original + resposta)">
          <Toggle checked={clip.appendMode} onChange={(v) => update({ appendMode: v })} />
        </SettingRow>
        {clip.appendMode && (
          <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
            O texto original será mantido, com a resposta da IA adicionada abaixo separada por "---".
          </p>
        )}
      </GlassCard>

      <SectionTitle>Limites</SectionTitle>
      <GlassCard>
        <SettingRow label={`Tamanho máximo: ${clip.maxResponseLength} chars`}>
          <CustomSlider
            min={256} max={16384} step={256}
            value={clip.maxResponseLength}
            onChange={(v) => update({ maxResponseLength: v })}
          />
        </SettingRow>
      </GlassCard>

      <SectionTitle>Prompt Customizado</SectionTitle>
      <GlassCard>
        <SettingRow label="Usar prompt customizado para clipboard">
          <Toggle checked={clip.useCustomPrompt} onChange={(v) => update({ useCustomPrompt: v })} />
        </SettingRow>
        {clip.useCustomPrompt && (
          <div style={{ marginTop: 8 }}>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
              Este prompt será usado ao invés do system prompt padrão quando processar o clipboard.
            </p>
            <textarea
              value={clip.customPrompt}
              onChange={(e) => update({ customPrompt: e.target.value })}
              placeholder="Ex: Traduza para inglês. Responda apenas com a tradução, sem explicações."
              rows={4}
              style={{
                width: '100%', background: 'var(--input-bg)', color: 'var(--text-primary)',
                borderRadius: 8, padding: '8px 12px', fontSize: 12,
                border: '1px solid var(--border-subtle)', resize: 'vertical',
                fontFamily: 'inherit', lineHeight: 1.5,
              }}
            />
          </div>
        )}
        {!clip.useCustomPrompt && (
          <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
            Quando desativado, usa o System Prompt da aba Comportamento.
          </p>
        )}
      </GlassCard>

      <SectionTitle>Exemplos de uso</SectionTitle>
      <GlassCard>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <p><strong style={{ color: 'var(--text-secondary)' }}>Tradução:</strong> Copie texto em qualquer idioma, pressione o atalho, receba a tradução no clipboard.</p>
          <p style={{ marginTop: 6 }}><strong style={{ color: 'var(--text-secondary)' }}>Resumo:</strong> Copie um artigo longo, pressione o atalho com prompt "Resuma em 3 bullets".</p>
          <p style={{ marginTop: 6 }}><strong style={{ color: 'var(--text-secondary)' }}>Código:</strong> Copie código com bug, pressione o atalho com prompt "Corrija este código".</p>
          <p style={{ marginTop: 6 }}><strong style={{ color: 'var(--text-secondary)' }}>Resposta rápida:</strong> Copie uma pergunta, pressione o atalho, cole a resposta onde quiser.</p>
        </div>
      </GlassCard>
    </>
  );
}

function AppearanceTab({
  settings,
  updateSettings,
  setTheme,
}: {
  settings: ReturnType<typeof useSettingsStore.getState>['settings'];
  updateSettings: ReturnType<typeof useSettingsStore.getState>['updateSettings'];
  setTheme: ReturnType<typeof useSettingsStore.getState>['setTheme'];
}) {
  const appearance = settings.appearance ?? {
    fontSize: 'md' as const,
    fontScale: 1.0,
    backgroundStyle: 'default' as const,
    customBackground: '#0C0C0E',
    messageBubbleOpacity: 1.0,
    sidebarWidth: 220,
    uiOpacity: 1.0,
  };
  const performance = settings.performance ?? {
    reducedMotion: false,
    disableBlur: false,
    disableMouseBackground: false,
    disableAnimatedGradients: false,
    disableSplashScreen: false,
    disableStaggerAnimations: false,
  };

  const updateAppearance = (partial: Partial<typeof appearance>) => {
    updateSettings({ appearance: { ...appearance, ...partial } });
  };
  const updatePerformance = (partial: Partial<typeof performance>) => {
    updateSettings({ performance: { ...performance, ...partial } });
  };

  const fontSizeLabels: Record<string, string> = {
    xs: 'Muito pequeno',
    sm: 'Pequeno',
    md: 'Normal',
    lg: 'Grande',
    xl: 'Muito grande',
  };
  const fontScaleMap: Record<string, number> = { xs: 0.82, sm: 0.9, md: 1.0, lg: 1.12, xl: 1.25 };

  const bgOptions: { value: string; label: string; preview: string }[] = [
    { value: 'default', label: 'Padrão', preview: '#0C0C0E' },
    { value: 'darker', label: 'Mais escuro', preview: '#060608' },
    { value: 'lighter', label: 'Mais claro', preview: '#1a1a1f' },
    { value: 'solid', label: 'Sólido', preview: appearance.customBackground },
    { value: 'custom', label: 'Personalizado', preview: appearance.customBackground },
  ];

  return (
    <>
      <SectionTitle>Tema</SectionTitle>
      <GlassCard>
        <ThemePicker current={settings.theme} onChange={setTheme} />
      </GlassCard>

      <SectionTitle>Tamanho do Texto</SectionTitle>
      <GlassCard>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => (
            <motion.button
              key={size}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                updateAppearance({ fontSize: size, fontScale: fontScaleMap[size] });
              }}
              style={{
                flex: 1,
                padding: '8px 4px',
                borderRadius: 8,
                fontSize: size === 'xs' ? 9 : size === 'sm' ? 10 : size === 'md' ? 11 : size === 'lg' ? 12 : 13,
                fontWeight: appearance.fontSize === size ? 600 : 400,
                background: appearance.fontSize === size
                  ? 'color-mix(in srgb, var(--color-accent) 15%, transparent)'
                  : 'rgba(255,255,255,0.03)',
                color: appearance.fontSize === size ? 'var(--color-accent)' : 'var(--text-muted)',
                border: appearance.fontSize === size
                  ? '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)'
                  : '1px solid rgba(255,255,255,0.05)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Aa
            </motion.button>
          ))}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
          {fontSizeLabels[appearance.fontSize]} ({Math.round(appearance.fontScale * 100)}%)
        </div>
      </GlassCard>

      <SectionTitle>Fundo</SectionTitle>
      <GlassCard>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {bgOptions.map((opt) => (
            <motion.button
              key={opt.value}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => updateAppearance({ backgroundStyle: opt.value as typeof appearance.backgroundStyle })}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                padding: 6,
                borderRadius: 8,
                background: 'transparent',
                border: appearance.backgroundStyle === opt.value
                  ? '1.5px solid var(--color-accent)'
                  : '1.5px solid rgba(255,255,255,0.06)',
                cursor: 'pointer',
              }}
            >
              <div style={{
                width: 36,
                height: 24,
                borderRadius: 4,
                background: opt.preview,
                border: '1px solid rgba(255,255,255,0.1)',
              }} />
              <span style={{
                fontSize: 9,
                color: appearance.backgroundStyle === opt.value ? 'var(--color-accent)' : 'var(--text-muted)',
                fontWeight: appearance.backgroundStyle === opt.value ? 600 : 400,
              }}>
                {opt.label}
              </span>
            </motion.button>
          ))}
        </div>
        {(appearance.backgroundStyle === 'custom' || appearance.backgroundStyle === 'solid') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Cor:</span>
            <input
              type="color"
              value={appearance.customBackground}
              onChange={(e) => updateAppearance({ customBackground: e.target.value })}
              style={{
                width: 32, height: 24, border: 'none', borderRadius: 4,
                cursor: 'pointer', background: 'transparent',
              }}
            />
            <input
              type="text"
              value={appearance.customBackground}
              onChange={(e) => {
                if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) {
                  updateAppearance({ customBackground: e.target.value });
                }
              }}
              style={{
                width: 80,
                background: 'var(--input-bg)',
                color: 'var(--text-primary)',
                border: '0.5px solid var(--border-subtle)',
                borderRadius: 4,
                padding: '3px 8px',
                fontSize: 10,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            />
          </div>
        )}
      </GlassCard>

      <SectionTitle>Interface</SectionTitle>
      <GlassCard>
        <SettingRow label={`Opacidade das bolhas: ${Math.round(appearance.messageBubbleOpacity * 100)}%`}>
          <CustomSlider min={0.3} max={1} step={0.05} value={appearance.messageBubbleOpacity}
            onChange={(v) => updateAppearance({ messageBubbleOpacity: v })} />
        </SettingRow>
        <SettingRow label={`Opacidade geral: ${Math.round(appearance.uiOpacity * 100)}%`}>
          <CustomSlider min={0.6} max={1} step={0.05} value={appearance.uiOpacity}
            onChange={(v) => updateAppearance({ uiOpacity: v })} />
        </SettingRow>
        <SettingRow label={`Largura da sidebar: ${appearance.sidebarWidth}px`}>
          <CustomSlider min={180} max={320} step={10} value={appearance.sidebarWidth}
            onChange={(v) => updateAppearance({ sidebarWidth: v })} />
        </SettingRow>
      </GlassCard>

      <SectionTitle>Desempenho Visual</SectionTitle>
      <GlassCard>
        <div style={{ marginBottom: 10 }}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              updatePerformance({
                reducedMotion: true,
                disableBlur: true,
                disableMouseBackground: true,
                disableAnimatedGradients: true,
                disableSplashScreen: true,
                disableStaggerAnimations: true,
              });
            }}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 500,
              background: 'color-mix(in srgb, var(--warning) 10%, transparent)',
              color: 'var(--warning)',
              border: '1px solid color-mix(in srgb, var(--warning) 20%, transparent)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Zap size={12} />
            Modo economia — desativar tudo
          </motion.button>
          {(performance.reducedMotion && performance.disableBlur && performance.disableMouseBackground) && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                updatePerformance({
                  reducedMotion: false,
                  disableBlur: false,
                  disableMouseBackground: false,
                  disableAnimatedGradients: false,
                  disableSplashScreen: false,
                  disableStaggerAnimations: false,
                });
              }}
              style={{
                width: '100%',
                marginTop: 6,
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 10,
                background: 'rgba(255,255,255,0.03)',
                color: 'var(--text-muted)',
                border: '1px solid rgba(255,255,255,0.06)',
                cursor: 'pointer',
              }}
            >
              Restaurar tudo
            </motion.button>
          )}
        </div>
        <SettingRow label="Reduzir animações">
          <Toggle checked={performance.reducedMotion} onChange={(v) => updatePerformance({ reducedMotion: v })} />
        </SettingRow>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '0 0 6px', lineHeight: 1.4 }}>
          Desativa transições e animações de elementos. Melhora a fluidez em hardware mais fraco.
        </div>
        <SettingRow label="Desativar blur/glassmorphism">
          <Toggle checked={performance.disableBlur} onChange={(v) => updatePerformance({ disableBlur: v })} />
        </SettingRow>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '0 0 6px', lineHeight: 1.4 }}>
          Remove efeito de vidro fosco (backdrop-filter). Grande impacto em GPUs integradas.
        </div>
        <SettingRow label="Desativar fundo reativo ao mouse">
          <Toggle checked={performance.disableMouseBackground} onChange={(v) => updatePerformance({ disableMouseBackground: v })} />
        </SettingRow>
        <SettingRow label="Desativar gradientes animados">
          <Toggle checked={performance.disableAnimatedGradients} onChange={(v) => updatePerformance({ disableAnimatedGradients: v })} />
        </SettingRow>
        <SettingRow label="Desativar animações de lista">
          <Toggle checked={performance.disableStaggerAnimations} onChange={(v) => updatePerformance({ disableStaggerAnimations: v })} />
        </SettingRow>
        <SettingRow label="Pular tela de splash">
          <Toggle checked={performance.disableSplashScreen} onChange={(v) => updatePerformance({ disableSplashScreen: v })} />
        </SettingRow>
      </GlassCard>
    </>
  );
}


function BehaviorTab({
  settings,
  updateSettings,
}: {
  settings: ReturnType<typeof useSettingsStore.getState>['settings'];
  updateSettings: ReturnType<typeof useSettingsStore.getState>['updateSettings'];
}) {
  const limits = settings.chatLimits ?? {
    maxContextMessages: 40,
    maxConversations: 50,
    maxMessagesPerConversation: 200,
    autoNewChatOnLimit: true,
  };
  const updateLimits = (partial: Partial<typeof limits>) => {
    updateSettings({ chatLimits: { ...limits, ...partial } });
  };

  return (
    <>
      <SectionTitle>System Prompt</SectionTitle>
      <GlassCard>
        <textarea
          value={settings.systemPrompt}
          onChange={(e) => updateSettings({ systemPrompt: e.target.value })}
          rows={8}
          style={{
            width: '100%',
            background: 'var(--input-bg)',
            color: 'var(--text-primary)',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 11,
            border: '0.5px solid var(--border-subtle)',
            resize: 'none',
          }}
        />
      </GlassCard>

      <SectionTitle>Parâmetros</SectionTitle>
      <GlassCard>
        <SettingRow label={`Temperature: ${settings.temperature}`}>
          <CustomSlider min={0} max={2} step={0.1} value={settings.temperature}
            onChange={(v) => updateSettings({ temperature: v })} />
        </SettingRow>
        <SettingRow label={`Max Tokens: ${settings.maxTokens}`}>
          <CustomSlider min={256} max={32768} step={256} value={settings.maxTokens}
            onChange={(v) => updateSettings({ maxTokens: v })} />
        </SettingRow>
      </GlassCard>

      <SectionTitle>Limites de Chat</SectionTitle>
      <GlassCard>
        <SettingRow label={`Contexto da IA: ${limits.maxContextMessages} msgs`}>
          <CustomSlider min={10} max={100} step={2} value={limits.maxContextMessages}
            onChange={(v) => updateLimits({ maxContextMessages: v })} />
        </SettingRow>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '0 0 8px', lineHeight: 1.5 }}>
          Quantidade de mensagens enviadas como contexto para a IA. Valores menores economizam tokens e mantêm respostas mais focadas.
        </div>
        <SettingRow label="Nova conversa automática ao atingir limite">
          <Toggle checked={limits.autoNewChatOnLimit} onChange={(v) => updateLimits({ autoNewChatOnLimit: v })} />
        </SettingRow>
      </GlassCard>

      <SectionTitle>Limites de Histórico</SectionTitle>
      <GlassCard>
        <SettingRow label={`Máx. conversas: ${limits.maxConversations}`}>
          <CustomSlider min={10} max={200} step={10} value={limits.maxConversations}
            onChange={(v) => updateLimits({ maxConversations: v })} />
        </SettingRow>
        <SettingRow label={`Máx. msgs/conversa: ${limits.maxMessagesPerConversation}`}>
          <CustomSlider min={50} max={500} step={10} value={limits.maxMessagesPerConversation}
            onChange={(v) => updateLimits({ maxMessagesPerConversation: v })} />
        </SettingRow>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '0 0 4px', lineHeight: 1.5 }}>
          Conversas mais antigas (não fixadas) são removidas automaticamente ao ultrapassar o limite. Valores altos podem causar lentidão.
        </div>
      </GlassCard>
    </>
  );
}

/** Maps keyboard event keys to Tauri-compatible accelerator names */
function keyToAccelerator(e: React.KeyboardEvent): string | null {
  const { code, key } = e;
  // Letter keys
  if (code.startsWith('Key')) return code.slice(3);
  // Digit keys
  if (code.startsWith('Digit')) return code.slice(5);
  // Function keys
  if (/^F\d{1,2}$/.test(key)) return key;
  // Special keys
  const specialMap: Record<string, string> = {
    Space: 'Space', Tab: 'Tab', Enter: 'Enter',
    ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
    Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
    Delete: 'Delete', Insert: 'Insert',
    Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
    Semicolon: ';', Quote: "'", Backquote: '`', Backslash: '\\',
    Comma: ',', Period: '.', Slash: '/',
    NumpadAdd: 'num+', NumpadSubtract: 'num-', NumpadMultiply: 'num*',
    NumpadDivide: 'num/', NumpadDecimal: 'numdec', NumpadEnter: 'numenter',
  };
  if (code.startsWith('Numpad') && /^Numpad\d$/.test(code)) return 'num' + code.slice(6);
  return specialMap[code] ?? null;
}

/** Formats an accelerator string for display (e.g., CommandOrControl+Shift+X → Ctrl+Shift+X) */
function displayShortcut(accelerator: string, platform: 'macos' | 'windows' | 'linux'): string {
  return accelerator
    .replace(/CommandOrControl/g, platform === 'macos' ? 'Cmd' : 'Ctrl')
    .replace(/CmdOrCtrl/g, platform === 'macos' ? 'Cmd' : 'Ctrl');
}

function ShortcutRecorder({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [currentKeys, setCurrentKeys] = useState('');
  const platform = usePlatform();
  const ref = useRef<HTMLButtonElement>(null);

  const boxStyle: React.CSSProperties = {
    width: 200,
    minHeight: 30,
    background: recording ? 'var(--color-accent-muted, rgba(99,102,241,0.12))' : 'var(--input-bg)',
    color: recording ? 'var(--color-accent)' : 'var(--text-primary)',
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 11,
    border: recording ? '1.5px solid var(--color-accent)' : '0.5px solid var(--border-subtle)',
    textAlign: 'center' as const,
    fontFamily: "'SF Mono', monospace",
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!recording) return;
    e.preventDefault();
    e.stopPropagation();

    // Escape cancels recording
    if (e.key === 'Escape') {
      setRecording(false);
      setCurrentKeys('');
      return;
    }

    // Backspace/Delete clears the shortcut
    if (e.key === 'Backspace' || e.key === 'Delete') {
      onChange('');
      setRecording(false);
      setCurrentKeys('');
      return;
    }

    // Ignore lone modifier keys — just show preview
    const isModifier = ['Control', 'Shift', 'Alt', 'Meta'].includes(e.key);

    // Build modifiers
    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');

    if (isModifier) {
      // Show current modifier preview
      setCurrentKeys(parts.length > 0 ? displayShortcut(parts.join('+'), platform) + '+...' : '');
      return;
    }

    // Must have at least one modifier
    if (parts.length === 0) return;

    const mainKey = keyToAccelerator(e);
    if (!mainKey) return;

    parts.push(mainKey);
    const accelerator = parts.join('+');
    onChange(accelerator);
    setRecording(false);
    setCurrentKeys('');
  };

  const handleClick = () => {
    setRecording(true);
    setCurrentKeys('');
    // Focus so we can capture keydown
    setTimeout(() => ref.current?.focus(), 0);
  };

  const handleBlur = () => {
    // Small delay to avoid instant blur on click
    setTimeout(() => {
      setRecording(false);
      setCurrentKeys('');
    }, 150);
  };

  const display = recording
    ? (currentKeys || 'Pressione as teclas...')
    : value
      ? displayShortcut(value, platform)
      : 'Clique para definir';

  return (
    <button
      ref={ref}
      type="button"
      style={boxStyle}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      title={recording ? 'Esc para cancelar, Backspace para limpar' : 'Clique para gravar um novo atalho'}
    >
      {display}
    </button>
  );
}

function ShortcutsTab({
  settings,
  updateSettings,
}: {
  settings: ReturnType<typeof useSettingsStore.getState>['settings'];
  updateSettings: ReturnType<typeof useSettingsStore.getState>['updateSettings'];
}) {
  return (
    <>
      <SectionTitle>Atalhos Globais</SectionTitle>
      <GlassCard>
        <SettingRow label="Processar Clipboard">
          <ShortcutRecorder
            value={settings.shortcuts.clipboard}
            onChange={(v) => updateSettings({ shortcuts: { ...settings.shortcuts, clipboard: v } })}
          />
        </SettingRow>
        <SettingRow label="Analisar Tela">
          <ShortcutRecorder
            value={settings.shortcuts.screenCapture}
            onChange={(v) => updateSettings({ shortcuts: { ...settings.shortcuts, screenCapture: v } })}
          />
        </SettingRow>
        <SettingRow label="Chat Flutuante">
          <ShortcutRecorder
            value={settings.shortcuts.floatingChat}
            onChange={(v) => updateSettings({ shortcuts: { ...settings.shortcuts, floatingChat: v } })}
          />
        </SettingRow>
      </GlassCard>
      <div style={{ marginTop: 8, padding: '0 4px', fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Clique no atalho e pressione a nova combinação de teclas. Esc para cancelar, Backspace para limpar.
      </div>
    </>
  );
}

function PopoverTab({
  settings,
  updateSettings,
}: {
  settings: ReturnType<typeof useSettingsStore.getState>['settings'];
  updateSettings: ReturnType<typeof useSettingsStore.getState>['updateSettings'];
}) {
  const popover = settings.popover;

  return (
    <>
      <SectionTitle>Atalho</SectionTitle>
      <GlassCard>
        <SettingRow label="Abrir Chat Flutuante">
          <ShortcutRecorder
            value={settings.shortcuts.floatingChat}
            onChange={(v) =>
              updateSettings({ shortcuts: { ...settings.shortcuts, floatingChat: v } })
            }
          />
        </SettingRow>
      </GlassCard>

      <SectionTitle>Modo Fantasma</SectionTitle>
      <GlassCard>
        <SettingRow label="Modo furtivo">
          <Toggle
            checked={popover.stealthMode}
            onChange={(v) => updateSettings({ popover: { ...popover, stealthMode: v } })}
          />
        </SettingRow>
        {popover.stealthMode && (
          <SettingRow label={`Opacidade ao passar mouse (${Math.round(popover.stealthHoverOpacity * 100)}%)`}>
            <CustomSlider
              min={0.1}
              max={1}
              step={0.05}
              value={popover.stealthHoverOpacity}
              onChange={(v) => updateSettings({ popover: { ...popover, stealthHoverOpacity: v } })}
            />
          </SettingRow>
        )}
      </GlassCard>

      <SectionTitle>Modo Disfarce</SectionTitle>
      <GlassCard>
        <SettingRow label="Mostrar relógio como disfarce">
          <Toggle
            checked={popover.disguiseMode}
            onChange={(v) => updateSettings({ popover: { ...popover, disguiseMode: v } })}
          />
        </SettingRow>
        {popover.disguiseMode && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '4px 0 0', lineHeight: 1.5 }}>
            O chat aparecerá como um widget de relógio. Clique no relógio para revelar o chat.
          </div>
        )}
      </GlassCard>

      <SectionTitle>Tamanho</SectionTitle>
      <GlassCard>
        <SettingRow label={`Largura (${popover.width}px)`}>
          <CustomSlider
            min={300}
            max={800}
            step={10}
            value={popover.width}
            onChange={(v) => updateSettings({ popover: { ...popover, width: v } })}
          />
        </SettingRow>
        <SettingRow label={`Altura (${popover.height}px)`}>
          <CustomSlider
            min={350}
            max={900}
            step={10}
            value={popover.height}
            onChange={(v) => updateSettings({ popover: { ...popover, height: v } })}
          />
        </SettingRow>
      </GlassCard>
    </>
  );
}
