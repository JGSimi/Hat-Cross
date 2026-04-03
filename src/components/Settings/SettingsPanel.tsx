import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import ThemePicker from './ThemePicker';
import { useSettingsStore } from '../../stores/settingsStore';
import { PROVIDER_DEFAULTS, type CloudProvider } from '../../types';
import { fetchModels } from '../../services/ai';

interface Props {
  onClose: () => void;
}

type Tab = 'general' | 'appearance' | 'models' | 'behavior' | 'shortcuts';

const tabContentVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export default function SettingsPanel({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const {
    settings,
    providerConfigs,
    updateSettings,
    setTheme,
    setProvider,
    setApiKey,
    setModel,
    setEndpoint,
    resetTokenStats,
  } = useSettingsStore();

  const tabs: { id: Tab; label: string }[] = [
    { id: 'general', label: 'Geral' },
    { id: 'appearance', label: 'Aparencia' },
    { id: 'models', label: 'Modelos & IA' },
    { id: 'behavior', label: 'Comportamento' },
    { id: 'shortcuts', label: 'Atalhos' },
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
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          borderBottom: '0.5px solid var(--border-subtle)',
        }}
      >
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClose}
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
        <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
          Configuracoes
        </h2>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Tab sidebar */}
        <div style={{ width: 160, borderRight: '0.5px solid var(--border-subtle)', paddingTop: 8 }}>
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
                background: activeTab === tab.id ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)' : 'transparent',
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
              {activeTab === 'general' && <GeneralTab />}
              {activeTab === 'appearance' && (
                <AppearanceTab
                  settings={settings}
                  updateSettings={updateSettings}
                  setTheme={setTheme}
                />
              )}
              {activeTab === 'models' && (
                <ModelsTab
                  settings={settings}
                  providerConfigs={providerConfigs}
                  updateSettings={updateSettings}
                  setProvider={setProvider}
                  setApiKey={setApiKey}
                  setModel={setModel}
                  setEndpoint={setEndpoint}
                  resetTokenStats={resetTokenStats}
                />
              )}
              {activeTab === 'behavior' && (
                <BehaviorTab settings={settings} updateSettings={updateSettings} />
              )}
              {activeTab === 'shortcuts' && (
                <ShortcutsTab settings={settings} updateSettings={updateSettings} />
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
        color: 'var(--text-muted)',
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
        <SettingRow label="Notificacoes">
          <Toggle
            checked={settings.notificationsEnabled}
            onChange={(v) => updateSettings({ notificationsEnabled: v })}
          />
        </SettingRow>
      </GlassCard>

      <SectionTitle>Atualizacoes</SectionTitle>
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
             'Verificar atualizacoes'}
          </motion.button>
        </div>
        <div style={{ paddingTop: 12, fontSize: 10, color: 'var(--text-muted)' }}>
          Hat v{version}
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
  return (
    <>
      <SectionTitle>Tema</SectionTitle>
      <GlassCard>
        <ThemePicker current={settings.theme} onChange={setTheme} />
      </GlassCard>

      <SectionTitle>Popover</SectionTitle>
      <GlassCard>
        <SettingRow label={`Largura: ${settings.popover.width}px`}>
          <CustomSlider min={300} max={600} step={1} value={settings.popover.width}
            onChange={(v) => updateSettings({ popover: { ...settings.popover, width: v } })} />
        </SettingRow>
        <SettingRow label={`Altura: ${settings.popover.height}px`}>
          <CustomSlider min={350} max={800} step={1} value={settings.popover.height}
            onChange={(v) => updateSettings({ popover: { ...settings.popover, height: v } })} />
        </SettingRow>
        <SettingRow label={`Opacidade: ${Math.round(settings.popover.opacity * 100)}%`}>
          <CustomSlider min={0.3} max={1} step={0.05} value={settings.popover.opacity}
            onChange={(v) => updateSettings({ popover: { ...settings.popover, opacity: v } })} />
        </SettingRow>
        <SettingRow label="Vibrancy (Glassmorphism)">
          <Toggle
            checked={settings.popover.vibrancy}
            onChange={(v) => updateSettings({ popover: { ...settings.popover, vibrancy: v } })}
          />
        </SettingRow>
      </GlassCard>

      <SectionTitle>Modo Discreto (Stealth)</SectionTitle>
      <GlassCard>
        <SettingRow label="Stealth Mode">
          <Toggle
            checked={settings.popover.stealthMode}
            onChange={(v) => updateSettings({ popover: { ...settings.popover, stealthMode: v } })}
          />
        </SettingRow>
        {settings.popover.stealthMode && (
          <SettingRow label={`Opacidade Hover: ${Math.round(settings.popover.stealthHoverOpacity * 100)}%`}>
            <CustomSlider min={0.1} max={0.8} step={0.05} value={settings.popover.stealthHoverOpacity}
              onChange={(v) => updateSettings({ popover: { ...settings.popover, stealthHoverOpacity: v } })} />
          </SettingRow>
        )}
      </GlassCard>
    </>
  );
}

