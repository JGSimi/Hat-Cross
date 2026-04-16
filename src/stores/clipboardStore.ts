import { create } from 'zustand';
import { LazyStore } from '@tauri-apps/plugin-store';
import type { ClipboardEntry } from '../types';

const MAX_ENTRIES = 100;
const clipboardDataStore = new LazyStore('clipboard-data.json');
const SAVE_DEBOUNCE_MS = 500;

interface ClipboardState {
  entries: ClipboardEntry[];
  loaded: boolean;

  addEntry: (entry: ClipboardEntry) => void;
  deleteEntry: (id: string) => void;
  clearAll: () => void;
  loadEntries: () => Promise<void>;
  saveEntries: () => Promise<void>;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSave(fn: () => Promise<void>) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { fn(); saveTimer = null; }, SAVE_DEBOUNCE_MS);
}

export const useClipboardStore = create<ClipboardState>()((set, get) => ({
  entries: [],
  loaded: false,

  addEntry: (entry) => {
    set((state) => {
      let entries = [entry, ...state.entries];
      if (entries.length > MAX_ENTRIES) {
        entries = entries.slice(0, MAX_ENTRIES);
      }
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

  clearAll: () => {
    set({ entries: [] });
    debouncedSave(() => get().saveEntries());
  },

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
