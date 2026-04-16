import { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  thinking: string;
  isStreaming?: boolean;
}

function ThinkingBlock({ thinking, isStreaming = false }: Props) {
  const [expanded, setExpanded] = useState(isStreaming);
  const tokenEstimate = Math.round(thinking.length / 4);

  return (
    <div style={{
      marginBottom: 8,
      borderRadius: 10,
      border: '1px solid color-mix(in srgb, var(--color-accent) 12%, transparent)',
      background: 'color-mix(in srgb, var(--color-accent) 5%, transparent)',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          width: '100%', padding: '8px 10px',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--color-accent)', fontSize: 11, fontWeight: 500,
          opacity: 0.8,
        }}
      >
        <Brain size={13} />
        <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.15 }}>
          <ChevronRight size={12} />
        </motion.div>
        <span>
          Cadeia de pensamento
          {isStreaming && !expanded ? '...' : !isStreaming ? ` (~${tokenEstimate > 1000 ? `${(tokenEstimate / 1000).toFixed(1)}k` : tokenEstimate} tokens)` : ''}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              maxHeight: 300, overflowY: 'auto',
              padding: '0 10px 10px',
              fontSize: 12, lineHeight: 1.6,
              color: 'var(--text-muted)',
            }}>
              {thinking.length > 50000 ? (
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  {thinking}
                </pre>
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {thinking}
                </ReactMarkdown>
              )}
              {isStreaming && (
                <span style={{
                  display: 'inline-block', width: 6, height: 14,
                  background: 'var(--color-accent)', borderRadius: 1,
                  marginLeft: 2, animation: 'blink 1s step-end infinite',
                }} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default memo(ThinkingBlock);