function ModelsTab({
  settings,
  providerConfigs,
  updateSettings,
  setProvider,
  setApiKey,
  setModel,
  setEndpoint,
  resetTokenStats,
}: {
  settings: ReturnType<typeof useSettingsStore.getState>['settings'];
  providerConfigs: ReturnType<typeof useSettingsStore.getState>['providerConfigs'];
  updateSettings: ReturnType<typeof useSettingsStore.getState>['updateSettings'];
  setProvider: ReturnType<typeof useSettingsStore.getState>['setProvider'];
  setApiKey: ReturnType<typeof useSettingsStore.getState>['setApiKey'];
  setModel: ReturnType<typeof useSettingsStore.getState>['setModel'];
  setEndpoint: ReturnType<typeof useSettingsStore.getState>['setEndpoint'];
  resetTokenStats: ReturnType<typeof useSettingsStore.getState>['resetTokenStats'];
}) {
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [modelSearch, setModelSearch] = useState('');

  const currentProvider = settings.cloudProvider;
  const currentConfig = providerConfigs[currentProvider];

  const handleFetchModels = async () => {
    setLoadingModels(true);
    const defaults = PROVIDER_DEFAULTS[currentProvider];
    const endpoint = currentConfig?.endpoint || defaults.defaultEndpoint;
    const result = await fetchModels(currentProvider, endpoint, currentConfig?.apiKey || '');
    setModels(result);
    setLoadingModels(false);
  };

  const filteredModels = modelSearch
    ? models.filter((m) => m.toLowerCase().includes(modelSearch.toLowerCase()))
    : models;

  const inputStyle: React.CSSProperties = {
    background: 'var(--input-bg)',
    color: 'var(--text-primary)',
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 11,
    outline: 'none',
    border: '0.5px solid var(--border-subtle)',
  };

  return (
    <>
      <SectionTitle>Modo de Inferencia</SectionTitle>
      <GlassCard>
        <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          {(['local', 'api'] as const).map((mode) => (
            <motion.button
              key={mode}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => updateSettings({ inferenceMode: mode })}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 500,
                background: settings.inferenceMode === mode ? 'var(--color-accent)' : 'var(--surface-secondary)',
                color: settings.inferenceMode === mode ? 'white' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.15s ease, color 0.15s ease',
              }}
            >
              {mode === 'local' ? 'Local (Ollama)' : 'API na Nuvem'}
            </motion.button>
          ))}
        </div>
      </GlassCard>

      {settings.inferenceMode === 'local' ? (
        <>
          <SectionTitle>Ollama</SectionTitle>
          <GlassCard>
            <SettingRow label="Modelo">
              <input
                value={settings.localModel}
                onChange={(e) => updateSettings({ localModel: e.target.value })}
                placeholder="gemma3:4b"
                style={{ ...inputStyle, width: 160 }}
              />
            </SettingRow>
          </GlassCard>
        </>
      ) : (
        <>
          <SectionTitle>Provedor</SectionTitle>
          <GlassCard>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(Object.keys(PROVIDER_DEFAULTS) as CloudProvider[]).map((p) => (
                <motion.button
                  key={p}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setProvider(p)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: 11,
                    background: currentProvider === p ? 'var(--color-accent)' : 'var(--surface-secondary)',
                    color: currentProvider === p ? 'white' : 'var(--text-secondary)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease, color 0.15s ease',
                  }}
                >
                  {PROVIDER_DEFAULTS[p].displayName}
                </motion.button>
              ))}
            </div>
          </GlassCard>

          <SectionTitle>API Key</SectionTitle>
          <GlassCard>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type={showApiKey ? 'text' : 'password'}
                value={currentConfig?.apiKey || ''}
                onChange={(e) => setApiKey(currentProvider, e.target.value)}
                placeholder="sk-..."
                style={{ ...inputStyle, flex: 1, fontFamily: "'SF Mono', monospace" }}
              />
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowApiKey(!showApiKey)}
                style={{
                  padding: 6,
                  color: 'var(--text-muted)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </motion.button>
            </div>
          </GlassCard>

          <SectionTitle>Endpoint</SectionTitle>
          <GlassCard>
            <input
              value={currentConfig?.endpoint || ''}
              onChange={(e) => setEndpoint(currentProvider, e.target.value)}
              style={{ ...inputStyle, width: '100%', fontFamily: "'SF Mono', monospace" }}
            />
          </GlassCard>

          <SectionTitle>Modelo</SectionTitle>
          <GlassCard>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <input
                value={currentConfig?.model || ''}
                onChange={(e) => setModel(currentProvider, e.target.value)}
                placeholder="Modelo..."
                style={{ ...inputStyle, flex: 1 }}
              />
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleFetchModels}
                disabled={loadingModels}
                title="Buscar modelos"
                style={{
                  padding: 6,
                  borderRadius: 6,
                  color: 'var(--text-secondary)',
                  background: 'transparent',
                  border: 'none',
                  cursor: loadingModels ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <RefreshCw size={14} className={loadingModels ? 'animate-spin' : ''} />
              </motion.button>
            </div>

            {models.length > 0 && (
              <>
                <input
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  placeholder="Filtrar modelos..."
                  style={{ ...inputStyle, width: '100%', marginBottom: 4 }}
                />
                <div
                  style={{
                    maxHeight: 160,
                    overflowY: 'auto',
                    borderRadius: 8,
                    border: '0.5px solid var(--border-subtle)',
                  }}
                >
                  {filteredModels.map((m) => (
                    <motion.button
                      key={m}
                      whileHover={{ backgroundColor: 'var(--surface-hover)' }}
                      onClick={() => setModel(currentProvider, m)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '6px 12px',
                        fontSize: 11,
                        color: currentConfig?.model === m ? 'var(--color-accent)' : 'var(--text-secondary)',
                        background: currentConfig?.model === m ? 'color-mix(in srgb, var(--color-accent) 15%, transparent)' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {m}
                    </motion.button>
                  ))}
                </div>
              </>
            )}
          </GlassCard>
        </>
      )}

      <SectionTitle>Tokens</SectionTitle>
      <GlassCard>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
          <span>Input: {settings.tokenStats.inputTokens.toLocaleString()}</span>
          <span>Output: {settings.tokenStats.outputTokens.toLocaleString()}</span>
          <span>Total: {settings.tokenStats.totalTokens.toLocaleString()}</span>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={resetTokenStats}
          style={{
            fontSize: 11,
            color: 'var(--color-accent)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          Resetar contagem
        </motion.button>
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
            outline: 'none',
            border: '0.5px solid var(--border-subtle)',
            resize: 'none',
          }}
        />
      </GlassCard>

      <SectionTitle>Parametros</SectionTitle>
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
    </>
  );
}

