import { create } from 'zustand';
import type { Message, ChatAttachment } from '../types';
import { useConversationStore } from './conversationStore';

interface ChatState {
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  pendingAttachments: ChatAttachment[];
  error: string | null;

  // Actions
  addMessage: (message: Message) => void;
  clearMessages: () => void;
  setStreaming: (streaming: boolean) => void;
  appendStreamContent: (chunk: string) => void;
  finishStream: () => void;
  addAttachment: (attachment: ChatAttachment) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
  setError: (error: string | null) => void;
  loadFromConversation: (conversationId: string) => void;
}

export const useChatStore = create<ChatState>()((set, get) => ({
  messages: [],
  isStreaming: false,
  streamingContent: '',
  pendingAttachments: [],
  error: null,

  addMessage: (message) => {
    set((state) => ({
      messages: [...state.messages, message],
      error: null,
    }));
  },

  clearMessages: () => {
    set({ messages: [], error: null, streamingContent: '' });
  },

  setStreaming: (streaming) => {
    set({
      isStreaming: streaming,
      ...(streaming ? { streamingContent: '', error: null } : {}),
    });
  },

  appendStreamContent: (chunk) => {
    set((state) => ({
      streamingContent: state.streamingContent + chunk,
    }));
  },

  finishStream: () => {
    const { streamingContent } = get();

    if (streamingContent.length > 0) {
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        content: streamingContent,
        isUser: false,
        timestamp: Date.now(),
        source: 'chat',
      };

      set((state) => ({
        messages: [...state.messages, assistantMessage],
        isStreaming: false,
        streamingContent: '',
      }));
    } else {
      set({ isStreaming: false, streamingContent: '' });
    }
  },

  addAttachment: (attachment) => {
    set((state) => ({
      pendingAttachments: [...state.pendingAttachments, attachment],
    }));
  },

  removeAttachment: (id) => {
    set((state) => ({
      pendingAttachments: state.pendingAttachments.filter((a) => a.id !== id),
    }));
  },

  clearAttachments: () => {
    set({ pendingAttachments: [] });
  },

  setError: (error) => {
    set({ error });
  },

  loadFromConversation: (conversationId) => {
    const convStore = useConversationStore.getState();
    const conversation = convStore.conversations.find((c) => c.id === conversationId);
    if (conversation) {
      set({ messages: [...conversation.messages], error: null, streamingContent: '' });
    }
  },
}));
