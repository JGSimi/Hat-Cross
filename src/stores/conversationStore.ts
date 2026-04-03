import { create } from 'zustand';
import { readTextFile, writeTextFile, mkdir, exists } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import type { Conversation, Message } from '../types';

const CONVERSATIONS_FILE = 'conversations.json';
const MAX_CONVERSATIONS = 50;
const MAX_MESSAGES_PER_CONVERSATION = 200;

// --- Helpers ---

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

interface ConversationState {
  conversations: Conversation[];
  activeConversationId: string | null;
  loaded: boolean;

  // Actions
  createConversation: (firstMessage?: Message) => Conversation;
  deleteConversation: (id: string) => void;
  pinConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  setActiveConversation: (id: string | null) => void;
  addMessageToConversation: (conversationId: string, message: Message) => void;
  loadConversations: () => Promise<void>;
  saveConversations: () => Promise<void>;
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
      // Enforce max conversations — drop oldest unpinned
      if (conversations.length > MAX_CONVERSATIONS) {
        const pinned = conversations.filter((c) => c.isPinned);
        const unpinned = conversations.filter((c) => !c.isPinned);
        conversations = [...pinned, ...unpinned.slice(0, MAX_CONVERSATIONS - pinned.length)];
      }
      return {
        conversations: sortConversations(conversations),
        activeConversationId: conversation.id,
      };
    });

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
    get().saveConversations();
  },

  pinConversation: (id) => {
    set((state) => {
      const conversations = state.conversations.map((c) =>
        c.id === id ? { ...c, isPinned: !c.isPinned } : c,
      );
      return { conversations: sortConversations(conversations) };
    });
    get().saveConversations();
  },

  renameConversation: (id, title) => {
    set((state) => {
      const conversations = state.conversations.map((c) =>
        c.id === id ? { ...c, title } : c,
      );
      return { conversations };
    });
    get().saveConversations();
  },

  setActiveConversation: (id) => {
    set({ activeConversationId: id });
  },

  addMessageToConversation: (conversationId, message) => {
    set((state) => {
      const conversations = state.conversations.map((c) => {
        if (c.id !== conversationId) return c;

        let messages = [...c.messages, message];
        // Enforce max messages per conversation
        if (messages.length > MAX_MESSAGES_PER_CONVERSATION) {
          messages = messages.slice(messages.length - MAX_MESSAGES_PER_CONVERSATION);
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

  loadConversations: async () => {
    try {
      const dataDir = await appDataDir();
      const filePath = await join(dataDir, CONVERSATIONS_FILE);
      const fileExists = await exists(filePath);

      if (!fileExists) {
        set({ conversations: [], loaded: true });
        return;
      }

      const raw = await readTextFile(filePath);
      const data = JSON.parse(raw) as Conversation[];
      set({ conversations: sortConversations(data), loaded: true });
    } catch (err) {
      console.error('[ConversationStore] Failed to load conversations:', err);
      set({ conversations: [], loaded: true });
    }
  },

  saveConversations: async () => {
    try {
      const dataDir = await appDataDir();
      const dirExists = await exists(dataDir);
      if (!dirExists) {
        await mkdir(dataDir, { recursive: true });
      }
      const filePath = await join(dataDir, CONVERSATIONS_FILE);
      const { conversations } = get();
      await writeTextFile(filePath, JSON.stringify(conversations, null, 2));
    } catch (err) {
      console.error('[ConversationStore] Failed to save conversations:', err);
    }
  },
}));
