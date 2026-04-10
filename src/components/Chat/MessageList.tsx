import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
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
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll on new messages only
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Separate throttled scroll for streaming (max 3 times/sec)
  useEffect(() => {
    if (!isStreaming) return;
    const interval = setInterval(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 300);
    return () => clearInterval(interval);
  }, [isStreaming]);

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}
    >
      {/* System notices (auto-new-chat messages) */}
      <AnimatePresence initial={false}>
        {messages.map((msg, i) => {
          const prev = i > 0 ? messages[i - 1] : null;
          const isGrouped = prev !== null && prev.isUser === msg.isUser;

          // Detect system notice (auto-created chat notification)
          const isSystemNotice = !msg.isUser && msg.content.startsWith('**Nova conversa criada automaticamente');

          // Only stagger the last N messages
          const staggerIndex = i >= messages.length - STAGGER_WINDOW
            ? i - (messages.length - STAGGER_WINDOW)
            : 0;
          const delay = i >= messages.length - STAGGER_WINDOW
            ? staggerIndex * 0.04
            : 0;

          if (isSystemNotice) {
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay, type: 'spring', stiffness: 300, damping: 25 }}
                style={{
                  margin: '16px 0',
                  padding: '10px 14px',
                  background: 'color-mix(in srgb, var(--color-accent) 8%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-accent) 15%, transparent)',
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: 13 }}>+</span>
                </div>
                <div style={{
                  fontSize: 11.5,
                  lineHeight: 1.5,
                  color: 'var(--text-secondary)',
                }}>
                  <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-accent)', fontSize: 11 }}>
                    Nova conversa iniciada
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 10.5, color: 'var(--text-muted)' }}>
                    Limite de contexto atingido. Conversa anterior preservada no histórico.
                  </p>
                </div>
              </motion.div>
            );
          }

          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay, type: 'spring', stiffness: 400, damping: 28 }}
            >
              <MessageBubble
                message={msg}
                isGrouped={isGrouped}
              />
            </motion.div>
          );
        })}

        {/* Streaming message */}
        {isStreaming && streamingContent && (
          <motion.div key="streaming" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex justify-start" style={{ marginTop: 12 }}>
              <div
                className="prose prose-invert prose-sm max-w-none"
                style={{
                  fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-normal)',
                  wordBreak: 'break-word', maxWidth: '82%',
                  borderLeft: '2px solid color-mix(in srgb, var(--color-accent) 20%, transparent)',
                  paddingLeft: 14,
                }}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                  {streamingContent}
                </ReactMarkdown>
                <span style={{ display: 'inline-block', width: 6, height: 14, background: 'var(--color-accent)', borderRadius: 1, marginLeft: 2, animation: 'blink 1s step-end infinite' }} />
              </div>
            </div>
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
              paddingLeft: 16,
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
