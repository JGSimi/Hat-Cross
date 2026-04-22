import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import MessageBubble from './MessageBubble';
import ThinkingBlock from './ThinkingBlock';
import type { Message } from '../../types';

interface Props {
  messages: Message[];
  streamingContent: string;
  streamingThinking: string;
  isStreaming: boolean;
}

const STAGGER_WINDOW = 6;

export default function MessageList({ messages, streamingContent, streamingThinking, isStreaming }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll on new messages. We write to containerRef.scrollTop directly
  // instead of calling scrollIntoView — scrollIntoView walks every scrollable
  // ancestor (including the window) which is what causes the whole UI to
  // drift after heavy interaction. scrollTop is scoped to just this div.
  const scrollToBottom = () => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  useEffect(() => {
    if (!isStreaming) return;
    const interval = setInterval(scrollToBottom, 800);
    return () => clearInterval(interval);
  }, [isStreaming]);

  return (
    <div
      ref={containerRef}
      // role=log + aria-live=polite lets screen readers announce each new
      // message chunk as it arrives during streaming. aria-relevant="additions"
      // ensures only new nodes are spoken, not re-announcements of already-
      // read messages. aria-atomic=false so partial streamed tokens don't
      // trigger a full re-read. aria-busy mirrors isStreaming so SRs know
      // more is coming (Rafa using VoiceOver in an interview should hear
      // what the model is saying without having to Tab into the chat).
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-atomic="false"
      aria-busy={isStreaming}
      aria-label="Conversa com o Hat"
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
        {isStreaming && (streamingContent || streamingThinking) && (
          <motion.div key="streaming" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex justify-start" style={{ marginTop: 12 }}>
              <div style={{ maxWidth: '82%' }}>
                {streamingThinking && (
                  <ThinkingBlock thinking={streamingThinking} isStreaming={!streamingContent} />
                )}
                {streamingContent && (
                  <div
                    className="prose prose-invert prose-sm max-w-none"
                    style={{
                      fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-normal)',
                      wordBreak: 'break-word',
                      borderLeft: '2px solid color-mix(in srgb, var(--color-accent) 20%, transparent)',
                      paddingLeft: 14,
                    }}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                      {streamingContent}
                    </ReactMarkdown>
                    <span style={{ display: 'inline-block', width: 6, height: 14, background: 'var(--color-accent)', borderRadius: 1, marginLeft: 2, animation: 'blink 1s step-end infinite' }} />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Typing indicator — claims the assistant-bubble space (same 2px
            accent left-border as the real reply) so the layout doesn't shift
            when the first token lands. Dots bounce vertically in a wavy
            cascade, not a flat scale pulse — more alive, less Messenger-
            stamp. Has role="status" + aria-label so VoiceOver announces
            "Hat está pensando..." without pinging every re-render. */}
        {isStreaming && !streamingContent && !streamingThinking && (
          <motion.div
            key="typing-indicator"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{
              marginTop: 12,
              display: 'flex',
              justifyContent: 'flex-start',
            }}
          >
            <div
              role="status"
              aria-label="Hat está pensando..."
              style={{
                borderLeft:
                  '2px solid color-mix(in srgb, var(--color-accent) 20%, transparent)',
                paddingLeft: 14,
                paddingTop: 4,
                paddingBottom: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              {[0, 1, 2].map((dotIndex) => (
                <motion.span
                  key={dotIndex}
                  aria-hidden
                  animate={{
                    y: [0, -4, 0],
                    opacity: [0.45, 1, 0.45],
                  }}
                  transition={{
                    duration: 0.9,
                    repeat: Infinity,
                    delay: dotIndex * 0.15,
                    ease: 'easeInOut',
                  }}
                  style={{
                    display: 'inline-block',
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: 'var(--color-accent)',
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
