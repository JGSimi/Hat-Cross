import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, RefreshCw, Eye, EyeOff, Bot, Brain, Zap, Shuffle, Globe, Monitor, Cloud, Gem } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import ThemePicker from './ThemePicker';
import { useSettingsStore } from '../../stores/settingsStore';
import { PROVIDER_DEFAULTS, type CloudProvider } from '../../types';
import { fetchModels } from '../../services/ai';

interface Props {
  onClose: () => void;
}

type Tab = 'general' | 'clipboard' | 'appearance' | 'models' | 'behavior' | 'shortcuts';

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
    { id: 'clipboard', label: 'Clipboard' },
    { id: 'appearance', label: 'Aparência' },
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
      className="bg-atmosphere"
    >
      {/* Header */}
      <div
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
          Configurações
        </h2>
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
              {activeTab === 'general' && <GeneralTab />}
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
        <SettingRow label="Som ao completar">
          <Toggle checked={clip.soundOnComplete} onChange={(v) => update({ soundOnComplete: v })} />
        </SettingRow>
      </GlassCard>

      <SectionTitle>Resposta</SectionTitle>
      <GlassCard>
        <SettingRow label="Copiar resposta para o clipboard">
          <Toggle checked={clip.copyResponseToClipboard} onChange={(v) => update({ copyResponseToClipboard: v })} />
        </SettingRow>
        <SettingRow label="Mostrar resposta na notificação">
          <Toggle checked={clip.showNotificationWithResponse} onChange={(v) => update({ showNotificationWithResponse: v })} />
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
                borderRadius: 8, padding: '8px 12px', fontSize: 12, outline: 'none',
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

    </>
  );
}

