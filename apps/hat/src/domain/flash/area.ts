/**
 * Área do Flash: o pedaço da tela que o usuário libera para a resposta.
 * Guardada em FRAÇÕES da tela (0–1), então vale em qualquer resolução.
 * Módulo de domínio PURO (sem Tauri/React). A conversão área → retângulo
 * em pixels é espelhada em crates/hat-core/src/flash.rs e validada pela
 * fixture compartilhada fixtures/flash-area-cases.json.
 */

import { holdMsFor } from './timing';

export interface FlashArea {
  /** Esquerda, fração da largura da tela. */
  x: number;
  /** Topo, fração da altura da tela. */
  y: number;
  /** Largura, fração da largura da tela. */
  w: number;
  /** Altura, fração da altura da tela. */
  h: number;
}

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MonitorSize {
  w: number;
  h: number;
}

export type AreaQuadrant = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type AreaHandle = 'move' | 'nw' | 'ne' | 'sw' | 'se';

/** Menor área permitida (fração da tela). */
export const MIN_AREA = { w: 0.15, h: 0.1 } as const;
/** Menor janela permitida (px lógicos), limitada ao tamanho do monitor. */
export const MIN_RECT_PX = { width: 240, height: 72 } as const;
/** Distância da borda quando a área é mandada para um canto. */
const EDGE = 0.02;
const DEFAULT_SIZE = { w: 0.3, h: 0.22 } as const;

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);
/** 4 casas: evita 0.30000000000000004 e mantém TS e Rust idênticos. */
const round4 = (v: number): number => Math.round(v * 10_000) / 10_000;
const finiteOr = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/** Área com o tamanho padrão colada no canto pedido (migração do seletor antigo). */
export function areaFromQuadrant(quadrant: string): FlashArea {
  const right = quadrant === 'top-right' || quadrant === 'bottom-right';
  const bottom = quadrant === 'bottom-left' || quadrant === 'bottom-right';
  return {
    x: round4(right ? 1 - EDGE - DEFAULT_SIZE.w : EDGE),
    y: round4(bottom ? 1 - EDGE - DEFAULT_SIZE.h : EDGE),
    w: DEFAULT_SIZE.w,
    h: DEFAULT_SIZE.h,
  };
}

/** Padrão sensato: pequeno, no canto superior esquerdo. */
export const DEFAULT_FLASH_AREA: Readonly<FlashArea> = Object.freeze(areaFromQuadrant('top-left'));

/** Garante tamanho mínimo e área inteira dentro da tela. Sempre devolve objeto novo. */
export function clampArea(area: FlashArea): FlashArea {
  const w = round4(clamp(finiteOr(area.w, DEFAULT_FLASH_AREA.w), MIN_AREA.w, 1));
  const h = round4(clamp(finiteOr(area.h, DEFAULT_FLASH_AREA.h), MIN_AREA.h, 1));
  return {
    x: round4(clamp(finiteOr(area.x, DEFAULT_FLASH_AREA.x), 0, 1 - w)),
    y: round4(clamp(finiteOr(area.y, DEFAULT_FLASH_AREA.y), 0, 1 - h)),
    w,
    h,
  };
}

/** Converte qualquer valor vindo do disco/IPC numa área válida. */
export function normalizeArea(raw: unknown): FlashArea {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ...DEFAULT_FLASH_AREA };
  }
  const r = raw as Record<string, unknown>;
  return clampArea({
    x: finiteOr(r['x'], DEFAULT_FLASH_AREA.x),
    y: finiteOr(r['y'], DEFAULT_FLASH_AREA.y),
    w: finiteOr(r['w'], DEFAULT_FLASH_AREA.w),
    h: finiteOr(r['h'], DEFAULT_FLASH_AREA.h),
  });
}

/** Área → retângulo da janela em pixels lógicos do monitor. */
export function areaToRect(area: FlashArea, monitor: MonitorSize): PixelRect {
  const a = clampArea(area);
  const width = Math.min(Math.max(Math.round(a.w * monitor.w), MIN_RECT_PX.width), monitor.w);
  const height = Math.min(Math.max(Math.round(a.h * monitor.h), MIN_RECT_PX.height), monitor.h);
  return {
    x: clamp(Math.round(a.x * monitor.w), 0, monitor.w - width),
    y: clamp(Math.round(a.y * monitor.h), 0, monitor.h - height),
    width,
    height,
  };
}

/** Arrasta a área inteira, sem mudar o tamanho. */
export function moveArea(area: FlashArea, dx: number, dy: number): FlashArea {
  const a = clampArea(area);
  return clampArea({ ...a, x: a.x + dx, y: a.y + dy });
}

