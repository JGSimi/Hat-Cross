import { create } from 'zustand';
import { LazyStore } from '@tauri-apps/plugin-store';
import type { Conversation, Message } from '../types';
import { useSettingsStore } from './settingsStore';
import { useDraftsStore } from './draftsStore';

const SAVE_DEBOUNCE_MS = 500;

// LazyStore is proven to work in this app (settings.json, conversation-state.json
// both persist correctly). plugin-fs writeTextFile silently fails with $APPDATA scope.
const conversationStore = new LazyStore('conversations-data.json');
const activeIdStore = new LazyStore('conversation-state.json');

function persistActiveId(id: string | null): void {
  activeIdStore
    .set('activeId', id)
    .then(() => activeIdStore.save())
    .catch((err) => console.error('Failed to persist activeId', err));
}

function pruneDraftOrphans(validIds: string[]): void {
  useDraftsStore.getState().pruneOrphans(new Set(validIds));
}

// --- Helpers ---

function getMaxConversations(): number {
  return useSettingsStore.getState().settings.chatLimits?.maxConversations ?? 50;
}

function getMaxMessagesPerConversation(): number {
  return useSettingsStore.getState().settings.chatLimits?.maxMessagesPerConversation ?? 200;
}

function sortConversations(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

function autoTitle(messages: Message[]): string {
  const firstUserMsg = messages.find((m) => m.isUser);
  if (!firstUserMsg) return 'Nova conversa';
  const text = firstUserMsg.content.trim().replace(/\n/g, ' ');
  return text.length > 40 ? text.slice(0, 40) + '...' : text;
}

// --- Store interface ---

interface StorageStats {
  totalConversations: number;
  totalMessages: number;
  estimatedSizeKB: number;
  oldestConversationDate: number | null;
}

interface ConversationState {
  conversations: Conversation[];
  activeConversationId: string | null;
  loaded: boolean;

  // Actions
  createConversation: (firstMessage?: Message) => Conversation;
  deleteConversation: (id: string) => void;
  clearAllConversations: () => void;
  clearOldConversations: (keepCount: number) => number;
  pinConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  setActiveConversation: (id: string | null) => void;
  addMessageToConversation: (conversationId: string, message: Message) => void;
  getStorageStats: () => StorageStats;
  getMessageCount: (conversationId: string) => number;
  loadConversations: () => Promise<void>;
  saveConversations: () => Promise<void>;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSave(saveFn: () => Promise<void>) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveFn();
    saveTimer = null;
  }, SAVE_DEBOUNCE_MS);
}

export function flushPendingSave(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
}

