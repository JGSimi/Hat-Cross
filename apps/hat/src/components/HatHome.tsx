import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { NativeBridge } from '../bridge/native';
import type { FlashAppearance, ShortcutBindings } from '../bridge/types';
import { displayLabel, fromKeyboardEvent, normalize, type Platform } from '../domain/shortcuts/accelerator';
import { HatLogo } from './HatLogo';

interface HatHomeProps {
  bridge: NativeBridge;
}

function detectPlatform(): Platform {
  if (typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent)) {
    return 'darwin';
  }
  return 'win32';
}

const DIGITAL: React.CSSProperties = { fontFamily: 'var(--font-digital)', textTransform: 'uppercase' };

/** Separa modificadores da tecla p/ render "⌘⇧ + F" do design. */
function splitBinding(binding: string, platform: Platform): { mods: string; key: string } {
  const label = displayLabel(binding, platform); // ex.: "⌘⇧F" (darwin) | "Ctrl+Shift+F"
  const canonical = normalize(binding);
  const key = canonical ? (canonical.split('+').pop() ?? '') : '';
  const mods = label.endsWith(key) ? label.slice(0, label.length - key.length) : label;
  return { mods: mods.replace(/\+$/, ''), key };
}

/**
 * Tela principal do Hat (redesign "a risca" do Figma): mascote à esquerda,
 * "HAT" + atalho + opacidade + cor à direita. Toda a lógica reaproveita o
 * bridge nativo (aparência do Flash, atalhos, atualização) — nada de rede/auth
 * aqui, então funciona offline e deslogado. Salas ficaram de fora do produto.
 */
