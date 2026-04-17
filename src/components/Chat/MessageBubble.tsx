import { useState, memo } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { formatTimestamp } from '../../utils/markdown';
import ThinkingBlock from './ThinkingBlock';
import type { Message } from '../../types';

interface Props {
  message: Message;
  isGrouped: boolean;
}

function MessageBubble({ message, isGrouped }: Props) {
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = message.thinking
      ? `<thinking>\n${message.thinking}\n</thinking>\n\n${message.content}`
      : message.content;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      style={{ marginTop: isGrouped ? 4 : 12 }}
      className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ position: 'relative', maxWidth: '82%' }}>
        {message.isUser ? (
          <div
            style={{
              background: 'var(--user-bubble-bg)',
              border: '1px solid var(--accent-border)',
              borderRadius: 16, borderBottomRightRadius: 4,
              padding: '10px 15px', fontSize: 13.5, lineHeight: 1.55,
              color: 'var(--text-strong)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
              {message.content}
            </p>
          </div>
        ) : (
          <>
            {message.thinking && (
              <ThinkingBlock thinking={message.thinking} />
            )}
            <div
              className="prose prose-invert prose-sm max-w-none"
              style={{
                fontSize: 13.5, lineHeight: 1.6,
                color: 'var(--text-normal)',
                wordBreak: 'break-word',
                borderLeft: '2px solid color-mix(in srgb, var(--color-accent) 20%, transparent)',
                paddingLeft: 14,
              }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                {message.content}
              </ReactMarkdown>
            </div>
          </>
        )}

        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            marginTop: 4,
            justifyContent: message.isUser ? 'flex-end' : 'flex-start',
            opacity: hovered ? 1 : 0.35,
            transition: 'opacity var(--transition-normal)',
          }}
        >
          <button
            onClick={handleCopy}
            style={{
              background: 'color-mix(in srgb, var(--bg-secondary) 90%, transparent)',
              backdropFilter: 'blur(8px)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6, cursor: 'pointer', padding: '3px 7px',
              color: copied ? 'var(--success)' : 'var(--text-faint)',
              display: 'flex', alignItems: 'center', gap: 3, fontSize: 10,
              transition: 'color var(--transition-normal)',
            }}
          >
            {copied ? <Check size={9} /> : <Copy size={9} />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
          <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>
            {formatTimestamp(message.timestamp)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export default memo(MessageBubble, (prev, next) => {
  return prev.message.id === next.message.id &&
         prev.message.content === next.message.content &&
         prev.message.thinking === next.message.thinking &&
         prev.isGrouped === next.isGrouped;
});
