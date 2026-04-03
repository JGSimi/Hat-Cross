import { useState, useEffect } from 'react';
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
    { id: 'appearance', label: 'Aparência' },
    { id: 'models', label: 'Modelos & IA' },
    { id: 'behavior', label: 'Comportamento' },
    { id: 'shortcuts', label: 'Atalhos' },
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-primary)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Configurações</h2>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Tab sidebar */}
        <div className="w-40 border-r border-[var(--color-border)] py-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full text-left px-4 py-2 text-xs transition-colors ${
                activeTab === tab.id
                  ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/10 border-r-2 border-[var(--color-accent)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
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
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
      {children}
    </h3>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-9 h-5 rounded-full transition-colors relative ${
        checked ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-bg-tertiary)]'
      }`}
    >
      <div
        className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
          checked ? 'translate-x-4.5' : 'translate-x-0.5'
        }`}
      />
    </button>
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
        // Auto download and install
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
      <SettingRow label="Notificações">
        <Toggle
          checked={settings.notificationsEnabled}
          onChange={(v) => updateSettings({ notificationsEnabled: v })}
        />
      </SettingRow>

      <SectionTitle>Atualizações</SectionTitle>
      <div className="flex items-center gap-3">
        <button
          onClick={handleCheckUpdate}
          disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50 transition-colors"
        >
          {updateStatus === 'checking' ? 'Verificando...' :
           updateStatus === 'downloading' ? `Baixando ${updateProgress}%` :
           updateStatus === 'uptodate' ? 'Atualizado!' :
           updateStatus === 'error' ? 'Erro ao verificar' :
           'Verificar atualizações'}
        </button>
      </div>

      <div className="pt-6 text-xs text-[var(--color-text-muted)]">Hat v{version}</div>
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
      <ThemePicker current={settings.theme} onChange={setTheme} />

      <SectionTitle>Popover</SectionTitle>
      <SettingRow label={`Largura: ${settings.popover.width}px`}>
        <input
          type="range"
          min={300}
          max={600}
          value={settings.popover.width}
          onChange={(e) =>
            updateSettings({
              popover: { ...settings.popover, width: Number(e.target.value) },
            })
          }
          className="w-32 accent-[var(--color-accent)]"
        />
      </SettingRow>
      <SettingRow label={`Altura: ${settings.popover.height}px`}>
        <input
          type="range"
          min={350}
          max={800}
          value={settings.popover.height}
          onChange={(e) =>
            updateSettings({
              popover: { ...settings.popover, height: Number(e.target.value) },
            })
          }
          className="w-32 accent-[var(--color-accent)]"
        />
      </SettingRow>
      <SettingRow label={`Opacidade: ${Math.round(settings.popover.opacity * 100)}%`}>
        <input
          type="range"
          min={0.3}
          max={1}
          step={0.05}
          value={settings.popover.opacity}
          onChange={(e) =>
            updateSettings({
              popover: { ...settings.popover, opacity: Number(e.target.value) },
            })
          }
          className="w-32 accent-[var(--color-accent)]"
        />
      </SettingRow>
      <SettingRow label="Vibrancy (Glassmorphism)">
        <Toggle
          checked={settings.popover.vibrancy}
          onChange={(v) =>
            updateSettings({ popover: { ...settings.popover, vibrancy: v } })
          }
        />
      </SettingRow>

      <SectionTitle>Modo Discreto (Stealth)</SectionTitle>
      <SettingRow label="Stealth Mode">
        <Toggle
          checked={settings.popover.stealthMode}
          onChange={(v) =>
            updateSettings({ popover: { ...settings.popover, stealthMode: v } })
          }
        />
      </SettingRow>
      {settings.popover.stealthMode && (
        <SettingRow
          label={`Opacidade Hover: ${Math.round(settings.popover.stealthHoverOpacity * 100)}%`}
        >
          <input
            type="range"
            min={0.1}
            max={0.8}
            step={0.05}
            value={settings.popover.stealthHoverOpacity}
            onChange={(e) =>
              updateSettings({
                popover: {
                  ...settings.popover,
                  stealthHoverOpacity: Number(e.target.value),
                },
              })
            }
            className="w-32 accent-[var(--color-accent)]"
          />
        </SettingRow>
      )}
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

  return (
    <>
      <SectionTitle>Modo de Inferência</SectionTitle>
      <div className="flex gap-2 mb-4">
        {(['local', 'api'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => updateSettings({ inferenceMode: mode })}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
              settings.inferenceMode === mode
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-input)]'
            }`}
          >
            {mode === 'local' ? '🖥 Local (Ollama)' : '☁️ API na Nuvem'}
          </button>
        ))}
      </div>

      {settings.inferenceMode === 'local' ? (
        <>
          <SectionTitle>Ollama</SectionTitle>
          <SettingRow label="Modelo">
            <input
              value={settings.localModel}
              onChange={(e) => updateSettings({ localModel: e.target.value })}
              placeholder="gemma3:4b"
              className="w-40 bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg px-3 py-1.5 text-xs outline-none border border-[var(--color-border)] focus:border-[var(--color-border-focus)]"
            />
          </SettingRow>
        </>
      ) : (
        <>
          <SectionTitle>Provedor</SectionTitle>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {(Object.keys(PROVIDER_DEFAULTS) as CloudProvider[]).map((p) => (
              <button
                key={p}
                onClick={() => setProvider(p)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  currentProvider === p
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-input)]'
                }`}
              >
                {PROVIDER_DEFAULTS[p].displayName}
              </button>
            ))}
          </div>

          <SectionTitle>API Key</SectionTitle>
          <div className="flex items-center gap-2 mb-4">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={currentConfig?.apiKey || ''}
              onChange={(e) => setApiKey(currentProvider, e.target.value)}
              placeholder="sk-..."
              className="flex-1 bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg px-3 py-2 text-xs outline-none border border-[var(--color-border)] focus:border-[var(--color-border-focus)] font-mono"
            />
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            >
              {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          <SectionTitle>Endpoint</SectionTitle>
          <input
            value={currentConfig?.endpoint || ''}
            onChange={(e) => setEndpoint(currentProvider, e.target.value)}
            className="w-full bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg px-3 py-2 text-xs outline-none border border-[var(--color-border)] focus:border-[var(--color-border-focus)] font-mono mb-4"
          />

          <SectionTitle>Modelo</SectionTitle>
          <div className="flex items-center gap-2 mb-2">
            <input
              value={currentConfig?.model || ''}
              onChange={(e) => setModel(currentProvider, e.target.value)}
              placeholder="Modelo..."
              className="flex-1 bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg px-3 py-2 text-xs outline-none border border-[var(--color-border)] focus:border-[var(--color-border-focus)]"
            />
            <button
              onClick={handleFetchModels}
              disabled={loadingModels}
              className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
              title="Buscar modelos"
            >
              <RefreshCw size={14} className={loadingModels ? 'animate-spin' : ''} />
            </button>
          </div>

          {models.length > 0 && (
            <div className="mb-4">
              <input
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                placeholder="Filtrar modelos..."
                className="w-full bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg px-3 py-1.5 text-xs outline-none border border-[var(--color-border)] mb-1"
              />
              <div className="max-h-40 overflow-y-auto rounded-lg border border-[var(--color-border)]">
                {filteredModels.map((m) => (
                  <button
                    key={m}
                    onClick={() => setModel(currentProvider, m)}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                      currentConfig?.model === m
                        ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <SectionTitle>Tokens</SectionTitle>
      <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] mb-2">
        <span>Input: {settings.tokenStats.inputTokens.toLocaleString()}</span>
        <span>Output: {settings.tokenStats.outputTokens.toLocaleString()}</span>
        <span>Total: {settings.tokenStats.totalTokens.toLocaleString()}</span>
      </div>
      <button
        onClick={resetTokenStats}
        className="text-xs text-[var(--color-accent)] hover:underline"
      >
        Resetar contagem
      </button>
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
      <textarea
        value={settings.systemPrompt}
        onChange={(e) => updateSettings({ systemPrompt: e.target.value })}
        rows={8}
        className="w-full bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg px-3 py-2 text-xs outline-none border border-[var(--color-border)] focus:border-[var(--color-border-focus)] resize-none"
      />

      <SectionTitle>Parâmetros</SectionTitle>
      <SettingRow label={`Temperature: ${settings.temperature}`}>
        <input
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={settings.temperature}
          onChange={(e) => updateSettings({ temperature: Number(e.target.value) })}
          className="w-32 accent-[var(--color-accent)]"
        />
      </SettingRow>
      <SettingRow label={`Max Tokens: ${settings.maxTokens}`}>
        <input
          type="range"
          min={256}
          max={32768}
          step={256}
          value={settings.maxTokens}
          onChange={(e) => updateSettings({ maxTokens: Number(e.target.value) })}
          className="w-32 accent-[var(--color-accent)]"
        />
      </SettingRow>
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
  return (
    <>
      <SectionTitle>Atalhos Globais</SectionTitle>
      <SettingRow label="Processar Clipboard">
        <input
          value={settings.shortcuts.clipboard}
          onChange={(e) =>
            updateSettings({
              shortcuts: { ...settings.shortcuts, clipboard: e.target.value },
            })
          }
          className="w-44 bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg px-3 py-1.5 text-xs outline-none border border-[var(--color-border)] focus:border-[var(--color-border-focus)] text-center font-mono"
        />
      </SettingRow>
      <SettingRow label="Analisar Tela">
        <input
          value={settings.shortcuts.screenCapture}
          onChange={(e) =>
            updateSettings({
              shortcuts: { ...settings.shortcuts, screenCapture: e.target.value },
            })
          }
          className="w-44 bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg px-3 py-1.5 text-xs outline-none border border-[var(--color-border)] focus:border-[var(--color-border-focus)] text-center font-mono"
        />
      </SettingRow>
      <SettingRow label="Quick Input">
        <input
          value={settings.shortcuts.quickInput}
          onChange={(e) =>
            updateSettings({
              shortcuts: { ...settings.shortcuts, quickInput: e.target.value },
            })
          }
          className="w-44 bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg px-3 py-1.5 text-xs outline-none border border-[var(--color-border)] focus:border-[var(--color-border-focus)] text-center font-mono"
        />
      </SettingRow>
    </>
  );
}
