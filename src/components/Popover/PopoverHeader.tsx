import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, X, Trash2, GraduationCap, Grid3X3 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow, primaryMonitor } from '@tauri-apps/api/window';
import { PhysicalPosition } from '@tauri-apps/api/dpi';
import { getGreeting } from '../../utils/markdown';
import { useSettingsStore } from '../../stores/settingsStore';
import { useChatStore } from '../../stores/chatStore';

type Corner = 'tl' | 'tr' | 'bl' | 'br' | 'c';

async function snapTo(corner: Corner) {
  try {
    const win = getCurrentWindow();
    const monitor = await primaryMonitor();
    if (!monitor) return;

    const winSize = await win.outerSize(); // PhysicalSize
    const sw = monitor.size.width;
    const sh = monitor.size.height;
    const ww = winSize.width;
    const wh = winSize.height;
    const pad = 20;
    const topPad = 40; // menu bar height

    const pos: Record<Corner, [number, number]> = {
      tl: [pad, topPad],
      tr: [sw - ww - pad, topPad],
      bl: [pad, sh - wh - pad],
      br: [sw - ww - pad, sh - wh - pad],
      c: [Math.round((sw - ww) / 2), Math.round((sh - wh) / 2)],
    };

    const [x, y] = pos[corner];
    await win.setPosition(new PhysicalPosition(x, y));
  } catch (e) {
    console.error('snapTo failed:', e);
  }
}

const btnBase: React.CSSProperties = {
  padding: 6,
  borderRadius: 6,
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#666',
};

export default function PopoverHeader() {
  const settings = useSettingsStore((s) => s.settings);
  const providerConfigs = useSettingsStore((s) => s.providerConfigs);
  const hasMessages = useChatStore((s) => s.messages.length > 0);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const [showGrid, setShowGrid] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const greeting = getGreeting();

  const isLocal = settings.inferenceMode === 'local';
  const modelName = isLocal
    ? settings.localModel
    : providerConfigs[settings.cloudProvider]?.model || '—';

  // Close grid on click outside
  useEffect(() => {
    if (!showGrid) return;
    const handler = (e: MouseEvent) => {
      if (gridRef.current && !gridRef.current.contains(e.target as Node)) {
        setShowGrid(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showGrid]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '7px 10px',
        borderBottom: '1px solid #1a1a22',
        flexShrink: 0,
        position: 'relative',
        background: '#101016',
      }}
    >
      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div
          style={{
            width: 24, height: 24, borderRadius: 7,
            background: 'var(--color-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <GraduationCap size={14} color="white" strokeWidth={2.5} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#e0e0e4' }}>
          {greeting}
        </span>
        <span
          style={{
            fontSize: 10, color: '#555', padding: '1px 6px',
            borderRadius: 4, background: '#1a1a22',
            maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {isLocal ? '🖥' : '☁'} {modelName}
        </span>
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {/* Grid position */}
        <div ref={gridRef} style={{ position: 'relative' }}>
          <motion.button
            whileHover={{ color: '#aaa' }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowGrid(!showGrid)}
            title="Posição na tela"
            style={{ ...btnBase, color: showGrid ? 'var(--color-accent)' : '#666' }}
          >
            <Grid3X3 size={14} />
          </motion.button>

          <AnimatePresence>
            {showGrid && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 4,
                  background: '#161620', border: '1px solid #222', borderRadius: 8,
                  padding: 6, zIndex: 999, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 28px)', gap: 3 }}>
                  <PosBtn label="↖" onClick={() => { snapTo('tl'); setShowGrid(false); }} />
                  <PosBtn label="↑" disabled />
                  <PosBtn label="↗" onClick={() => { snapTo('tr'); setShowGrid(false); }} />
                  <PosBtn label="←" disabled />
                  <PosBtn label="•" onClick={() => { snapTo('c'); setShowGrid(false); }} accent />
                  <PosBtn label="→" disabled />
                  <PosBtn label="↙" onClick={() => { snapTo('bl'); setShowGrid(false); }} />
                  <PosBtn label="↓" disabled />
                  <PosBtn label="↘" onClick={() => { snapTo('br'); setShowGrid(false); }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {hasMessages && (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              whileHover={{ color: '#aaa' }}
              whileTap={{ scale: 0.9 }}
              onClick={() => clearMessages()}
              title="Limpar"
              style={btnBase}
            >
              <Trash2 size={14} />
            </motion.button>
          )}
        </AnimatePresence>

        <motion.button
          whileHover={{ color: '#aaa' }}
          whileTap={{ scale: 0.9 }}
          onClick={() => invoke('open_main_window')}
          title="Janela principal"
          style={btnBase}
        >
          <Maximize2 size={14} />
        </motion.button>

        <motion.button
          whileHover={{ color: '#f87171' }}
          whileTap={{ scale: 0.9 }}
          onClick={() => invoke('close_window', { label: 'popover' })}
          title="Fechar"
          style={btnBase}
        >
          <X size={14} />
        </motion.button>
      </div>
    </div>
  );
}

function PosBtn({ label, onClick, disabled, accent }: {
  label: string; onClick?: () => void; disabled?: boolean; accent?: boolean;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        width: 28, height: 28, borderRadius: 5,
        background: accent ? 'var(--color-accent)' : disabled ? 'transparent' : '#1e1e28',
        border: disabled ? 'none' : '1px solid #2a2a35',
        color: disabled ? '#333' : accent ? 'white' : '#888',
        fontSize: 13, cursor: disabled ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = accent ? 'var(--color-accent-hover)' : '#282838'; }}
      onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.background = accent ? 'var(--color-accent)' : '#1e1e28'; }}
    >
      {label}
    </button>
  );
}
