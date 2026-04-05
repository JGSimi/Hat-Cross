import { useState, type CSSProperties } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { usePlatform } from '../../hooks/usePlatform';

export default function WindowControls() {
  const platform = usePlatform();
  const appWindow = getCurrentWindow();

  // macOS uses native traffic lights via titleBarStyle overlay
  if (platform === 'macos') return null;

  return <MinimalControls appWindow={appWindow} />;
}

function MinimalControls({ appWindow }: { appWindow: ReturnType<typeof getCurrentWindow> }) {
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  const btnBase: CSSProperties = {
    width: 28,
    height: 24,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-muted)',
    fontSize: 10,
    padding: 0,
    borderRadius: 4,
    transition: 'background 0.15s, color 0.15s, opacity 0.15s',
    opacity: hoveredBtn ? 1 : 0.6,
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        flexShrink: 0,
      }}
    >
      <button
        onMouseEnter={() => setHoveredBtn('min')}
        onMouseLeave={() => setHoveredBtn(null)}
        onClick={() => appWindow.minimize()}
        style={{
          ...btnBase,
          background: hoveredBtn === 'min' ? 'var(--surface-hover)' : 'transparent',
          opacity: hoveredBtn === 'min' ? 1 : btnBase.opacity,
        }}
        title="Minimizar"
      >
        <svg width="8" height="1" viewBox="0 0 8 1" fill="currentColor">
          <rect width="8" height="1" />
        </svg>
      </button>
      <button
        onMouseEnter={() => setHoveredBtn('max')}
        onMouseLeave={() => setHoveredBtn(null)}
        onClick={() => appWindow.toggleMaximize()}
        style={{
          ...btnBase,
          background: hoveredBtn === 'max' ? 'var(--surface-hover)' : 'transparent',
          opacity: hoveredBtn === 'max' ? 1 : btnBase.opacity,
        }}
        title="Maximizar"
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1">
          <rect x="0.5" y="0.5" width="7" height="7" rx="1" />
        </svg>
      </button>
      <button
        onMouseEnter={() => setHoveredBtn('close')}
        onMouseLeave={() => setHoveredBtn(null)}
        onClick={() => appWindow.close()}
        style={{
          ...btnBase,
          background: hoveredBtn === 'close' ? 'rgba(232, 17, 35, 0.9)' : 'transparent',
          color: hoveredBtn === 'close' ? '#fff' : 'var(--text-muted)',
          opacity: hoveredBtn === 'close' ? 1 : btnBase.opacity,
        }}
        title="Fechar"
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.2">
          <line x1="1" y1="1" x2="7" y2="7" />
          <line x1="7" y1="1" x2="1" y2="7" />
        </svg>
      </button>
    </div>
  );
}
