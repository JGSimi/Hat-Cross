import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, X, Trash2, Monitor, Cloud, GraduationCap } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { getGreeting } from '../../utils/markdown';
import { useSettingsStore } from '../../stores/settingsStore';
import { useChatStore } from '../../stores/chatStore';

const btnStyle: React.CSSProperties = {
  padding: 5,
  borderRadius: 6,
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'rgba(255,255,255,0.4)',
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

  return (
    <div
      data-tauri-drag-region
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        background: 'rgba(255, 255, 255, 0.02)',
        cursor: 'grab',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        flexShrink: 0,
      }}
    >
      {/* Left — hat icon + greeting + model */}
      <div data-tauri-drag-region style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <div
          data-tauri-drag-region
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, #000))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
          }}
        >
          <GraduationCap size={13} color="white" strokeWidth={2.5} />
        </div>
        <span
          data-tauri-drag-region
          style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)', letterSpacing: -0.2 }}
        >
          {greeting}
        </span>
        <div
          data-tauri-drag-region
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 7px',
            borderRadius: 6,
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {isLocal ? <Monitor size={9} color="rgba(255,255,255,0.4)" /> : <Cloud size={9} color="rgba(255,255,255,0.4)" />}
          <span
            data-tauri-drag-region
            style={{
              fontSize: 10,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.5)',
              maxWidth: 70,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {modelName}
          </span>
        </div>
      </div>

      {/* Right — action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AnimatePresence>
          {hasMessages && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.15, color: 'rgba(255,255,255,0.7)' }}
              whileTap={{ scale: 0.9 }}
              onClick={() => clearMessages()}
              title="Limpar conversa"
              style={btnStyle}
            >
              <Trash2 size={13} />
            </motion.button>
          )}
        </AnimatePresence>
        <motion.button
          whileHover={{ scale: 1.15, color: 'rgba(255,255,255,0.7)' }}
          whileTap={{ scale: 0.9 }}
          onClick={() => invoke('open_main_window')}
          title="Janela principal"
          style={btnStyle}
        >
          <Maximize2 size={13} />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.15, color: '#f87171' }}
          whileTap={{ scale: 0.9 }}
          onClick={() => invoke('close_window', { label: 'popover' })}
          title="Fechar"
          style={btnStyle}
        >
          <X size={13} />
        </motion.button>
      </div>
    </div>
  );
}
