import { Maximize2, X, Trash2, Monitor, Cloud } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { getGreeting } from '../../utils/markdown';
import { useSettingsStore } from '../../stores/settingsStore';
import { useChatStore } from '../../stores/chatStore';

export default function PopoverHeader() {
  const settings = useSettingsStore((s) => s.settings);
  const providerConfigs = useSettingsStore((s) => s.providerConfigs);
  const hasMessages = useChatStore((s) => s.messages.length > 0);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const greeting = getGreeting();

  const isLocal = settings.inferenceMode === 'local';
  const modelName = isLocal
    ? settings.localModel
    : providerConfigs[settings.cloudProvider]?.model || 'Selecionar';

  const handleExpand = () => {
    invoke('open_main_window');
  };

  const handleClose = () => {
    invoke('close_window', { label: 'popover' });
  };

  const handleClear = () => {
    clearMessages();
  };

  return (
    <div
      className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--color-border)]"
      data-tauri-drag-region
    >
      <div className="flex items-center gap-2" data-tauri-drag-region>
        <span className="text-base" data-tauri-drag-region>🎩</span>
        <span className="text-sm font-medium text-[var(--color-text-primary)]" data-tauri-drag-region>
          {greeting}
        </span>
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]">
          {isLocal ? (
            <Monitor size={10} className="text-[var(--color-text-muted)]" />
          ) : (
            <Cloud size={10} className="text-[var(--color-text-muted)]" />
          )}
          <span className="text-[10px] text-[var(--color-text-secondary)] max-w-[80px] truncate">
            {modelName}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-0.5">
        {hasMessages && (
          <button
            onClick={handleClear}
            className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
            title="Limpar conversa"
          >
            <Trash2 size={14} />
          </button>
        )}
        <button
          onClick={handleExpand}
          className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
          title="Abrir janela principal"
        >
          <Maximize2 size={14} />
        </button>
        <button
          onClick={handleClose}
          className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title="Fechar"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
