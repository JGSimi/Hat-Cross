import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { usePlatform } from '../../../hooks/usePlatform';
import { formatShortcut } from '../../../utils/formatShortcut';

// ---- SubHeading ---------------------------------------------------------

export function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4
      style={{
        fontSize: 9.5,
        fontWeight: 600,
        color: 'color-mix(in srgb, var(--text-muted) 70%, var(--color-accent))',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        margin: '12px 0 8px',
      }}
    >
      {children}
    </h4>
  );
}

// ---- SettingRow ---------------------------------------------------------

export function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ padding: '6px 0' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{label}</span>
        <div style={{ flexShrink: 0 }}>{children}</div>
      </div>
      {hint && (
        <p
          style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            margin: '4px 0 0',
            lineHeight: 1.4,
          }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

// ---- Toggle -------------------------------------------------------------

export function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      style={{
        width: 34,
        height: 19,
        borderRadius: 10,
        background: checked ? 'var(--color-accent)' : 'var(--surface-secondary)',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative',
        transition: 'background 0.2s ease',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <motion.div
        animate={{ x: checked ? 17 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={{
          width: 13,
          height: 13,
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

// ---- Slider -------------------------------------------------------------

export function Slider({
  min,
  max,
  step,
  value,
  onChange,
  width = 130,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  width?: number;
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
        width,
        accentColor: 'var(--color-accent)',
        cursor: 'pointer',
      }}
    />
  );
}

// ---- ShortcutRecorder ---------------------------------------------------

/** Maps keyboard event keys to Tauri-compatible accelerator names */
function keyToAccelerator(e: React.KeyboardEvent): string | null {
  const { code, key } = e;
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (/^F\d{1,2}$/.test(key)) return key;
  const specialMap: Record<string, string> = {
    Space: 'Space', Tab: 'Tab', Enter: 'Enter',
    ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
    Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
    Delete: 'Delete', Insert: 'Insert',
    Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
    Semicolon: ';', Quote: "'", Backquote: '`', Backslash: '\\',
    Comma: ',', Period: '.', Slash: '/',
    NumpadAdd: 'num+', NumpadSubtract: 'num-', NumpadMultiply: 'num*',
    NumpadDivide: 'num/', NumpadDecimal: 'numdec', NumpadEnter: 'numenter',
  };
  if (code.startsWith('Numpad') && /^Numpad\d$/.test(code)) return 'num' + code.slice(6);
  return specialMap[code] ?? null;
}

export function ShortcutRecorder({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [currentKeys, setCurrentKeys] = useState('');
  const platform = usePlatform();
  const ref = useRef<HTMLButtonElement>(null);

  const boxStyle: React.CSSProperties = {
    width: 180,
    minHeight: 28,
    background: recording
      ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)'
      : 'var(--input-bg)',
    color: recording ? 'var(--color-accent)' : 'var(--text-primary)',
    borderRadius: 8,
    padding: '5px 10px',
    fontSize: 10.5,
    border: recording
      ? '1.5px solid var(--color-accent)'
      : '0.5px solid var(--border-subtle)',
    textAlign: 'center',
    fontFamily: "'SF Mono', 'JetBrains Mono', monospace",
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!recording) return;
    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      setRecording(false);
      setCurrentKeys('');
      return;
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      onChange('');
      setRecording(false);
      setCurrentKeys('');
      return;
    }

    const isModifier = ['Control', 'Shift', 'Alt', 'Meta'].includes(e.key);

    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');

    if (isModifier) {
      setCurrentKeys(
        parts.length > 0 ? formatShortcut(parts.join('+'), platform) + '+...' : '',
      );
      return;
    }

    if (parts.length === 0) return;

    const mainKey = keyToAccelerator(e);
    if (!mainKey) return;

    parts.push(mainKey);
    const accelerator = parts.join('+');
    onChange(accelerator);
    setRecording(false);
    setCurrentKeys('');
  };

  const handleClick = () => {
    setRecording(true);
    setCurrentKeys('');
    setTimeout(() => ref.current?.focus(), 0);
  };

  const handleBlur = () => {
    setTimeout(() => {
      setRecording(false);
      setCurrentKeys('');
    }, 150);
  };

  const display = recording
    ? (currentKeys || 'Pressione as teclas...')
    : value
      ? formatShortcut(value, platform)
      : 'Clique para definir';

  return (
    <button
      ref={ref}
      type="button"
      style={boxStyle}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      title={
        recording
          ? 'Esc para cancelar, Backspace para limpar'
          : 'Clique para gravar um novo atalho'
      }
    >
      {display}
    </button>
  );
}
