import { useCallback, useRef } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useConversationStore } from '../stores/conversationStore';
import { startStream } from '../services/ai';
import type { Message } from '../types';
import { PROVIDER_DEFAULTS } from '../types';
import { generateId } from '../utils/markdown';

export function useChat() {
  const cancelRef = useRef<(() => void) | null>(null);
  const {
    messages,
    isStreaming,
    streamingContent,
    pendingAttachments,
    addMessage,
    clearMessages,
    setStreaming,
    appendStreamContent,
    finishStream,
    clearAttachments,
    setError,
  } = useChatStore();
  const settings = useSettingsStore((s) => s.settings);
  const providerConfigs = useSettingsStore((s) => s.providerConfigs);
  const updateTokenStats = useSettingsStore((s) => s.updateTokenStats);
  const { activeConversationId, addMessageToConversation } = useConversationStore();

  const sendMessage = useCallback(
    async (text: string, images: string[] = []) => {
      if (!text.trim() && images.length === 0) return;
      if (isStreaming) return;

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

      const history = messages.map((m) => ({
        role: m.isUser ? ('user' as const) : ('assistant' as const),
        textContent: m.content,
      }));
      history.push({ role: 'user', textContent: text });

      const isLocal = settings.inferenceMode === 'local';
      const provider = isLocal ? 'ollama' : settings.cloudProvider;
      const cfg = isLocal ? null : providerConfigs[settings.cloudProvider];
      const endpoint = isLocal
        ? 'http://localhost:11434'
        : cfg?.endpoint || PROVIDER_DEFAULTS[settings.cloudProvider]?.defaultEndpoint || '';
      const apiKey = isLocal ? '' : cfg?.apiKey || '';
      const model = isLocal ? settings.localModel : cfg?.model || '';

      setStreaming(true);
      setError(null);

      try {
        const cancel = await startStream({
          messages: history,
          systemPrompt: settings.systemPrompt,
          provider,
          endpoint,
          apiKey,
          model,
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
          images: allImages,
          onChunk: (chunk) => {
            if (chunk.text) {
              appendStreamContent(chunk.text);
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
              // finishStream() creates the message and adds it to chatStore
              finishStream();
              // Also persist to active conversation
              const msgs = useChatStore.getState().messages;
              const lastMsg = msgs[msgs.length - 1];
              if (lastMsg && !lastMsg.isUser && convId) {
                addMessageToConversation(convId, lastMsg);
              }
              // Play notification sound if enabled
              const currentSettings = useSettingsStore.getState().settings;
              if (currentSettings.soundEnabled) {
                try {
                  const ctx = new AudioContext();
                  const oscillator = ctx.createOscillator();
                  const gain = ctx.createGain();
                  oscillator.connect(gain);
                  gain.connect(ctx.destination);
                  oscillator.frequency.value = 800;
                  gain.gain.value = 0.1;
                  oscillator.start();
                  oscillator.stop(ctx.currentTime + 0.15);
                } catch {}
              }
            } else {
              setStreaming(false);
            }
          },
        });
        cancelRef.current = cancel;
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
    if (content) {
      const aiMsg: Message = {
        id: generateId(),
        content: content + '\n\n*[Cancelado]*',
        isUser: false,
        timestamp: Date.now(),
        source: 'chat',
      };
      finishStream();
      addMessage(aiMsg);
    }
    setStreaming(false);
  }, [finishStream, addMessage, setStreaming]);

  return {
    messages,
    isStreaming,
    streamingContent,
    pendingAttachments,
    sendMessage,
    cancel,
    clearMessages,
  };
}
