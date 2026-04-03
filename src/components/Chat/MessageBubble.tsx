import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, GraduationCap } from 'lucide-react';
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
      {/* AI avatar */}
      {!message.isUser && (
        <div style={{ width: 28, flexShrink: 0, marginRight: 8 }}>
          {isFirst && (
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 50%, #000))',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(99, 102, 241, 0.25)',
              }}
            >
              <GraduationCap size={14} color="white" strokeWidth={2.5} />
            </div>
          )}
        </div>
      )}

      <div style={{ position: 'relative', maxWidth: '82%' }}>
        {message.isUser ? (
          /* User bubble — accent tinted glass */
          <div
            style={{
              background: 'var(--user-bubble-bg)',
              border: '1px solid var(--accent-border)',
              borderRadius: 14,
              borderBottomRightRadius: 4,
              padding: '9px 14px',
              fontSize: 13,
              lineHeight: 1.55,
              color: 'rgba(255,255,255,0.92)',
            }}
          >
            <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
              {message.content}
            </p>
          </div>
        ) : (
          /* AI response — no bubble, just markdown */
          <div
            className="prose prose-invert prose-sm max-w-none"
            style={{
              fontSize: 13,
              lineHeight: 1.6,
              color: 'rgba(255,255,255,0.85)',
              wordBreak: 'break-word',
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Hover: copy + timestamp */}
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
              background: 'var(--surface-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 4,
              cursor: 'pointer',
              padding: '2px 5px',
              color: copied ? 'var(--success)' : 'rgba(255,255,255,0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 10,
              transition: 'color 0.15s ease',
            }}
          >
            {copied ? <Check size={9} /> : <Copy size={9} />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
            {formatTimestamp(message.timestamp)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
