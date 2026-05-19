import { create } from 'zustand';
import { LazyStore } from '@tauri-apps/plugin-store';
import type { ClipboardEntry } from '../types';
import { isTauriRuntime } from '../utils/tauriRuntime';
import { withTimeout } from '../utils/async';
import { withDiagnostic } from '../services/diagnostics';
import {
  readLocalJson,
  useWindowsWebStorageFallback,
  writeLocalJson,
} from '../utils/windowsStorageFallback';

const MAX_ENTRIES = 100;
const clipboardDataStore = new LazyStore('clipboard-data.json');
const SAVE_DEBOUNCE_MS = 500;
const STORE_IO_TIMEOUT_MS = 4_000;

interface ClipboardState {
  entries: ClipboardEntry[];
  loaded: boolean;
  isProcessing: boolean;

  addEntry: (entry: ClipboardEntry) => void;
  deleteEntry: (id: string) => void;
  togglePin: (id: string) => void;
  clearAll: () => void;
  setProcessing: (v: boolean) => void;
  loadEntries: () => Promise<void>;
  saveEntries: () => Promise<void>;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSave(fn: () => Promise<void>) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { fn(); saveTimer = null; }, SAVE_DEBOUNCE_MS);
}

function enforceMaxPreservingPinned(entries: ClipboardEntry[]): ClipboardEntry[] {
  if (entries.length <= MAX_ENTRIES) return entries;
  const pinned = entries.filter((e) => e.isPinned);
  const unpinned = entries.filter((e) => !e.isPinned);
  const unpinnedSlots = Math.max(0, MAX_ENTRIES - pinned.length);
  return [...pinned, ...unpinned.slice(0, unpinnedSlots)];
}

export const useClipboardStore = create<ClipboardState>()((set, get) => ({
  entries: [],
  loaded: false,
  isProcessing: false,

  addEntry: (entry) => {
    set((state) => {
      const entries = enforceMaxPreservingPinned([entry, ...state.entries]);
      return { entries };
    });
    debouncedSave(() => get().saveEntries());
  },

  deleteEntry: (id) => {
    set((state) => ({
      entries: state.entries.filter((e) => e.id !== id),
    }));
    debouncedSave(() => get().saveEntries());
  },

  togglePin: (id) => {
    set((state) => ({
      entries: state.entries.map((e) =>
        e.id === id ? { ...e, isPinned: !e.isPinned } : e,
      ),
    }));
    debouncedSave(() => get().saveEntries());
  },

  clearAll: () => {
    set({ entries: [] });
    debouncedSave(() => get().saveEntries());
  },

  setProcessing: (v) => set({ isProcessing: v }),

  loadEntries: async () => {
    if (!isTauriRuntime()) {
      set({ loaded: true });
      return;
    }
    try {
      const data = useWindowsWebStorageFallback()
        ? readLocalJson<ClipboardEntry[]>('clipboard-data') ?? []
        : (await withDiagnostic('clipboard_store_load', {}, () =>
            withTimeout(
              clipboardDataStore.get<ClipboardEntry[]>('entries'),
              STORE_IO_TIMEOUT_MS,
              'clipboard load timed out',
            ),
          )) ?? [];
      set({ entries: data.slice(0, MAX_ENTRIES), loaded: true });
    } catch (err) {
      console.error('[ClipboardStore] Failed to load:', err);
      set({ entries: [], loaded: true });
    }
  },

  saveEntries: async () => {
    if (!isTauriRuntime()) return;
    try {
      const { entries } = get();
      if (useWindowsWebStorageFallback()) {
        writeLocalJson('clipboard-data', entries);
        return;
      }
      await withDiagnostic('clipboard_store_save', { entries: entries.length }, async () => {
        await withTimeout(
          clipboardDataStore.set('entries', entries),
          STORE_IO_TIMEOUT_MS,
          'clipboard set timed out',
        );
        await withTimeout(
          clipboardDataStore.save(),
          STORE_IO_TIMEOUT_MS,
          'clipboard save timed out',
        );
      });
    } catch (err) {
      console.error('[ClipboardStore] Failed to save:', err);
    }
  },
}));
