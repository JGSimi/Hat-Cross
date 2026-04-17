import { create } from 'zustand';
import { LazyStore } from '@tauri-apps/plugin-store';
import type { ClipboardEntry } from '../types';

const MAX_ENTRIES = 100;
const clipboardDataStore = new LazyStore('clipboard-data.json');
const SAVE_DEBOUNCE_MS = 500;

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
    try {
      const data = (await clipboardDataStore.get<ClipboardEntry[]>('entries')) ?? [];
      set({ entries: data.slice(0, MAX_ENTRIES), loaded: true });
    } catch (err) {
      console.error('[ClipboardStore] Failed to load:', err);
      set({ entries: [], loaded: true });
    }
  },

  saveEntries: async () => {
    try {
      const { entries } = get();
      await clipboardDataStore.set('entries', entries);
      await clipboardDataStore.save();
    } catch (err) {
      console.error('[ClipboardStore] Failed to save:', err);
    }
  },
}));