// Popular models per provider (shown when API hasn't been fetched yet)
const POPULAR_MODELS: Record<string, string[]> = {
  google: ['gemini-2.5-flash-preview-05-20', 'gemini-2.5-pro-preview-05-06', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  openai: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o3', 'o4-mini', 'gpt-4o', 'gpt-4o-mini'],
  anthropic: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5-20251001', 'claude-3-5-sonnet-20241022'],
  inception: ['mercury-coder-small-beta'],
  openrouter: ['google/gemini-2.5-flash-preview', 'anthropic/claude-sonnet-4-6', 'openai/gpt-4.1', 'deepseek/deepseek-r1', 'meta-llama/llama-4-maverick'],
  custom: [],
};

// Provider icon component
function ProviderIcon({ provider, size = 14 }: { provider: string; size?: number }) {
  const style = { color: 'currentColor' };
  switch (provider) {
    case 'google': return <Gem size={size} style={style} />;
    case 'openai': return <Bot size={size} style={style} />;
    case 'anthropic': return <Brain size={size} style={style} />;
    case 'inception': return <Zap size={size} style={style} />;
    case 'openrouter': return <Shuffle size={size} style={style} />;
    case 'custom': return <Globe size={size} style={style} />;
    default: return <Globe size={size} style={style} />;
  }
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
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');

  const currentProvider = settings.cloudProvider;
  const currentConfig = providerConfigs[currentProvider];
  const hasApiKey = !!(currentConfig?.apiKey);

  // Auto-fetch models when provider changes or API key is set
  useEffect(() => {
    if (settings.inferenceMode !== 'api') return;
    if (!hasApiKey) {
      setFetchedModels([]);
      setApiKeyStatus('idle');
      return;
    }
    let cancelled = false;
    const doFetch = async () => {
      setLoadingModels(true);
      const defaults = PROVIDER_DEFAULTS[currentProvider];
      const endpoint = currentConfig?.endpoint || defaults.defaultEndpoint;
      const result = await fetchModels(currentProvider, endpoint);
      if (!cancelled) {
        setFetchedModels(result);
        setLoadingModels(false);
        setApiKeyStatus(result.length > 0 ? 'valid' : 'invalid');
      }
    };
    // Debounce to avoid fetching on every keystroke of API key
    const timer = setTimeout(doFetch, 800);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [currentProvider, hasApiKey, currentConfig?.apiKey, currentConfig?.endpoint, settings.inferenceMode]);

  // Combine fetched models with popular defaults
  const allModels = fetchedModels.length > 0
    ? fetchedModels
    : POPULAR_MODELS[currentProvider] || [];

  const filteredModels = modelSearch
    ? allModels.filter((m) => m.toLowerCase().includes(modelSearch.toLowerCase()))
    : allModels;

  const inputStyle: React.CSSProperties = {
    background: 'var(--input-bg)',
    color: 'var(--text-primary)',
    borderRadius: 8,
    padding: '7px 12px',
    fontSize: 12,
    outline: 'none',
    border: '1px solid var(--border-subtle)',
    width: '100%',
    transition: 'border-color 0.15s ease',
  };

  return (
    <>
      {/* Inference mode toggle */}
      <SectionTitle>Modo de Inferência</SectionTitle>
      <GlassCard>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['api', 'local'] as const).map((mode) => (
            <motion.button
              key={mode}
              whileTap={{ scale: 0.97 }}
              onClick={() => updateSettings({ inferenceMode: mode })}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 8,
                fontSize: 12, fontWeight: 500,
                background: settings.inferenceMode === mode ? 'var(--color-accent)' : 'var(--surface-secondary)',
                color: settings.inferenceMode === mode ? 'white' : 'var(--text-muted)',
                border: settings.inferenceMode === mode ? 'none' : '1px solid var(--border-subtle)',
                cursor: 'pointer', transition: 'all 0.15s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {mode === 'local' ? <><Monitor size={13} /> Local (Ollama)</> : <><Cloud size={13} /> API na Nuvem</>}
            </motion.button>
          ))}
        </div>
      </GlassCard>

      {settings.inferenceMode === 'local' ? (
        <>
          <SectionTitle>Ollama</SectionTitle>
          <GlassCard>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
              Certifique-se que o Ollama está rodando em localhost:11434
            </p>
            <input
              value={settings.localModel}
              onChange={(e) => updateSettings({ localModel: e.target.value })}
              placeholder="gemma3:4b"
              style={inputStyle}
            />
          </GlassCard>
        </>
      ) : (
        <>
          {/* Provider selector */}
          <SectionTitle>Provedor</SectionTitle>
          <GlassCard>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {(Object.keys(PROVIDER_DEFAULTS) as CloudProvider[]).map((p) => (
                <motion.button
                  key={p}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setProvider(p)}
                  style={{
                    padding: '8px 4px', borderRadius: 8, fontSize: 11, fontWeight: 500,
                    background: currentProvider === p ? 'color-mix(in srgb, var(--color-accent) 15%, transparent)' : 'transparent',
                    color: currentProvider === p ? 'var(--color-accent)' : 'var(--text-secondary)',
                    border: currentProvider === p ? '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' : '1px solid var(--border-subtle)',
                    cursor: 'pointer', transition: 'all 0.15s ease',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  }}
                >
                  <ProviderIcon provider={p} size={13} />
                  {PROVIDER_DEFAULTS[p].displayName.split(' ')[0]}
                </motion.button>
              ))}
            </div>
          </GlassCard>

          {/* API Key with status */}
          <SectionTitle>
            API Key
            {apiKeyStatus === 'valid' && <span style={{ color: 'var(--success)', marginLeft: 6, fontSize: 9 }}>● conectado</span>}
            {apiKeyStatus === 'invalid' && hasApiKey && <span style={{ color: 'var(--error)', marginLeft: 6, fontSize: 9 }}>● inválida</span>}
          </SectionTitle>
          <GlassCard>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={currentConfig?.apiKey || ''}
                  onChange={(e) => { setApiKey(currentProvider, e.target.value); setApiKeyStatus('idle'); }}
                  placeholder={`Cole sua API key do ${PROVIDER_DEFAULTS[currentProvider].displayName}`}
                  style={{ ...inputStyle, fontFamily: "'SF Mono', 'Fira Code', monospace", fontSize: 11, paddingRight: 36 }}
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 2,
                  }}
                >
                  {showApiKey ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>
          </GlassCard>

          {/* Model selector — the main focus */}
          <SectionTitle>
            Modelo
            {loadingModels && <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: 9 }}>carregando...</span>}
          </SectionTitle>
          <GlassCard>
            {/* Search/filter input */}
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <input
                value={modelSearch || currentConfig?.model || ''}
                onChange={(e) => {
                  setModelSearch(e.target.value);
                  setModel(currentProvider, e.target.value);
                }}
                onFocus={() => { if (!modelSearch) setModelSearch(''); }}
                onBlur={() => setTimeout(() => setModelSearch(''), 200)}
                placeholder="Buscar ou digitar modelo..."
                style={{ ...inputStyle, fontSize: 12, fontWeight: currentConfig?.model ? 500 : 400 }}
              />
            </div>

            {/* Model list */}
            <div
              style={{
                maxHeight: 220, overflowY: 'auto', borderRadius: 8,
                border: '1px solid var(--border-subtle)',
              }}
            >
              {fetchedModels.length === 0 && !loadingModels && (
                <p style={{ fontSize: 10, color: 'var(--text-muted)', padding: '8px 12px', margin: 0, textAlign: 'center' }}>
                  {hasApiKey ? 'Modelos populares (conecte para ver todos)' : 'Adicione sua API key para buscar modelos'}
                </p>
              )}
              {filteredModels.map((m) => {
                const isSelected = currentConfig?.model === m;
                return (
                  <motion.button
                    key={m}
                    whileHover={{ backgroundColor: isSelected ? undefined : 'var(--surface-hover)' }}
                    onClick={() => { setModel(currentProvider, m); setModelSearch(''); }}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '7px 12px', fontSize: 11.5,
                      color: isSelected ? 'var(--color-accent)' : 'var(--text-primary)',
                      fontWeight: isSelected ? 600 : 400,
                      background: isSelected ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)' : 'transparent',
                      border: 'none', cursor: 'pointer',
                      borderLeft: isSelected ? '2px solid var(--color-accent)' : '2px solid transparent',
                      transition: 'all 0.1s ease',
                    }}
                  >
                    {m}
                  </motion.button>
                );
              })}
              {filteredModels.length === 0 && modelSearch && (
                <p style={{ fontSize: 11, color: 'var(--text-muted)', padding: '12px', margin: 0, textAlign: 'center' }}>
                  Nenhum modelo encontrado
                </p>
              )}
            </div>

            {/* Manual refresh */}
            {hasApiKey && (
              <motion.button
                whileHover={{ color: 'var(--color-accent)' }}
                whileTap={{ scale: 0.97 }}
                onClick={async () => {
                  setLoadingModels(true);
                  const defaults = PROVIDER_DEFAULTS[currentProvider];
                  const ep = currentConfig?.endpoint || defaults.defaultEndpoint;
                  const result = await fetchModels(currentProvider, ep);
                  setFetchedModels(result);
                  setLoadingModels(false);
                  setApiKeyStatus(result.length > 0 ? 'valid' : 'invalid');
                }}
                style={{
                  fontSize: 10, color: 'var(--text-muted)', background: 'none',
                  border: 'none', cursor: 'pointer', padding: '8px 0 0', display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <RefreshCw size={10} className={loadingModels ? 'animate-spin' : ''} />
                Atualizar lista de modelos
              </motion.button>
            )}
          </GlassCard>

          {/* Advanced: Endpoint (collapsed by default) */}
          <motion.button
            whileHover={{ color: 'var(--text-secondary)' }}
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              fontSize: 10, color: 'var(--text-muted)', background: 'none',
              border: 'none', cursor: 'pointer', padding: '4px 0 8px', display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            {showAdvanced ? '▾' : '▸'} Configuração avançada
          </motion.button>
          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: 'hidden' }}
              >
                <GlassCard>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>Endpoint da API</p>
                  <input
                    value={currentConfig?.endpoint || ''}
                    onChange={(e) => setEndpoint(currentProvider, e.target.value)}
                    style={{ ...inputStyle, fontFamily: "'SF Mono', 'Fira Code', monospace", fontSize: 10.5 }}
                  />
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Token stats */}
      <SectionTitle>Uso de Tokens</SectionTitle>
      <GlassCard>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
          {[
            { label: 'Input', value: settings.tokenStats.inputTokens },
            { label: 'Output', value: settings.tokenStats.outputTokens },
            { label: 'Total', value: settings.tokenStats.totalTokens },
          ].map((stat) => (
            <div key={stat.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {stat.value >= 1000 ? `${(stat.value / 1000).toFixed(1)}k` : stat.value}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{stat.label}</div>
            </div>
          ))}
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={resetTokenStats}
          style={{
            width: '100%', fontSize: 10, color: 'var(--text-muted)',
            background: 'var(--surface-secondary)', border: '1px solid var(--border-subtle)',
            borderRadius: 6, padding: '5px 0', cursor: 'pointer',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--error)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
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
