import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { NativeBridge } from '../bridge/native';
import type { FlashAppearance, FlashPosition, FlashQuadrant, ShortcutBindings } from '../bridge/types';
import { displayLabel, fromKeyboardEvent, normalize, type Platform } from '../domain/shortcuts/accelerator';
import { HatLogo } from './HatLogo';

interface HatHomeProps {
  bridge: NativeBridge;
}

const QUADRANTS: { id: FlashQuadrant; label: string; coords: { x: number; y: number } }[] = [
  { id: 'top-left', label: 'Superior esquerdo', coords: { x: 24, y: 24 } },
  { id: 'top-right', label: 'Superior direito', coords: { x: 1456, y: 24 } },
  { id: 'bottom-left', label: 'Inferior esquerdo', coords: { x: 24, y: 856 } },
  { id: 'bottom-right', label: 'Inferior direito', coords: { x: 1456, y: 856 } },
];

function getActiveQuadrant(pos: FlashPosition | null | undefined): FlashQuadrant {
  if (!pos) return 'top-left';
  if (pos.quadrant && ['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(pos.quadrant)) {
    return pos.quadrant;
  }
  const isRight = pos.x > 300;
  const isBottom = pos.y > 300;
  if (isRight && isBottom) return 'bottom-right';
  if (isRight) return 'top-right';
  if (isBottom) return 'bottom-left';
  return 'top-left';
}

function detectPlatform(): Platform {
  if (typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent)) {
    return 'darwin';
  }
  return 'win32';
}

const DIGITAL: React.CSSProperties = { fontFamily: 'var(--font-digital)', textTransform: 'uppercase' };
const IS_BETA = import.meta.env.VITE_HAT_VARIANT === 'beta-jev';

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
 * "HAT" + seletor de quadrante do flash + atalho + opacidade + cor à direita.
 * Toda a lógica reaproveita o bridge nativo (posição e aparência do Flash,
 * atalhos, atualização) — nada de rede/auth aqui, então funciona offline
 * e deslogado. Salas ficaram de fora do produto.
 */
