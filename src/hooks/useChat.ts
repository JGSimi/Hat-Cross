import { useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useChatStore } from '../stores/chatStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useConversationStore } from '../stores/conversationStore';
import { dispatchStream } from '../services/ai/dispatch';
import type { Message } from '../types';
import { generateId } from '../utils/markdown';

// Threshold to warn user (percentage of max context)
const CONTEXT_WARNING_THRESHOLD = 0.8;

export function useChat() {
  const cancelRef = useRef<(() => void) | null>(null);
  const {
    messages,
    isStreaming,
    streamingContent,
    streamingThinking,
    pendingAttachments,
    addMessage,
    clearMessages,
    setStreaming,
    appendStreamContent,
    appendStreamThinking,
    finishStream,
    clearAttachments,
    setError,
  } = useChatStore();
  const settings = useSettingsStore((s) => s.settings);
  const providerConfigs = useSettingsStore((s) => s.providerConfigs);
  const updateTokenStats = useSettingsStore((s) => s.updateTokenStats);
  const { activeConversationId, addMessageToConversation } = useConversationStore();

  const chatLimits = settings.chatLimits ?? {
    maxContextMessages: 40,
    maxConversations: 50,
    maxMessagesPerConversation: 200,
    autoNewChatOnLimit: true,
  };

  // Check if we're near/at the context limit
  const contextUsage = messages.length / chatLimits.maxContextMessages;
  const isNearContextLimit = contextUsage >= CONTEXT_WARNING_THRESHOLD;
  const isAtContextLimit = messages.length >= chatLimits.maxContextMessages;

  const sendMessage = useCallback(
    async (text: string, images: string[] = []) => {
      if (!text.trim() && images.length === 0) return;
      if (isStreaming) return;

      const currentMessages = useChatStore.getState().messages;
      const currentLimits = useSettingsStore.getState().settings.chatLimits ?? chatLimits;

      // Check if at context limit — auto-create new chat
      if (currentMessages.length >= currentLimits.maxContextMessages && currentLimits.autoNewChatOnLimit) {
        // Create the user message first
        const userMsg: Message = {
          id: generateId(),
          content: text,
          isUser: true,
          timestamp: Date.now(),
          source: 'chat',
        };

        // Clear current chat and create new conversation
        clearMessages();
        const conv = useConversationStore.getState().createConversation(userMsg);

        // Add system notification about the new chat
        const systemNotice: Message = {
          id: generateId(),
          content: '**Nova conversa criada automaticamente.**\nO limite de mensagens do chat anterior foi atingido para manter a qualidade das respostas da IA. Esta é uma nova conversa limpa.',
          isUser: false,
          timestamp: Date.now() - 1, // Slightly before to appear first
          source: 'chat',
        };

        addMessage(systemNotice);
        addMessageToConversation(conv.id, systemNotice);
        addMessage(userMsg);

        // Now send with fresh context
        const history = [
          { role: 'user' as const, textContent: text },
        ];

        const allImages = [
          ...images,
          ...pendingAttachments.filter((a) => a.isImage && a.data).map((a) => a.data!),
        ];
        clearAttachments();

        setError(null);

        try {
          const cancel = await dispatchStream(
            {
              messages: history,
              systemPrompt: settings.systemPrompt,
              temperature: settings.temperature,
              maxTokens: settings.maxTokens,
              images: allImages,
              onChunk: (chunk) => {
                if (chunk.text) {
                  if (chunk.contentType === 'thinking') {
                    appendStreamThinking(chunk.text);
                  } else {
                    appendStreamContent(chunk.text);
                  }
                }
                if (chunk.isFinished && (chunk.inputTokens || chunk.outputTokens)) {
                  updateTokenStats({
                    inputTokens: chunk.inputTokens ?? 0,
                    outputTokens: chunk.outputTokens ?? 0,
                  });
                }
              },
              onError: (error) => { setError(error); setStreaming(false); },
              onDone: () => {
                const content = useChatStore.getState().streamingContent;
                if (content) {
                  finishStream();
                  const msgs = useChatStore.getState().messages;
                  const lastMsg = msgs[msgs.length - 1];
                  if (lastMsg && !lastMsg.isUser) {
                    addMessageToConversation(conv.id, lastMsg);
                  }
                  playCompletionSound();
                  sendNotificationIfNeeded();
                } else {
                  setStreaming(false);
                }
              },
            },
            setError,
          );
          if (cancel) {
            setStreaming(true);
            cancelRef.current = cancel;
          }
        } catch (e) {
          setError(String(e));
          setStreaming(false);
        }
        return;
      }

      // Normal flow — send with full history
      const userMsg: Message = {
        id: generateId(),
        content: text,
        isUser: true,
        timestamp: Date.now(),
        source: 'chat',
      };
      addMessage(userMsg);
      let convId = activeConversationId;
      if (!convId) {
        const conv = useConversationStore.getState().createConversation(userMsg);
        convId = conv.id;
      } else {
        addMessageToConversation(convId, userMsg);
      }

      const allImages = [
        ...images,
        ...pendingAttachments.filter((a) => a.isImage && a.data).map((a) => a.data!),
      ];
      clearAttachments();

      // Build history with context window limit
      const allMsgs = useChatStore.getState().messages;
      const contextSlice = allMsgs.slice(-currentLimits.maxContextMessages);

      const history = contextSlice.map((m) => ({
        role: m.isUser ? ('user' as const) : ('assistant' as const),
        textContent: m.content,
      }));

      setError(null);

      try {
        const cancel = await dispatchStream(
          {
            messages: history,
            systemPrompt: settings.systemPrompt,
            temperature: settings.temperature,
            maxTokens: settings.maxTokens,
            images: allImages,
            onChunk: (chunk) => {
              if (chunk.text) {
                if (chunk.contentType === 'thinking') {
                  appendStreamThinking(chunk.text);
                } else {
                  appendStreamContent(chunk.text);
                }
              }
              if (chunk.isFinished && (chunk.inputTokens || chunk.outputTokens)) {
                updateTokenStats({
                  inputTokens: chunk.inputTokens ?? 0,
                  outputTokens: chunk.outputTokens ?? 0,
                });
              }
            },
            onError: (error) => {
              setError(error);
              setStreaming(false);
            },
            onDone: () => {
              const content = useChatStore.getState().streamingContent;
              if (content) {
                finishStream();
                const msgs = useChatStore.getState().messages;
                const lastMsg = msgs[msgs.length - 1];
                if (lastMsg && !lastMsg.isUser && convId) {
                  addMessageToConversation(convId, lastMsg);
                }
                playCompletionSound();
                sendNotificationIfNeeded();
              } else {
                setStreaming(false);
              }
            },
          },
          setError,
        );
        if (cancel) {
          setStreaming(true);
          cancelRef.current = cancel;
        }
      } catch (e) {
        setError(String(e));
        setStreaming(false);
      }
    },
    [messages, isStreaming, pendingAttachments, settings, providerConfigs, activeConversationId]
  );

  const cancel = useCallback(() => {
    if (cancelRef.current) {
      cancelRef.current();
      cancelRef.current = null;
    }
    const content = useChatStore.getState().streamingContent;
    const thinking = useChatStore.getState().streamingThinking;
    if (content) {
      const aiMsg: Message = {
        id: generateId(),
        content: content + '\n\n*[Cancelado]*',
        isUser: false,
        timestamp: Date.now(),
        source: 'chat',
        thinking: thinking || undefined,
      };
      useChatStore.setState({ streamingContent: '', streamingThinking: '', isStreaming: false });
      addMessage(aiMsg);
    }
    setStreaming(false);
  }, [addMessage, setStreaming]);

  return {
    messages,
    isStreaming,
    streamingContent,
    streamingThinking,
    pendingAttachments,
    sendMessage,
    cancel,
    clearMessages,
    // Context limit info
    contextUsage,
    isNearContextLimit,
    isAtContextLimit,
    maxContextMessages: chatLimits.maxContextMessages,
  };
}

// --- Helpers ---

function playCompletionSound() {
  const currentSettings = useSettingsStore.getState().settings;
  if (currentSettings.soundEnabled) {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.value = 800; g.gain.value = 0.1;
      osc.start(); osc.stop(ctx.currentTime + 0.15);
    } catch {}
  }
}

function sendNotificationIfNeeded() {
  const currentSettings = useSettingsStore.getState().settings;
  if (currentSettings.notifications.enabled && currentSettings.notifications.showChatResponseNotification && !document.hasFocus()) {
    invoke('send_notification', { title: 'Hat', body: 'Resposta recebida' }).catch(() => {});
  }
}
