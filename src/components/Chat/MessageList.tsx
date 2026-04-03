import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import MessageBubble from './MessageBubble';
import type { Message } from '../../types';

interface Props {
  messages: Message[];
  streamingContent: string;
  isStreaming: boolean;
}

const STAGGER_WINDOW = 6;

export default function MessageList({ messages, streamingContent, isStreaming }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
      <AnimatePresence initial={false}>
        {messages.map((msg, i) => {
          const prev = i > 0 ? messages[i - 1] : null;
          const isGrouped = prev !== null && prev.isUser === msg.isUser;
          const isFirst = !isGrouped;

          // Only stagger the last N messages
          const staggerIndex = i >= messages.length - STAGGER_WINDOW
            ? i - (messages.length - STAGGER_WINDOW)
            : 0;
          const delay = i >= messages.length - STAGGER_WINDOW
            ? staggerIndex * 0.04
            : 0;

          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay }}
            >
              <MessageBubble
                message={msg}
                isGrouped={isGrouped}
                isFirst={isFirst}
              />
            </motion.div>
          );
        })}

        {/* Streaming message */}
        {isStreaming && streamingContent && (
          <motion.div
            key="streaming"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <MessageBubble
              message={{
                id: 'streaming',
                content: streamingContent,
                isUser: false,
                timestamp: Date.now(),
                source: 'chat',
              }}
              isGrouped={messages.length > 0 && !messages[messages.length - 1].isUser}
              isFirst={messages.length === 0 || messages[messages.length - 1].isUser}
            />
          </motion.div>
        )}

        {/* Typing indicator */}
        {isStreaming && !streamingContent && (
          <motion.div
            key="typing-indicator"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            style={{
              display: 'flex',
              justifyContent: 'flex-start',
              marginTop: 8,
              paddingLeft: 38,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 0' }}>
              {[0, 1, 2].map((dotIndex) => (
                <motion.div
                  key={dotIndex}
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    delay: dotIndex * 0.12,
                    ease: 'easeInOut',
                  }}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-accent)',
                    opacity: 0.85,
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div ref={bottomRef} />
    </div>
  );
}
