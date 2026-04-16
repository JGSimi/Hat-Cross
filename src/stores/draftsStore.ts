import { create } from 'zustand';
import { readTextFile, writeTextFile, mkdir, exists } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import type { DraftEntry } from '../types';

const DRAFTS_FILE = 'drafts.json';
const SAVE_DEBOUNCE_MS = 500;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

// --- Store interface ---

interface DraftsFileShape {
  version: number;
  drafts: Record<string, DraftEntry>;
}

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
    try {
      const dataDir = await appDataDir();
      const filePath = await join(dataDir, DRAFTS_FILE);
      const fileExists = await exists(filePath);

      if (!fileExists) {
        set({ drafts: {}, loaded: true });
        return;
      }

      const raw = await readTextFile(filePath);
      const parsed = JSON.parse(raw) as Partial<DraftsFileShape> | Record<string, DraftEntry>;

      // If no `version` field, treat as v1 and accept either shape.
      let drafts: Record<string, DraftEntry>;
      if (parsed && typeof parsed === 'object' && 'drafts' in parsed && parsed.drafts) {
        drafts = parsed.drafts as Record<string, DraftEntry>;
      } else {
        drafts = parsed as Record<string, DraftEntry>;
      }

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
    try {
      const dataDir = await appDataDir();
      const dirExists = await exists(dataDir);
      if (!dirExists) {
        await mkdir(dataDir, { recursive: true });
      }
      const filePath = await join(dataDir, DRAFTS_FILE);
      const { drafts } = get();
      const payload: DraftsFileShape = { version: 1, drafts };
      await writeTextFile(filePath, JSON.stringify(payload));
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
