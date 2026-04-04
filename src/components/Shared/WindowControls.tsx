import { useState, type CSSProperties } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { usePlatform } from '../../hooks/usePlatform';

interface Props {
  variant?: 'sidebar' | 'header';
}

export default function WindowControls({ variant = 'sidebar' }: Props) {
  const platform = usePlatform();
  const appWindow = getCurrentWindow();

  if (platform === 'macos' && variant === 'sidebar') {
    return <MacControls appWindow={appWindow} />;
  }

  if (platform !== 'macos' && variant === 'header') {
    return <WinLinuxControls appWindow={appWindow} />;
  }

  return null;
}

function MacControls({ appWindow }: { appWindow: ReturnType<typeof getCurrentWindow> }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
      }}
    >
      <button
        onClick={() => appWindow.close()}
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: '#FF5F57',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          fontSize: 8,
          lineHeight: 1,
          color: hovered ? 'rgba(0,0,0,0.6)' : 'transparent',
          fontWeight: 700,
        }}
        title="Fechar"
      >
        ✕
      </button>
      <button
        onClick={() => appWindow.minimize()}
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: '#FEBC2E',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          fontSize: 10,
          lineHeight: 1,
          color: hovered ? 'rgba(0,0,0,0.6)' : 'transparent',
          fontWeight: 700,
        }}
        title="Minimizar"
      >
        −
      </button>
      <button
        onClick={() => appWindow.toggleMaximize()}
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: '#28C840',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          fontSize: 7,
          lineHeight: 1,
          color: hovered ? 'rgba(0,0,0,0.6)' : 'transparent',
          fontWeight: 700,
        }}
        title="Maximizar"
      >
        ⤢
      </button>
    </div>
  );
}

function WinLinuxControls({ appWindow }: { appWindow: ReturnType<typeof getCurrentWindow> }) {
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  const btnBase: CSSProperties = {
    width: 46,
    height: 32,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontFamily: 'inherit',
    borderRadius: 0,
    transition: 'background 0.15s',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
      <button
        onMouseEnter={() => setHoveredBtn('min')}
        onMouseLeave={() => setHoveredBtn(null)}
        onClick={() => appWindow.minimize()}
        style={{
          ...btnBase,
          borderRadius: '6px 0 0 6px',
          background: hoveredBtn === 'min' ? 'var(--surface-hover)' : 'transparent',
        }}
        title="Minimizar"
      >
        <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
          <rect width="10" height="1" />
        </svg>
      </button>
      <button
        onMouseEnter={() => setHoveredBtn('max')}
        onMouseLeave={() => setHoveredBtn(null)}
        onClick={() => appWindow.toggleMaximize()}
        style={{
          ...btnBase,
          background: hoveredBtn === 'max' ? 'var(--surface-hover)' : 'transparent',
        }}
        title="Maximizar"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
          <rect x="0.5" y="0.5" width="9" height="9" rx="1" />
        </svg>
      </button>
      <button
        onMouseEnter={() => setHoveredBtn('close')}
        onMouseLeave={() => setHoveredBtn(null)}
        onClick={() => appWindow.close()}
        style={{
          ...btnBase,
          borderRadius: '0 6px 6px 0',
          background: hoveredBtn === 'close' ? '#E81123' : 'transparent',
          color: hoveredBtn === 'close' ? '#fff' : 'var(--text-secondary)',
        }}
        title="Fechar"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
          <line x1="1" y1="1" x2="9" y2="9" />
          <line x1="9" y1="1" x2="1" y2="9" />
        </svg>
      </button>
    </div>
  );
}
