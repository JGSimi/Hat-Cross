import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import type { Message } from '../../types';

interface Props {
  messages: Message[];
  streamingContent: string;
  isStreaming: boolean;
}

export default function MessageList({ messages, streamingContent, isStreaming }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0">
      {messages.map((msg, i) => {
        const prev = i > 0 ? messages[i - 1] : null;
        const isGrouped = prev !== null && prev.isUser === msg.isUser;
        return <MessageBubble key={msg.id} message={msg} isGrouped={isGrouped} />;
      })}
      {isStreaming && streamingContent && (
        <MessageBubble
          message={{
            id: 'streaming',
            content: streamingContent,
            isUser: false,
            timestamp: Date.now(),
            source: 'chat',
          }}
          isGrouped={messages.length > 0 && !messages[messages.length - 1].isUser}
        />
      )}
      {isStreaming && !streamingContent && (
        <div className="flex justify-start mt-3">
          <div className="bg-[var(--color-ai-bubble)] px-4 py-3 rounded-xl">
            <div className="flex space-x-1.5">
              <div className="w-2 h-2 bg-[var(--color-text-muted)] rounded-full typing-dot" style={{ animationDelay: '0s' }} />
              <div className="w-2 h-2 bg-[var(--color-text-muted)] rounded-full typing-dot" style={{ animationDelay: '0.2s' }} />
              <div className="w-2 h-2 bg-[var(--color-text-muted)] rounded-full typing-dot" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
