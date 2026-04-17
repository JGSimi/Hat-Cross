import { useEffect, useRef } from 'react';

type ShortcutHandler = (e: KeyboardEvent) => void;
export type ShortcutMap = Record<string, ShortcutHandler>;

/**
 * Shortcuts that ARE allowed to fire even when focus is in an input/textarea.
 * Keep the list short — anything here must be safe inside typing flows.
 */
const INPUT_WHITELIST = new Set(['mod+f', 'escape']);

function normalizeKey(e: KeyboardEvent): string {
  const parts: string[] = [];
  const mod = e.metaKey || e.ctrlKey;
  if (mod) parts.push('mod');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');

  let key = e.key;
  if (key === ' ') key = 'space';
  else if (key.length === 1) key = key.toLowerCase();
  else key = key.toLowerCase();

  parts.push(key);
  return parts.join('+');
}

function normalizeShortcut(shortcut: string): string {
  return shortcut
    .toLowerCase()
    .split('+')
    .map((p) => p.trim())
    .map((p) => (p === 'cmd' || p === 'ctrl' || p === 'meta' ? 'mod' : p))
    .map((p) => (p === ' ' ? 'space' : p))
    .sort((a, b) => {
      const order = ['mod', 'shift', 'alt'];
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    })
    .join('+');
}

function keyMatches(pressed: string, shortcut: string): boolean {
  const normalized = normalizeShortcut(shortcut);
  const pressedParts = pressed.split('+');
  const shortParts = normalized.split('+');
  if (pressedParts.length !== shortParts.length) return false;
  const pressedSorted = [...pressedParts].sort();
  const shortSorted = [...shortParts].sort();
  return pressedSorted.every((p, i) => p === shortSorted[i]);
}

function isEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts(map: ShortcutMap, enabled: boolean = true): void {
  const mapRef = useRef(map);
  mapRef.current = map;

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      const pressed = normalizeKey(e);
      const editing = isEditingTarget(e.target);

      for (const [shortcut, fn] of Object.entries(mapRef.current)) {
        if (keyMatches(pressed, shortcut)) {
          const normalized = normalizeShortcut(shortcut);
          if (editing && !INPUT_WHITELIST.has(normalized)) continue;
          fn(e);
          return;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled]);
}
