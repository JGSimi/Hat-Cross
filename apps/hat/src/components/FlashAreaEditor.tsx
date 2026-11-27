import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_FLASH_AREA,
  areaInQuadrant,
  describeArea,
  quadrantOf,
  resizeArea,
  type AreaHandle,
  type AreaQuadrant,
  type FlashArea,
} from '../domain/flash/area';

/** Verde da área (mesmo do mock): destaca sem gritar. */
export const AREA_GREEN = '#b5d334';
const AREA_FILL = 'rgba(181, 211, 52, 0.16)';
const KEY_STEP = 0.02;

const QUADRANTS: { id: AreaQuadrant; label: string }[] = [
  { id: 'top-left', label: 'superior esquerdo' },
  { id: 'top-right', label: 'superior direito' },
  { id: 'bottom-left', label: 'inferior esquerdo' },
  { id: 'bottom-right', label: 'inferior direito' },
];

const HANDLES: { id: Exclude<AreaHandle, 'move'>; style: React.CSSProperties; cursor: string }[] = [
  { id: 'nw', style: { left: -6, top: -6 }, cursor: 'nwse-resize' },
  { id: 'ne', style: { right: -6, top: -6 }, cursor: 'nesw-resize' },
  { id: 'sw', style: { left: -6, bottom: -6 }, cursor: 'nesw-resize' },
  { id: 'se', style: { right: -6, bottom: -6 }, cursor: 'nwse-resize' },
];

/** Proporção da tela de verdade, para a miniatura não enganar. */
function screenRatio(): number {
  if (typeof window !== 'undefined' && window.screen?.width > 0 && window.screen?.height > 0) {
    return window.screen.width / window.screen.height;
  }
  return 16 / 10;
}

const pct = (v: number) => `${Math.round(v * 10_000) / 100}%`;

/** Miniatura da tela com a área verde (botão da tela principal). */
export function FlashAreaThumb({ area, size = { w: 84, h: 52 } }: { area: FlashArea; size?: { w: number; h: number } }) {
  return (
    <span
      aria-hidden
      className="relative block overflow-hidden rounded-[8px]"
      style={{ width: size.w, height: size.h, background: '#242424', border: '2px solid #383838', boxSizing: 'border-box' }}
    >
      <span
        className="absolute rounded-[3px]"
        style={{
          left: pct(area.x),
          top: pct(area.y),
          width: pct(area.w),
          height: pct(area.h),
          background: AREA_FILL,
          border: `1.5px solid ${AREA_GREEN}`,
          boxSizing: 'border-box',
        }}
      />
    </span>
  );
}

interface FlashAreaEditorProps {
  area: FlashArea;
  /** Salva a área (o pai fala com o nativo e mostra a prévia na tela). */
  onCommit: (area: FlashArea) => void;
  onClose: () => void;
}

interface Drag {
  handle: AreaHandle;
  startX: number;
  startY: number;
  start: FlashArea;
  pointerId: number;
}

/**
 * Ajuste da área do Flash: miniatura da tela dividida em 4 cantos, com a
 * área verde arrastável (move) e redimensionável pelas quinas. A resposta
 * nunca passa dessa área; se for longa, rola sozinha dentro dela.
 */
