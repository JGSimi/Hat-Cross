import { useEffect, useRef, useState } from 'react';
import {
  displayLabel,
  fromKeyboardEvent,
  type Platform,
} from '../domain/shortcuts/accelerator';

interface KeyCaptureProps {
  binding: string;
  platform: Platform;
  onChange: (binding: string) => void;
  label: string;
}

/**
 * Campo de atalho que DETECTA as teclas (não é input de texto). Clica →
 * "capturando" → o usuário pressiona a combinação → grava o binding canônico
 * (via fromKeyboardEvent, que ignora keydowns só-de-modificador até formar
 * um atalho válido). Esc cancela.
 */
export function KeyCapture({ binding, platform, onChange, label }: KeyCaptureProps) {
  const [capturing, setCapturing] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!capturing) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        setCapturing(false);
        return;
      }
      const captured = fromKeyboardEvent(
        {
          code: e.code,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          altKey: e.altKey,
          shiftKey: e.shiftKey,
        },
        platform,
      );
      if (captured) {
        onChange(captured);
        setCapturing(false);
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [capturing, platform, onChange]);

  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-[13px] text-text-secondary">{label}</span>
      <button
        ref={btnRef}
        type="button"
        data-testid={`keycap-${label}`}
        onClick={() => setCapturing((c) => !c)}
        onBlur={() => setCapturing(false)}
        className="min-w-32 cursor-pointer rounded-sm border border-solid px-3 py-1.5 text-center font-mono text-[12px] transition-colors duration-150"
        style={{
          borderColor: capturing ? 'var(--color-accent-default)' : 'var(--color-hairline-strong)',
          color: capturing ? 'var(--color-accent-hover)' : 'var(--color-text-primary)',
          background: 'var(--color-surface-raised)',
        }}
      >
        {capturing ? 'pressione…' : displayLabel(binding, platform) || '—'}
      </button>
    </div>
  );
}
