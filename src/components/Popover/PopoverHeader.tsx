import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, X, Trash2, Monitor, Cloud } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { getGreeting } from '../../utils/markdown';
import { useSettingsStore } from '../../stores/settingsStore';
import { useChatStore } from '../../stores/chatStore';

const btnMotion = {
  whileHover: { scale: 1.1 },
  whileTap: { scale: 0.96, opacity: 0.8 },
  transition: { type: 'spring' as const, stiffness: 400, damping: 20 },
};

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

  const handleExpand = () => invoke('open_main_window');
  const handleClose = () => invoke('close_window', { label: 'popover' });
  const handleClear = () => clearMessages();

  return (
    <div
      data-tauri-drag-region
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: '0.5px solid rgba(255, 255, 255, 0.07)',
        cursor: 'grab',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* Left side - all draggable */}
      <div
        data-tauri-drag-region
        style={{ display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'none' }}
      >
        <span data-tauri-drag-region style={{ fontSize: 14 }}>🎩</span>
        <span
          data-tauri-drag-region
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-primary)',
          }}
        >
          {greeting}
        </span>
        <div
          data-tauri-drag-region
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 9999,
            background: 'rgba(255, 255, 255, 0.08)',
            border: '0.5px solid rgba(255, 255, 255, 0.12)',
          }}
        >
          {isLocal ? (
            <Monitor size={10} style={{ color: 'var(--text-muted)' }} />
          ) : (
            <Cloud size={10} style={{ color: 'var(--text-muted)' }} />
          )}
          <span
            data-tauri-drag-region
            style={{
              fontSize: 10,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              maxWidth: 80,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {modelName}
          </span>
        </div>
      </div>

      {/* Right side - buttons (not draggable) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, pointerEvents: 'auto' }}>
        <AnimatePresence>
          {hasMessages && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              {...btnMotion}
              onClick={handleClear}
              title="Limpar conversa"
              style={{
                padding: 6,
                borderRadius: 6,
                color: 'var(--text-muted)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Trash2 size={14} />
            </motion.button>
          )}
        </AnimatePresence>
        <motion.button
          {...btnMotion}
          onClick={handleExpand}
          title="Abrir janela principal"
          style={{
            padding: 6,
            borderRadius: 6,
            color: 'var(--text-muted)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Maximize2 size={14} />
        </motion.button>
        <motion.button
          {...btnMotion}
          onClick={handleClose}
          title="Fechar"
          style={{
            padding: 6,
            borderRadius: 6,
            color: 'var(--text-muted)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={14} />
        </motion.button>
      </div>
    </div>
  );
}
