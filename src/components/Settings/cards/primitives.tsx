import React, { useRef, useState } from 'react';
import { usePlatform } from '../../../hooks/usePlatform';
import { formatShortcut } from '../../../utils/formatShortcut';

// =============================================================================
// Settings primitives
//
// These components share layout & typography via CSS classes in `src/index.css`
// (`.settings-*`). Keep visuals there so the cards themselves stay declarative
// and every card picks up spacing/breakpoint changes for free.
// =============================================================================

// ---- Section ---------------------------------------------------------------
// Groups a sub-heading + rows. First section has no top margin so the card
// body never has an awkward gap above the first label.

export function Section({
  title,
  meta,
  children,
}: {
  title?: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="settings-section">
      {(title || meta) && (
        <header className="settings-section__head">
          {title && <h4 className="settings-section__title">{title}</h4>}
          {meta && <span className="settings-section__meta">{meta}</span>}
        </header>
      )}
      <div className="settings-section__body">{children}</div>
    </section>
  );
}

// ---- Row -------------------------------------------------------------------
// Label + control on one line; label flex-grows so the control never pushes it
// into an ugly 3-line wrap on narrow cards.

export function Row({
  label,
  hint,
  children,
  align = 'center',
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
  align?: 'center' | 'start';
}) {
  return (
    <div className="settings-row">
      <div
        className="settings-row__main"
        style={{ alignItems: align === 'start' ? 'flex-start' : 'center' }}
      >
        {label !== undefined && (
          <label className="settings-row__label">{label}</label>
        )}
        <div className="settings-row__control">{children}</div>
      </div>
      {hint && <p className="settings-row__hint">{hint}</p>}
    </div>
  );
}

// ---- StackRow --------------------------------------------------------------
// Label + optional value chip on top, content (e.g. slider) on bottom full
// width. Ideal for range controls that need breathing room.

export function StackRow({
  label,
  value,
  hint,
  children,
}: {
  label: React.ReactNode;
  value?: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="settings-row">
      <div className="settings-row__stackhead">
        <label className="settings-row__label">{label}</label>
        {value !== undefined && (
          <span className="settings-row__value">{value}</span>
        )}
      </div>
      <div className="settings-row__stackbody">{children}</div>
      {hint && <p className="settings-row__hint">{hint}</p>}
    </div>
  );
}

// ---- SubHeading (back-compat shim) ----------------------------------------
// Kept so any stray usage still compiles. Prefer `<Section>`.

export function SubHeading({ children }: { children: React.ReactNode }) {
  return <h4 className="settings-section__title settings-section__title--loose">{children}</h4>;
}

// ---- SettingRow (back-compat shim) ----------------------------------------
// Delegates to Row so existing cards still work without a big-bang rewrite.

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
    <Row label={label} hint={hint}>
      {children}
    </Row>
  );
}

// ---- Toggle ---------------------------------------------------------------

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`settings-toggle ${checked ? 'is-on' : ''} ${disabled ? 'is-disabled' : ''}`}
    >
      <span className="settings-toggle__thumb" aria-hidden />
    </button>
  );
}

// ---- Slider ---------------------------------------------------------------
// Fills the row body. Callers shouldn't set a fixed width anymore — if they
// need a compact slider inline, wrap it in a sized container.

export function Slider({
  min,
  max,
  step,
  value,
  onChange,
  ariaLabel,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  ariaLabel?: string;
}) {
  const pct = max > min ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0;
  return (
    <input
      type="range"
      aria-label={ariaLabel}
      className="settings-slider"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ ['--fill' as string]: `${pct}%` }}
    />
  );
}

// ---- PillGroup ------------------------------------------------------------
// Segmented control: single-choice amongst a small set of options.

export function PillGroup<T extends string | number>({
  options,
  value,
  onChange,
  size = 'md',
  disabled,
}: {
  options: { value: T; label: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
}) {
  return (
    <div
      className={`settings-pillgroup ${size === 'sm' ? 'is-sm' : ''} ${disabled ? 'is-disabled' : ''}`}
      role="radiogroup"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => !disabled && onChange(opt.value)}
            className={`settings-pill ${active ? 'is-active' : ''}`}
          >
            {opt.icon && <span className="settings-pill__icon">{opt.icon}</span>}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ---- ShortcutRecorder -----------------------------------------------------

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
      : 'Definir';

  return (
    <button
      ref={ref}
      type="button"
      className={`settings-kbd ${recording ? 'is-recording' : ''} ${!value && !recording ? 'is-empty' : ''}`}
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