export function HatHome({ bridge }: HatHomeProps) {
  const platform = detectPlatform();
  const [appearance, setAppearance] = useState<FlashAppearance | null>(null);
  const [captureProtection, setCaptureProtection] = useState<boolean | null>(null);
  const [savingCaptureProtection, setSavingCaptureProtection] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [position, setPosition] = useState<FlashPosition | null>(null);
  const [bindings, setBindings] = useState<ShortcutBindings | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [capturingScreenSolve, setCapturingScreenSolve] = useState(false);
  const [shortcutError, setShortcutError] = useState<string | null>(null);
  // Update: o app baixa+instala sozinho em background (spawn_check no Rust) e
  // emite 'update:ready' quando pronta. Só então o botão aparece; o clique
  // reinicia o app já atualizado. Zero verificação manual.
  const [updateReady, setUpdateReady] = useState<string | null>(null);
  const [relaunching, setRelaunching] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let alive = true;
    void Promise.allSettled([
      bridge.getFlashAppearance(),
      bridge.getShortcuts(),
      bridge.getFlashPosition(),
      bridge.getCaptureProtection(),
      bridge.getUpdateReady(),
    ]).then(([a, s, p, c, u]) => {
      if (!alive) return;
      if (a.status === 'fulfilled') setAppearance(a.value);
      if (s.status === 'fulfilled') setBindings(s.value);
      if (p.status === 'fulfilled') setPosition(p.value);
      if (c.status === 'fulfilled') setCaptureProtection(c.value);
      else setCaptureError('Não foi possível carregar a proteção de captura. Reabra o Hat.');
      if (u.status === 'fulfilled' && u.value) setUpdateReady(u.value);
    });
    const offFail = bridge.on('shortcut:registration-failed', ({ binding, code }) => {
      setShortcutError(code === 'conflict' ? `${binding} já está em uso.` : `Não registrei ${binding}.`);
    });
    // Update instalada em background → revela o botão.
    const offUpdate = bridge.on('update:ready', ({ version }) => setUpdateReady(version));
    return () => {
      alive = false;
      offFail();
      offUpdate();
    };
  }, [bridge]);

  // O listener nativo pode ser registrado depois de o updater terminar.
  // Enquanto não houver versão pronta, consulta o estado persistente do Rust.
  useEffect(() => {
    if (updateReady) return;
    let alive = true;
    const sync = () => {
      void bridge.getUpdateReady()
        .then((version) => {
          if (alive && version) setUpdateReady(version);
        })
        .catch(() => {});
    };
    sync();
    const timer = window.setInterval(sync, 1500);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [bridge, updateReady]);

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

  // Captura do atalho experimental Screen Solve (somente Beta).
  useEffect(() => {
    if (!capturingScreenSolve) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') return setCapturingScreenSolve(false);
      const captured = fromKeyboardEvent(
        { code: e.code, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, shiftKey: e.shiftKey },
        platform,
      );
      if (captured) {
        setShortcutError(null);
        setBindings((prev) => {
          if (!prev) return prev;
          const next = { ...prev, betaScreenSolve: captured };
          void bridge.setShortcuts(next).catch(() => setShortcutError('Não consegui aplicar. Tente outra.'));
          return next;
        });
        setCapturingScreenSolve(false);
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [capturingScreenSolve, platform, bridge]);

  function handleSelectQuadrant(quadrantId: FlashQuadrant) {
    const target = QUADRANTS.find((q) => q.id === quadrantId);
    const nextPos: FlashPosition = {
      x: target?.coords.x ?? 24,
      y: target?.coords.y ?? 24,
      quadrant: quadrantId,
      ...(position?.monitorLabel ? { monitorLabel: position.monitorLabel } : {}),
    };
    setPosition(nextPos);
    void bridge.flashSavePosition(nextPos).then(() => {
      void bridge.flashShowText('Hat Flash');
    });
  }

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

  const currentQuadrant = getActiveQuadrant(position);
  const opacity = appearance?.opacity ?? 67;
  const textColor = appearance?.textColor ?? '#ffffff';
  const binding = bindings?.processClipboardFlash ?? 'CommandOrControl+Shift+F';
  const screenSolveBinding = bindings?.betaScreenSolve ?? 'CommandOrControl+Shift+A';
  const { mods, key } = splitBinding(binding, platform);
  const { mods: screenSolveMods, key: screenSolveKey } = splitBinding(screenSolveBinding, platform);

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
          title={`Atualização ${updateReady} pronta — reiniciar agora`}
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
      <div className={`flex flex-1 flex-col justify-center ${IS_BETA ? 'gap-4' : 'gap-7'} px-[6%] py-6`}>
        {/* Header: HAT + Seletor de quadrante */}
        <div className="flex items-center justify-between">
          <p className="m-0 leading-none" style={{ ...DIGITAL, fontSize: 'clamp(48px, 11vh, 96px)', letterSpacing: '0.14em' }}>
            HAT
          </p>

          <div
            data-testid="flash-location-picker"
            role="radiogroup"
            aria-label="Posição do Flash na tela"
            className="grid grid-cols-2 grid-rows-2 gap-1 rounded-[14px] p-1.5"
            style={{
              background: '#242424',
              border: '2px solid #383838',
              width: '84px',
              height: '52px',
              boxSizing: 'border-box',
            }}
          >
            {QUADRANTS.map((q) => {
              const isSelected = currentQuadrant === q.id;
              return (
                <motion.button
                  key={q.id}
                  type="button"
                  data-testid={`quadrant-${q.id}`}
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={q.label}
                  title={q.label}
                  onClick={() => handleSelectQuadrant(q.id)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.92 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  className="cursor-pointer rounded-[6px] border-0 p-0 outline-none transition-colors"
                  style={{
                    background: isSelected ? 'rgba(0, 123, 255, 0.28)' : '#161616',
                    border: isSelected ? '2px solid #007bff' : '2px solid transparent',
                    boxShadow: isSelected ? '0 0 10px rgba(0, 123, 255, 0.45)' : 'none',
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Atalhos */}
        <div className="flex flex-col gap-3">
          <motion.button
            type="button"
            data-testid="shortcut-capture"
            onClick={() => {
              setCapturingScreenSolve(false);
              setCapturing((c) => !c);
            }}
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

          {IS_BETA && (
            <motion.button
              type="button"
              data-testid="shortcut-screen-solve"
              onClick={() => {
                setCapturing(false);
                setCapturingScreenSolve((c) => !c);
              }}
              onBlur={() => setCapturingScreenSolve(false)}
              whileTap={{ scale: 0.985 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-[16px] border-0 px-6 py-4 text-left"
              style={{ background: '#3d3d3d' }}
            >
              <span className="leading-none" style={{ ...DIGITAL, fontSize: 'clamp(18px, 3.4vh, 28px)' }}>
                screen solve
              </span>
              <span
                className="grid min-w-[120px] place-items-center rounded-[12px] px-4 py-2 leading-none"
                style={{ ...DIGITAL, background: '#141414', fontSize: 'clamp(16px, 2.8vh, 24px)', color: capturingScreenSolve ? '#007bff' : '#fff' }}
              >
                {capturingScreenSolve ? 'pressione…' : `${screenSolveMods} + ${screenSolveKey}`}
              </span>
            </motion.button>
          )}
        </div>

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
              <input
                type="color"
                data-testid="text-color"
                value={textColor}
                onChange={(e) => patchTextColor(e.target.value)}
                title="Cor do texto do Flash"
                aria-label="Cor do texto do Flash"
                className="hat-swatch size-9 shrink-0 rounded-[10px] border-solid"
                style={{ borderWidth: 4, borderColor: '#949494', background: 'transparent' }}
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

        <button
          type="button"
          role="switch"
          aria-checked={captureProtection ?? true}
          aria-label="Esconder em capturas de tela"
          disabled={captureProtection === null || savingCaptureProtection}
          className="flex items-center gap-3 self-start rounded-lg border-0 bg-transparent px-0 py-1 text-[12px] text-white disabled:opacity-50"
          onClick={async () => {
            if (captureProtection === null || savingCaptureProtection) return;
            setSavingCaptureProtection(true);
            setCaptureError(null);
            try {
              await bridge.setCaptureProtection(!captureProtection);
              setCaptureProtection(!captureProtection);
            } catch {
              setCaptureError('Não foi possível alterar a proteção de captura. Tente novamente.');
            } finally {
              setSavingCaptureProtection(false);
            }
          }}
        >
          <span aria-hidden="true" className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 ${(captureProtection ?? true) ? 'bg-blue-500' : 'bg-neutral-600'}`}>
            <span className={`h-4 w-4 rounded-full bg-white transition-transform ${(captureProtection ?? true) ? 'translate-x-4' : ''}`} />
          </span>
          Esconder em capturas de tela
        </button>
        {captureError && <p role="alert" className="m-0 text-[12px] text-red-400">{captureError}</p>}
        {shortcutError && (
          <p role="alert" className="m-0 text-[12px]" style={{ color: '#ff453a' }}>
            {shortcutError}
          </p>
        )}
      </div>
    </div>
  );
}