function ShortcutsTab({
  settings,
  updateSettings,
}: {
  settings: ReturnType<typeof useSettingsStore.getState>['settings'];
  updateSettings: ReturnType<typeof useSettingsStore.getState>['updateSettings'];
}) {
  const inputStyle: React.CSSProperties = {
    width: 176,
    background: 'var(--input-bg)',
    color: 'var(--text-primary)',
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 11,
    outline: 'none',
    border: '0.5px solid var(--border-subtle)',
    textAlign: 'center',
    fontFamily: "'SF Mono', monospace",
  };

  return (
    <>
      <SectionTitle>Atalhos Globais</SectionTitle>
      <GlassCard>
        <SettingRow label="Processar Clipboard">
          <input
            value={settings.shortcuts.clipboard}
            onChange={(e) => updateSettings({ shortcuts: { ...settings.shortcuts, clipboard: e.target.value } })}
            style={inputStyle}
          />
        </SettingRow>
        <SettingRow label="Analisar Tela">
          <input
            value={settings.shortcuts.screenCapture}
            onChange={(e) => updateSettings({ shortcuts: { ...settings.shortcuts, screenCapture: e.target.value } })}
            style={inputStyle}
          />
        </SettingRow>
        <SettingRow label="Quick Input">
          <input
            value={settings.shortcuts.quickInput}
            onChange={(e) => updateSettings({ shortcuts: { ...settings.shortcuts, quickInput: e.target.value } })}
            style={inputStyle}
          />
        </SettingRow>
      </GlassCard>
    </>
  );
}
