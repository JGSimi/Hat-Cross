import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import MessageList from '../Chat/MessageList';
import InputArea from '../Chat/InputArea';
import { dispatchStream } from '../../services/ai/dispatch';
import { useSettingsStore } from '../../stores/settingsStore';
import type { ChatAttachment, Message } from '../../types';
import type { Room } from '../../types/rooms';
import { generateId } from '../../utils/markdown';

interface Props {
  room: Room;
}

export default function RoomChatWindow({ room }: Props) {
  const { t } = useTranslation('rooms');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingThinking, setStreamingThinking] = useState('');
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const thinkingRef = useRef('');
  const settings = useSettingsStore((s) => s.settings);
  const updateTokenStats = useSettingsStore((s) => s.updateTokenStats);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      const userMessage: Message = {
        id: generateId(),
        content: text,
        isUser: true,
        timestamp: Date.now(),
        source: 'chat',
      };
      const historyMessages = [...messages, userMessage];
      setMessages(historyMessages);
      setStreaming(true);
      setStreamingContent('');
      setStreamingThinking('');
      thinkingRef.current = '';
      setError(null);

      const cancel = await dispatchStream(
        {
          messages: historyMessages.slice(-20).map((message) => ({
            role: message.isUser ? 'user' : 'assistant',
            textContent: message.content,
          })),
          systemPrompt: settings.systemPrompt,
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
          images: [],
          roomId: room.id,
          roomShare: true,
          sourceMessageId: userMessage.id,
          onChunk: (chunk) => {
            if (chunk.text) {
              if (chunk.contentType === 'thinking') {
                thinkingRef.current += chunk.text;
                setStreamingThinking((current) => current + chunk.text);
              } else {
                setStreamingContent((current) => current + chunk.text);
              }
            }
            if (chunk.isFinished && (chunk.inputTokens || chunk.outputTokens)) {
              updateTokenStats({
                inputTokens: chunk.inputTokens ?? 0,
                outputTokens: chunk.outputTokens ?? 0,
              });
            }
          },
          onError: (message) => {
            setError(message);
            setStreaming(false);
          },
          onDone: () => {
            setStreaming(false);
            setStreamingContent((content) => {
              if (content) {
                setMessages((current) => [
                  ...current,
                  {
                    id: generateId(),
                    content,
                    isUser: false,
                    timestamp: Date.now(),
                    source: 'chat',
                    thinking: thinkingRef.current || undefined,
                  },
                ]);
              }
              return '';
            });
            setStreamingThinking('');
            thinkingRef.current = '';
          },
        },
        setError,
      );
      cancelRef.current = cancel;
      if (!cancel) setStreaming(false);
    },
    [isStreaming, messages, room.id, settings, updateTokenStats],
  );

  const cancel = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setStreaming(false);
    setStreamingContent('');
    setStreamingThinking('');
    thinkingRef.current = '';
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      <div style={{ padding: '10px 16px 0', flexShrink: 0 }}>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 11 }}>
          {t('chat.disclaimer')}
        </p>
      </div>
      <MessageList
        messages={messages}
        streamingContent={streamingContent}
        streamingThinking={streamingThinking}
        isStreaming={isStreaming}
      />
      {error && (
        <div style={{ margin: '0 16px 8px', color: 'var(--error)', fontSize: 12 }}>
          {error}
        </div>
      )}
      <InputArea
        onSend={sendMessage}
        onCancel={cancel}
        isStreaming={isStreaming}
        attachments={[] as ChatAttachment[]}
        onRemoveAttachment={() => {}}
        conversationId={`room:${room.id}`}
      />
    </div>
  );
}
