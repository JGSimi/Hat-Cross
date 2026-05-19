import { create } from 'zustand';
import { LazyStore } from '@tauri-apps/plugin-store';
import type { DraftEntry } from '../types';
import { isTauriRuntime } from '../utils/tauriRuntime';
import { withTimeout } from '../utils/async';
import {
  getWindowsStoreValue,
  isWindowsStoreRuntime,
  setWindowsStoreValue,
} from '../services/windowsStore';

const SAVE_DEBOUNCE_MS = 500;
const STORE_IO_TIMEOUT_MS = 4_000;
const draftsStore = new LazyStore('drafts-data.json');
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

// --- Store interface ---

interface DraftsState {
  drafts: Record<string, DraftEntry>;
  loaded: boolean;

  // Actions
  loadDrafts: () => Promise<void>;
  saveDrafts: () => Promise<void>;
  setDraft: (conversationId: string, text: string) => void;
  getDraft: (conversationId: string) => DraftEntry | undefined;
  clearDraft: (conversationId: string) => void;
  pruneOrphans: (validIds: Set<string>) => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSave(saveFn: () => Promise<void>) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveFn();
    saveTimer = null;
  }, SAVE_DEBOUNCE_MS);
}

export const useDraftsStore = create<DraftsState>()((set, get) => ({
  drafts: {},
  loaded: false,

  loadDrafts: async () => {
    if (!isTauriRuntime()) {
      set({ loaded: true });
      return;
    }
    try {
      const drafts = (isWindowsStoreRuntime()
        ? await withTimeout(
            getWindowsStoreValue<Record<string, DraftEntry>>('drafts-data.json', 'drafts'),
            STORE_IO_TIMEOUT_MS,
            'drafts load timed out',
          )
        : await withTimeout(
            draftsStore.get<Record<string, DraftEntry>>('drafts'),
            STORE_IO_TIMEOUT_MS,
            'drafts load timed out',
          )) ?? {};

      const now = Date.now();
      let purged = false;
      const filtered: Record<string, DraftEntry> = {};
      for (const [id, entry] of Object.entries(drafts)) {
        if (!entry || typeof entry.text !== 'string' || typeof entry.updatedAt !== 'number') {
          purged = true;
          continue;
        }
        if (now - entry.updatedAt > SEVEN_DAYS_MS) {
          purged = true;
          continue;
        }
        filtered[id] = entry;
      }

      set({ drafts: filtered, loaded: true });

      if (purged) {
        debouncedSave(() => get().saveDrafts());
      }
    } catch (err) {
      console.error('[DraftsStore] Failed to load drafts:', err);
      set({ drafts: {}, loaded: true });
    }
  },

  saveDrafts: async () => {
    if (!isTauriRuntime()) return;
    try {
      const { drafts } = get();
      if (isWindowsStoreRuntime()) {
        await withTimeout(
          setWindowsStoreValue('drafts-data.json', 'drafts', drafts),
          STORE_IO_TIMEOUT_MS,
          'drafts save timed out',
        );
      } else {
        await draftsStore.set('drafts', drafts);
        await withTimeout(
          draftsStore.save(),
          STORE_IO_TIMEOUT_MS,
          'drafts save timed out',
        );
      }
    } catch (err) {
      console.error('[DraftsStore] Failed to save drafts:', err);
    }
  },

  setDraft: (conversationId, text) => {
    set((state) => {
      const drafts = { ...state.drafts };
      if (text.trim() === '') {
        delete drafts[conversationId];
      } else {
        drafts[conversationId] = { text, updatedAt: Date.now() };
      }
      return { drafts };
    });
    debouncedSave(() => get().saveDrafts());
  },

  getDraft: (conversationId) => {
    return get().drafts[conversationId];
  },

  clearDraft: (conversationId) => {
    set((state) => {
      if (!(conversationId in state.drafts)) return state;
      const drafts = { ...state.drafts };
      delete drafts[conversationId];
      return { drafts };
    });
    // Cancel any pending debounced save and flush synchronously.
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    get().saveDrafts();
  },

  pruneOrphans: (validIds) => {
    const { drafts } = get();
    let changed = false;
    const next: Record<string, DraftEntry> = {};
    for (const [id, entry] of Object.entries(drafts)) {
      if (validIds.has(id)) {
        next[id] = entry;
      } else {
        changed = true;
      }
    }
    if (changed) {
      set({ drafts: next });
      debouncedSave(() => get().saveDrafts());
    }
  },
}));
