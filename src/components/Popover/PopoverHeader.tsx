import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, X, Trash2, Monitor, Cloud, GraduationCap, LayoutGrid } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow, currentMonitor } from '@tauri-apps/api/window';
import { LogicalPosition } from '@tauri-apps/api/dpi';
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

type Corner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'center';

async function snapToPosition(corner: Corner) {
  const win = getCurrentWindow();
  const monitor = await currentMonitor();
  if (!monitor) return;

  const winSize = await win.outerSize();
  const scale = monitor.scaleFactor;
  const screenW = monitor.size.width / scale;
  const screenH = monitor.size.height / scale;
  const winW = winSize.width / scale;
  const winH = winSize.height / scale;
  const pad = 12;

  const positions: Record<Corner, [number, number]> = {
    topLeft: [pad, pad + 28],
    topRight: [screenW - winW - pad, pad + 28],
    bottomLeft: [pad, screenH - winH - pad],
    bottomRight: [screenW - winW - pad, screenH - winH - pad],
    center: [(screenW - winW) / 2, (screenH - winH) / 2],
  };

  const [x, y] = positions[corner];
  await win.setPosition(new LogicalPosition(x, y));
}

export default function PopoverHeader() {
  const settings = useSettingsStore((s) => s.settings);
  const providerConfigs = useSettingsStore((s) => s.providerConfigs);
  const hasMessages = useChatStore((s) => s.messages.length > 0);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const [showGrid, setShowGrid] = useState(false);
  const greeting = getGreeting();

  const isLocal = settings.inferenceMode === 'local';
  const modelName = isLocal
    ? settings.localModel
    : providerConfigs[settings.cloudProvider]?.model || 'Selecionar';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        background: 'rgba(255, 255, 255, 0.02)',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {/* Left — hat icon + greeting + model */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <div
          style={{
            width: 22, height: 22, borderRadius: 6,
            background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, #000))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
          }}
        >
          <GraduationCap size={13} color="white" strokeWidth={2.5} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)', letterSpacing: -0.2 }}>
          {greeting}
        </span>
        <div
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 7px', borderRadius: 6,
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {isLocal ? <Monitor size={9} color="rgba(255,255,255,0.4)" /> : <Cloud size={9} color="rgba(255,255,255,0.4)" />}
          <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.5)', maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {modelName}
          </span>
        </div>
      </div>

      {/* Right — action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {/* Position grid button */}
        <motion.button
          whileHover={{ scale: 1.15, color: 'rgba(255,255,255,0.7)' }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowGrid(!showGrid)}
          title="Posição"
          style={{ ...btnStyle, color: showGrid ? 'var(--color-accent)' : btnStyle.color }}
        >
          <LayoutGrid size={13} />
        </motion.button>

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

      {/* Position grid dropdown */}
      <AnimatePresence>
        {showGrid && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -4 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            style={{
              position: 'absolute',
              top: '100%',
              right: 12,
              marginTop: 6,
              background: 'rgba(20, 20, 28, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              padding: 8,
              zIndex: 100,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}
          >
            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, textAlign: 'center' }}>
              Posição
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, width: 90 }}>
              {/* Top row */}
              <GridBtn corner="topLeft" label="↖" onClick={() => { snapToPosition('topLeft'); setShowGrid(false); }} />
              <GridBtn corner="center" label="—" onClick={() => { /* top center not needed */ }} empty />
              <GridBtn corner="topRight" label="↗" onClick={() => { snapToPosition('topRight'); setShowGrid(false); }} />
              {/* Middle row */}
              <GridBtn corner="center" label="—" onClick={() => {}} empty />
              <GridBtn corner="center" label="◉" onClick={() => { snapToPosition('center'); setShowGrid(false); }} />
              <GridBtn corner="center" label="—" onClick={() => {}} empty />
              {/* Bottom row */}
              <GridBtn corner="bottomLeft" label="↙" onClick={() => { snapToPosition('bottomLeft'); setShowGrid(false); }} />
              <GridBtn corner="center" label="—" onClick={() => {}} empty />
              <GridBtn corner="bottomRight" label="↘" onClick={() => { snapToPosition('bottomRight'); setShowGrid(false); }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GridBtn({ label, onClick, empty }: { corner: Corner; label: string; onClick: () => void; empty?: boolean }) {
  if (empty) {
    return <div style={{ width: 26, height: 26 }} />;
  }
  return (
    <motion.button
      whileHover={{ scale: 1.15, background: 'rgba(255,255,255,0.12)' }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      style={{
        width: 26, height: 26, borderRadius: 6,
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {label}
    </motion.button>
  );
}
