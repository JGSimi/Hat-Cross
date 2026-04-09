import { create } from 'zustand';
import { readTextFile, writeTextFile, mkdir, exists } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import type { ClipboardEntry } from '../types';

const CLIPBOARD_FILE = 'clipboard-history.json';
const MAX_ENTRIES = 100;
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
      const dataDir = await appDataDir();
      const filePath = await join(dataDir, CLIPBOARD_FILE);
      const fileExists = await exists(filePath);

      if (!fileExists) {
        set({ entries: [], loaded: true });
        return;
      }

      const raw = await readTextFile(filePath);
      const data = JSON.parse(raw) as ClipboardEntry[];
      set({ entries: data.slice(0, MAX_ENTRIES), loaded: true });
    } catch (err) {
      console.error('[ClipboardStore] Failed to load:', err);
      set({ entries: [], loaded: true });
    }
  },

  saveEntries: async () => {
    try {
      const dataDir = await appDataDir();
      const dirExists = await exists(dataDir);
      if (!dirExists) await mkdir(dataDir, { recursive: true });
      const filePath = await join(dataDir, CLIPBOARD_FILE);
      const { entries } = get();
      await writeTextFile(filePath, JSON.stringify(entries));
    } catch (err) {
      console.error('[ClipboardStore] Failed to save:', err);
    }
  },
}));
