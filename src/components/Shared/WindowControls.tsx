import { useState, type CSSProperties } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { usePlatform, type Platform } from '../../hooks/usePlatform';

interface Props {
  variant?: 'sidebar' | 'header';
}

function closeOrQuit(appWindow: ReturnType<typeof getCurrentWindow>, _platform: Platform) {
  invoke('quit_app').catch(() => appWindow.close());
}

export default function WindowControls({ variant = 'sidebar' }: Props) {
  const platform = usePlatform();
  let appWindow: ReturnType<typeof getCurrentWindow>;
  try {
    appWindow = getCurrentWindow();
  } catch {
    return null;
  }

  if (platform === 'macos' && variant === 'sidebar') {
    return <MacControls appWindow={appWindow} platform={platform} />;
  }

  if (platform !== 'macos' && variant === 'header') {
    return <MinimalControls appWindow={appWindow} platform={platform} />;
  }

  return null;
}

function MacControls({ appWindow, platform }: { appWindow: ReturnType<typeof getCurrentWindow>; platform: Platform }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      data-no-drag
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
        data-no-drag
        onClick={() => closeOrQuit(appWindow, platform)}
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
        aria-label="Fechar janela"
      >
        ✕
      </button>
      <button
        data-no-drag
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
        aria-label="Minimizar janela"
      >
        −
      </button>
      <button
        data-no-drag
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
        aria-label="Maximizar janela"
      >
        ⤢
      </button>
    </div>
  );
}

function MinimalControls({ appWindow, platform }: { appWindow: ReturnType<typeof getCurrentWindow>; platform: Platform }) {
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
      data-no-drag
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        flexShrink: 0,
      }}
    >
      <button
        data-no-drag
        onMouseEnter={() => setHoveredBtn('min')}
        onMouseLeave={() => setHoveredBtn(null)}
        onClick={() => appWindow.minimize()}
        style={{
          ...btnBase,
          background: hoveredBtn === 'min' ? 'var(--surface-hover)' : 'transparent',
          opacity: hoveredBtn === 'min' ? 1 : btnBase.opacity,
        }}
        title="Minimizar"
        aria-label="Minimizar janela"
      >
        <svg width="8" height="1" viewBox="0 0 8 1" fill="currentColor">
          <rect width="8" height="1" />
        </svg>
      </button>
      <button
        data-no-drag
        onMouseEnter={() => setHoveredBtn('max')}
        onMouseLeave={() => setHoveredBtn(null)}
        onClick={() => appWindow.toggleMaximize()}
        style={{
          ...btnBase,
          background: hoveredBtn === 'max' ? 'var(--surface-hover)' : 'transparent',
          opacity: hoveredBtn === 'max' ? 1 : btnBase.opacity,
        }}
        title="Maximizar"
        aria-label="Maximizar janela"
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1">
          <rect x="0.5" y="0.5" width="7" height="7" rx="1" />
        </svg>
      </button>
      <button
        data-no-drag
        onMouseEnter={() => setHoveredBtn('close')}
        onMouseLeave={() => setHoveredBtn(null)}
        onClick={() => closeOrQuit(appWindow, platform)}
        style={{
          ...btnBase,
          background: hoveredBtn === 'close' ? 'rgba(232, 17, 35, 0.9)' : 'transparent',
          color: hoveredBtn === 'close' ? '#fff' : 'var(--text-muted)',
          opacity: hoveredBtn === 'close' ? 1 : btnBase.opacity,
        }}
        title="Fechar"
        aria-label="Fechar janela"
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.2">
          <line x1="1" y1="1" x2="7" y2="7" />
          <line x1="7" y1="1" x2="1" y2="7" />
        </svg>
      </button>
    </div>
  );
}
