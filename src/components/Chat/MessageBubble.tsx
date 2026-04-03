import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { formatTimestamp } from '../../utils/markdown';
import type { Message } from '../../types';

interface Props {
  message: Message;
  isGrouped: boolean;
  isFirst: boolean;
}

export default function MessageBubble({ message, isGrouped, isFirst }: Props) {
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const spacing = isGrouped ? '3px' : '8px';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      style={{ marginTop: spacing }}
      className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* AI avatar - only on first of group */}
      {!message.isUser && (
        <div className="flex-shrink-0 mr-2" style={{ width: 30 }}>
          {isFirst && (
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: 'var(--glass-secondary)',
                border: '0.5px solid var(--glass-border-subtle)',
                boxShadow: '0 0 5px var(--accent-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
              }}
            >
              🎩
            </div>
          )}
        </div>
      )}

      <div className="relative" style={{ maxWidth: '85%' }}>
        {message.isUser ? (
          <div
            style={{
              background: 'var(--user-bubble-bg)',
              border: '0.5px solid var(--accent-border)',
              borderRadius: 14,
              paddingLeft: 14,
              paddingRight: 14,
              paddingTop: 10,
              paddingBottom: 10,
              fontSize: 12.5,
              lineHeight: 1.5,
              color: 'var(--text-primary)',
            }}
          >
            <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
              {message.content}
            </p>
          </div>
        ) : (
          <div
            className="prose prose-invert prose-sm max-w-none"
            style={{
              fontSize: 12.5,
              lineHeight: 1.6,
              color: 'var(--text-primary)',
              wordBreak: 'break-word',
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Hover actions: copy + timestamp */}
        <div
          style={{
            position: 'absolute',
            bottom: -18,
            right: message.isUser ? 0 : undefined,
            left: message.isUser ? undefined : 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            opacity: hovered ? 1 : 0,
            transition: 'opacity 0.15s ease',
            pointerEvents: hovered ? 'auto' : 'none',
          }}
        >
          <button
            onClick={handleCopy}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 2,
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Copiar"
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
          </button>
          <span
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
            }}
          >
            {formatTimestamp(message.timestamp)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