/** Puxa uma quina (a quina oposta fica parada) ou arrasta tudo ('move'). */
export function resizeArea(area: FlashArea, handle: AreaHandle, dx: number, dy: number): FlashArea {
  if (handle === 'move') return moveArea(area, dx, dy);
  const a = clampArea(area);
  let left = a.x;
  let top = a.y;
  let right = a.x + a.w;
  let bottom = a.y + a.h;

  if (handle === 'nw' || handle === 'sw') left = clamp(left + dx, 0, right - MIN_AREA.w);
  if (handle === 'ne' || handle === 'se') right = clamp(right + dx, left + MIN_AREA.w, 1);
  if (handle === 'nw' || handle === 'ne') top = clamp(top + dy, 0, bottom - MIN_AREA.h);
  if (handle === 'sw' || handle === 'se') bottom = clamp(bottom + dy, top + MIN_AREA.h, 1);

  return clampArea({ x: left, y: top, w: right - left, h: bottom - top });
}

/** Em que quadrante está o centro da área. */
export function quadrantOf(area: FlashArea): AreaQuadrant {
  const a = clampArea(area);
  const right = a.x + a.w / 2 > 0.5;
  const bottom = a.y + a.h / 2 > 0.5;
  if (bottom) return right ? 'bottom-right' : 'bottom-left';
  return right ? 'top-right' : 'top-left';
}

/** Manda a área para um canto, mantendo o tamanho. */
export function areaInQuadrant(area: FlashArea, quadrant: AreaQuadrant): FlashArea {
  const a = clampArea(area);
  const right = quadrant.endsWith('right');
  const bottom = quadrant.startsWith('bottom');
  return clampArea({
    ...a,
    x: right ? 1 - EDGE - a.w : EDGE,
    y: bottom ? 1 - EDGE - a.h : EDGE,
  });
}

/** A resposta gruda no lado da área mais perto da borda da tela. */
export function anchorOf(area: FlashArea): { horizontal: 'left' | 'right'; vertical: 'top' | 'bottom' } {
  const q = quadrantOf(area);
  return {
    horizontal: q.endsWith('right') ? 'right' : 'left',
    vertical: q.startsWith('bottom') ? 'bottom' : 'top',
  };
}

const QUADRANT_LABEL: Record<AreaQuadrant, string> = {
  'top-left': 'Canto superior esquerdo',
  'top-right': 'Canto superior direito',
  'bottom-left': 'Canto inferior esquerdo',
  'bottom-right': 'Canto inferior direito',
};

/** Frase curta para o usuário: onde fica e quanto da tela ocupa. */
export function describeArea(area: FlashArea): string {
  const a = clampArea(area);
  const percent = Math.max(1, Math.round(a.w * a.h * 100));
  return `${QUADRANT_LABEL[quadrantOf(a)]} · ocupa ${percent}% da tela`;
}

export interface ScrollPlan {
  scroll: boolean;
  /** Espera antes de começar a rolar (tempo de ler o começo). */
  delayMs: number;
  durationMs: number;
  distancePx: number;
  /** Tempo total na tela antes de esconder. */
  holdMs: number;
}

const SCROLL_DELAY_MS = 1500;
const SCROLL_END_PAUSE_MS = 2000;
const SCROLL_MIN_MS = 2000;
const SCROLL_PX_PER_S = 22;
const HOLD_CAP_MS = 60_000;

/**
 * A janela é click-through (ninguém rola com o mouse), então quando a
 * resposta não cabe na área ela rola sozinha, devagar, até o fim.
 */
export function scrollPlan(overflowPx: number, textLength: number): ScrollPlan {
  const baseHold = holdMsFor(textLength);
  if (!(overflowPx > 0)) {
    return { scroll: false, delayMs: 0, durationMs: 0, distancePx: 0, holdMs: baseHold };
  }
  const distancePx = Math.round(overflowPx);
  const maxDuration = HOLD_CAP_MS - SCROLL_DELAY_MS - SCROLL_END_PAUSE_MS;
  const durationMs = Math.min(
    Math.max(Math.round((distancePx / SCROLL_PX_PER_S) * 1000), SCROLL_MIN_MS),
    maxDuration,
  );
  const holdMs = Math.min(Math.max(baseHold, SCROLL_DELAY_MS + durationMs + SCROLL_END_PAUSE_MS), HOLD_CAP_MS);
  return { scroll: true, delayMs: SCROLL_DELAY_MS, durationMs, distancePx, holdMs };
}