export function HatHome({ bridge }: HatHomeProps) {
  const platform = detectPlatform();
  const [appearance, setAppearance] = useState<FlashAppearance | null>(null);
  const [bindings, setBindings] = useState<ShortcutBindings | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [shortcutError, setShortcutError] = useState<string | null>(null);
  // Update: o app baixa+instala sozinho em background (spawn_check no Rust) e
  // emite 'update:ready' quando pronta. Só então o botão aparece; o clique
  // reinicia o app já atualizado. Zero verificação manual.
  const [updateReady, setUpdateReady] = useState(false);
  const [relaunching, setRelaunching] = useState(false);
  const [dragging, setDragging] = useState(false);
  const colorRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    void Promise.allSettled([bridge.getFlashAppearance(), bridge.getShortcuts()]).then(([a, s]) => {
      if (!alive) return;
      if (a.status === 'fulfilled') setAppearance(a.value);
      if (s.status === 'fulfilled') setBindings(s.value);
    });
    const offFail = bridge.on('shortcut:registration-failed', ({ binding, code }) => {
      setShortcutError(code === 'conflict' ? `${binding} já está em uso.` : `Não registrei ${binding}.`);
    });
    // Update instalada em background → revela o botão.
    const offUpdate = bridge.on('update:ready', () => setUpdateReady(true));
    return () => {
      alive = false;
      offFail();
      offUpdate();
    };
  }, [bridge]);

  // Captura do atalho principal (processar clipboard + Flash).
  useEffect(() => {
    if (!capturing) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') return setCapturing(false);
      const captured = fromKeyboardEvent(
        { code: e.code, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, shiftKey: e.shiftKey },
        platform,
      );
      if (captured) {
        setShortcutError(null);
        setBindings((prev) => {
          if (!prev) return prev;
          const next = { ...prev, processClipboardFlash: captured };
          void bridge.setShortcuts(next).catch(() => setShortcutError('Não consegui aplicar. Tente outra.'));
          return next;
        });
        setCapturing(false);
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [capturing, platform, bridge]);

  function patchOpacity(opacity: number) {
    setAppearance((prev) => {
      if (!prev) return prev;
      const next = { ...prev, opacity };
      void bridge.setFlashAppearance(next);
      return next;
    });
  }

  function patchTextColor(textColor: string) {
    setAppearance((prev) => {
      if (!prev) return prev;
      const next = { ...prev, textColor };
      void bridge.setFlashAppearance(next);
      return next;
    });
  }

  function applyUpdate() {
    setRelaunching(true);
    void bridge.relaunchApp().catch(() => setRelaunching(false));
  }

  const opacity = appearance?.opacity ?? 67;
  const textColor = appearance?.textColor ?? '#ffffff';
  const binding = bindings?.processClipboardFlash ?? 'CommandOrControl+Shift+F';
  const { mods, key } = splitBinding(binding, platform);

  return (
    <div
      className="relative flex h-full w-full overflow-hidden"
      style={{ background: '#141414', color: '#fff' }}
    >
      {/* Update — canto superior direito. Só aparece quando há atualização
          baixada e pronta; o clique reinicia o app atualizado. */}
      {updateReady && (
        <motion.button
          type="button"
          data-testid="apply-update"
          onClick={applyUpdate}
          disabled={relaunching}
          title="Atualização pronta — reiniciar agora"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 20 }}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.9 }}
          className="absolute right-4 top-4 z-10 grid size-11 cursor-pointer place-items-center rounded-[14px] border-0 disabled:cursor-default"
          style={{ background: '#007bff', boxShadow: '0 6px 20px rgb(0 123 255 / 0.45)' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 3v11m0 0 4-4m-4 4-4-4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 19h14" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          <span
            data-testid="update-dot"
            className="absolute -right-1 -top-1 size-3 rounded-full"
            style={{ background: '#ff3b30', boxShadow: '0 0 0 2px #141414' }}
          />
        </motion.button>
      )}

      {/* Mascote — metade esquerda. */}
      <div className="flex flex-1 items-center justify-center border-0 border-r border-solid" style={{ borderColor: 'rgb(255 255 255 / 0.14)' }}>
        <HatLogo size={220} style={{ color: '#fff', maxHeight: '62%', width: 'auto' }} title="Hat" />
      </div>

      {/* Controles — metade direita. */}
      <div className="flex flex-1 flex-col justify-center gap-7 px-[6%] py-6">
        <p className="m-0 leading-none" style={{ ...DIGITAL, fontSize: 'clamp(48px, 11vh, 96px)', letterSpacing: '0.14em' }}>
          HAT
        </p>

        {/* Atalho */}
        <motion.button
          type="button"
          data-testid="shortcut-capture"
          onClick={() => setCapturing((c) => !c)}
          onBlur={() => setCapturing(false)}
          whileTap={{ scale: 0.985 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-[16px] border-0 px-6 py-4 text-left"
          style={{ background: '#3d3d3d' }}
        >
          <span className="leading-none" style={{ ...DIGITAL, fontSize: 'clamp(18px, 3.4vh, 28px)' }}>
            atalho
          </span>
          <span
            className="grid min-w-[120px] place-items-center rounded-[12px] px-4 py-2 leading-none"
            style={{ ...DIGITAL, background: '#141414', fontSize: 'clamp(16px, 2.8vh, 24px)', color: capturing ? '#007bff' : '#fff' }}
          >
            {capturing ? 'pressione…' : `${mods} + ${key}`}
          </span>
        </motion.button>

        {/* Opacidade + Cor */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex min-w-0 items-center justify-between gap-4">
            <span className="min-w-0 truncate leading-none" style={{ ...DIGITAL, fontSize: 'clamp(16px, 3vh, 26px)' }}>
              opacidade
            </span>
            <span className="flex shrink-0 items-center gap-2.5">
              <span className="leading-none" style={{ ...DIGITAL, fontSize: 'clamp(16px, 3vh, 26px)' }}>
                cor
              </span>
              <motion.button
                type="button"
                data-testid="text-color"
                onClick={() => colorRef.current?.click()}
                title="Cor do texto do Flash"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                className="size-9 shrink-0 cursor-pointer rounded-[10px] border-solid p-0"
                style={{ background: textColor, borderWidth: 4, borderColor: '#949494' }}
              />
              <input
                ref={colorRef}
                type="color"
                value={textColor}
                onChange={(e) => patchTextColor(e.target.value)}
                aria-label="Cor do texto do Flash"
                className="pointer-events-none absolute size-0 opacity-0"
              />
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <motion.span
              className="shrink-0 leading-none tabular-nums"
              style={{ ...DIGITAL, fontSize: 'clamp(16px, 3vh, 26px)', minWidth: '2.8em', transformOrigin: 'left center' }}
              animate={{ scale: dragging ? 1.12 : 1, color: dragging ? '#4da3ff' : '#ffffff' }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            >
              {opacity}%
            </motion.span>
            <input
              type="range"
              min={4}
              max={100}
              value={opacity}
              onChange={(e) => patchOpacity(Number(e.target.value))}
              onPointerDown={() => setDragging(true)}
              onPointerUp={() => setDragging(false)}
              onPointerCancel={() => setDragging(false)}
              onBlur={() => setDragging(false)}
              aria-label="Opacidade do Flash"
              className={`hat-opacity min-w-0${dragging ? ' hat-opacity-active' : ''}`}
              style={{ ['--fill' as string]: `${((opacity - 4) / 96) * 100}%` }}
            />
          </div>
        </div>

        {shortcutError && (
          <p role="alert" className="m-0 text-[12px]" style={{ color: '#ff453a' }}>
            {shortcutError}
          </p>
        )}
      </div>
    </div>
  );
}