export const useConversationStore = create<ConversationState>()((set, get) => ({
  conversations: [],
  activeConversationId: null,
  loaded: false,

  createConversation: (firstMessage) => {
    const now = Date.now();
    const conversation: Conversation = {
      id: crypto.randomUUID(),
      title: firstMessage ? autoTitle([firstMessage]) : 'Nova conversa',
      messages: firstMessage ? [firstMessage] : [],
      isPinned: false,
      createdAt: now,
      updatedAt: now,
    };

    set((state) => {
      let conversations = [conversation, ...state.conversations];
      const maxConv = getMaxConversations();
      // Enforce max conversations — drop oldest unpinned
      if (conversations.length > maxConv) {
        const pinned = conversations.filter((c) => c.isPinned);
        const unpinned = conversations.filter((c) => !c.isPinned);
        conversations = [...pinned, ...unpinned.slice(0, maxConv - pinned.length)];
      }
      return {
        conversations: sortConversations(conversations),
        activeConversationId: conversation.id,
      };
    });

    persistActiveId(conversation.id);
    get().saveConversations();
    return conversation;
  },

  deleteConversation: (id) => {
    set((state) => {
      const conversations = state.conversations.filter((c) => c.id !== id);
      const activeConversationId =
        state.activeConversationId === id
          ? conversations[0]?.id ?? null
          : state.activeConversationId;
      return { conversations, activeConversationId };
    });
    debouncedSave(() => get().saveConversations());
    const newConversations = get().conversations;
    persistActiveId(get().activeConversationId);
    pruneDraftOrphans(newConversations.map((c) => c.id));
  },

  clearAllConversations: () => {
    set({ conversations: [], activeConversationId: null });
    debouncedSave(() => get().saveConversations());
    persistActiveId(null);
    pruneDraftOrphans([]);
  },

  clearOldConversations: (keepCount: number) => {
    const { conversations } = get();
    const pinned = conversations.filter((c) => c.isPinned);
    const unpinned = conversations.filter((c) => !c.isPinned);
    const toKeep = unpinned.slice(0, keepCount);
    const removed = unpinned.length - toKeep.length;

    if (removed > 0) {
      const newConversations = sortConversations([...pinned, ...toKeep]);
      const removedIds = new Set(unpinned.slice(keepCount).map((c) => c.id));
      const activeId = get().activeConversationId;

      set({
        conversations: newConversations,
        activeConversationId: removedIds.has(activeId ?? '')
          ? newConversations[0]?.id ?? null
          : activeId,
      });
      debouncedSave(() => get().saveConversations());
      persistActiveId(get().activeConversationId);
      pruneDraftOrphans(newConversations.map((c) => c.id));
    }

    return removed;
  },

  pinConversation: (id) => {
    set((state) => {
      const conversations = state.conversations.map((c) =>
        c.id === id ? { ...c, isPinned: !c.isPinned } : c,
      );
      return { conversations: sortConversations(conversations) };
    });
    debouncedSave(() => get().saveConversations());
  },

  renameConversation: (id, title) => {
    set((state) => {
      const conversations = state.conversations.map((c) =>
        c.id === id ? { ...c, title } : c,
      );
      return { conversations };
    });
    debouncedSave(() => get().saveConversations());
  },

  setActiveConversation: (id) => {
    set({ activeConversationId: id });
    persistActiveId(id);
  },

  addMessageToConversation: (conversationId, message) => {
    set((state) => {
      const maxMsg = getMaxMessagesPerConversation();
      const conversations = state.conversations.map((c) => {
        if (c.id !== conversationId) return c;

        let messages = [...c.messages, message];
        // Enforce max messages per conversation
        if (messages.length > maxMsg) {
          messages = messages.slice(messages.length - maxMsg);
        }

        // Auto-title on first user message
        const title =
          c.title === 'Nova conversa' && message.isUser
            ? autoTitle(messages)
            : c.title;

        return { ...c, messages, title, updatedAt: Date.now() };
      });

      return { conversations: sortConversations(conversations) };
    });
    get().saveConversations();
  },

  getStorageStats: () => {
    const { conversations } = get();
    const totalMessages = conversations.reduce((sum, c) => sum + c.messages.length, 0);
    const jsonStr = JSON.stringify(conversations);
    const estimatedSizeKB = Math.round(new Blob([jsonStr]).size / 1024);
    const oldest = conversations.length > 0
      ? Math.min(...conversations.map((c) => c.createdAt))
      : null;

    return {
      totalConversations: conversations.length,
      totalMessages,
      estimatedSizeKB,
      oldestConversationDate: oldest,
    };
  },

  getMessageCount: (conversationId: string) => {
    const conv = get().conversations.find((c) => c.id === conversationId);
    return conv?.messages.length ?? 0;
  },

  loadConversations: async () => {
    try {
      const data = (await conversationStore.get<Conversation[]>('conversations')) ?? [];

      const maxConv = getMaxConversations();
      let conversations = data;
      if (conversations.length > maxConv) {
        const pinned = conversations.filter((c) => c.isPinned);
        const unpinned = conversations.filter((c) => !c.isPinned);
        conversations = [...pinned, ...unpinned.slice(0, maxConv - pinned.length)];
      }

      const sorted = sortConversations(conversations);

      let persistedActiveId: string | null = null;
      try {
        persistedActiveId = (await activeIdStore.get<string | null>('activeId')) ?? null;
      } catch (err) {
        console.error('Failed to read activeId', err);
      }
      const validatedActiveId =
        persistedActiveId && sorted.some((c) => c.id === persistedActiveId)
          ? persistedActiveId
          : sorted[0]?.id ?? null;

      set({
        conversations: sorted,
        activeConversationId: validatedActiveId,
        loaded: true,
      });
    } catch (err) {
      console.error('[ConversationStore] Failed to load conversations:', err);
      set({ conversations: [], loaded: true });
    }
  },

  saveConversations: async () => {
    try {
      const { conversations } = get();
      await conversationStore.set('conversations', conversations);
      await conversationStore.save();
    } catch (err) {
      console.error('[ConversationStore] Failed to save conversations:', err);
    }
  },
}));
