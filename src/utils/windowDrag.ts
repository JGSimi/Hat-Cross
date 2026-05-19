import type { PointerEvent } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauriRuntime } from './tauriRuntime';

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest('button, input, textarea, select, a, [role="button"], [data-no-drag]'),
  );
}

export function startWindowDrag(event: PointerEvent<HTMLElement>) {
  if (event.button !== 0 || !isTauriRuntime() || isInteractiveTarget(event.target)) return;
  event.preventDefault();
  getCurrentWindow().startDragging().catch(() => {});
}