export function FlashAreaEditor({ area, onCommit, onClose }: FlashAreaEditorProps) {
  const [draft, setDraft] = useState<FlashArea>(area);
  const screenRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  useEffect(() => setDraft(area), [area]);
  useEffect(() => areaRef.current?.focus(), []);

  function commit(next: FlashArea) {
    setDraft(next);
    onCommit(next);
  }

  function delta(e: React.PointerEvent): { dx: number; dy: number } {
    const d = drag.current;
    const rect = screenRef.current?.getBoundingClientRect();
    if (!d || !rect || rect.width <= 0 || rect.height <= 0) return { dx: 0, dy: 0 };
    return { dx: (e.clientX - d.startX) / rect.width, dy: (e.clientY - d.startY) / rect.height };
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    const handle = (target.closest('[data-handle]')?.getAttribute('data-handle') ?? 'move') as AreaHandle;
    e.preventDefault();
    drag.current = { handle, startX: e.clientX, startY: e.clientY, start: draft, pointerId: e.pointerId };
    screenRef.current?.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const { dx, dy } = delta(e);
    setDraft(resizeArea(d.start, d.handle, dx, dy));
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const { dx, dy } = delta(e);
    drag.current = null;
    screenRef.current?.releasePointerCapture?.(d.pointerId);
    commit(resizeArea(d.start, d.handle, dx, dy));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
      ArrowUp: [0, -KEY_STEP],
      ArrowDown: [0, KEY_STEP],
    };
    const step = steps[e.key];
    if (!step) return;
    e.preventDefault();
    e.stopPropagation();
    commit(resizeArea(draft, e.shiftKey ? 'se' : 'move', step[0], step[1]));
  }

  const active = quadrantOf(draft);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="flash-area-title"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      className="absolute inset-0 z-20 flex flex-col gap-4 px-8 py-6"
      style={{ background: '#141414', color: '#fff', fontFamily: 'var(--font-body)' }}
    >
      <div>
        <h2 id="flash-area-title" className="m-0 text-[18px] font-semibold leading-tight">
          Onde a resposta aparece
        </h2>
        <p className="m-0 mt-1 text-[13px] leading-snug" style={{ color: '#a8a8a3' }}>
          Arraste a área verde para escolher o lugar. Puxe a quina para mudar o tamanho. Se a resposta for maior, ela
          rola sozinha dentro da área.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div
          ref={screenRef}
          data-testid="flash-area-screen"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="relative max-h-full max-w-full touch-none select-none rounded-[14px]"
          style={{
            aspectRatio: String(screenRatio()),
            height: '100%',
            background: '#1e1e1e',
            border: '2px solid #2c2c2c',
            boxSizing: 'border-box',
          }}
        >
          {/* 4 cantos tracejados: clique leva a área para lá. */}
          <div className="absolute inset-2 grid grid-cols-2 grid-rows-2 gap-2">
            {QUADRANTS.map((q) => (
              <button
                key={q.id}
                type="button"
                data-testid={`quadrant-${q.id}`}
                aria-pressed={active === q.id}
                aria-label={`Levar para o canto ${q.label}`}
                title={`Canto ${q.label}`}
                onClick={() => commit(areaInQuadrant(draft, q.id))}
                className="cursor-pointer rounded-[10px] bg-transparent p-0"
                style={{ border: '1.5px dashed #555' }}
              />
            ))}
          </div>

          {/* Área verde: arrasta para mover, quinas para redimensionar. */}
          <div
            ref={areaRef}
            data-testid="flash-area"
            role="group"
            tabIndex={0}
            aria-label="Área da resposta. Use as setas para mover e Shift + setas para mudar o tamanho."
            onPointerDown={onPointerDown}
            onKeyDown={onKeyDown}
            className="absolute cursor-move rounded-[10px] outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-dashed focus-visible:outline-white/50"
            style={{
              left: pct(draft.x),
              top: pct(draft.y),
              width: pct(draft.w),
              height: pct(draft.h),
              background: AREA_FILL,
              border: `2px solid ${AREA_GREEN}`,
              boxSizing: 'border-box',
              overflow: 'visible',
            }}
          >
            <div className="pointer-events-none flex h-full flex-col gap-1.5 overflow-hidden p-2.5">
              <span className="text-[12px] font-medium" style={{ color: '#f4f4f2' }}>
                B) Paris
              </span>
              {[92, 76, 84, 60].map((w, i) => (
                <span key={i} className="block h-[5px] shrink-0 rounded-full" style={{ width: `${w}%`, background: 'rgb(255 255 255 / 0.18)' }} />
              ))}
            </div>
            {HANDLES.map((h) => (
              <span
                key={h.id}
                data-handle={h.id}
                data-testid={`flash-area-handle-${h.id}`}
                aria-hidden
                className="absolute size-3 rounded-full"
                style={{ ...h.style, cursor: h.cursor, background: AREA_GREEN, border: '2px solid #141414' }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] tabular-nums" style={{ color: '#d6d6d2' }} aria-live="polite">
          {describeArea(draft)}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => commit({ ...DEFAULT_FLASH_AREA })}
            className="cursor-pointer rounded-[10px] border-0 px-4 py-2 text-[13px]"
            style={{ background: '#2a2a2a', color: '#fff' }}
          >
            Voltar ao padrão
          </button>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-[10px] border-0 px-5 py-2 text-[13px] font-semibold"
            style={{ background: '#f4f4f2', color: '#141414' }}
          >
            Pronto
          </button>
        </span>
      </div>
    </div>
  );
}
