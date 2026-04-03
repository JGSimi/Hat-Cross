import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Send, Square } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { useChat } from '../../hooks/useChat';
import { useScreenCapture } from '../../hooks/useScreenCapture';
import { useChatStore } from '../../stores/chatStore';
import { generateId } from '../../utils/markdown';
import AttachmentPreview from '../Chat/AttachmentPreview';

export default function QuickInputPanel() {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { messages, isStreaming, streamingContent, sendMessage, cancel } = useChat();
  const { pendingAttachments, removeAttachment, addAttachment } = useChatStore();
  const { captureScreen } = useScreenCapture();

  const lastAiMessage = [...messages].reverse().find((m) => !m.isUser);

  const handleSend = useCallback(() => {
    if (isStreaming) {
      cancel();
      return;
    }
    if (!text.trim() && pendingAttachments.length === 0) return;
    sendMessage(text);
    setText('');
  }, [text, isStreaming, pendingAttachments, sendMessage, cancel]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
        getCurrentWindow().hide();
      });
    }
  };

  const handleScreenCapture = async () => {
    const base64 = await captureScreen();
    if (base64) {
      addAttachment({
        id: generateId(),
        name: 'Screenshot',
        data: base64,
        content: null,
        isImage: true,
      });
    }
  };

  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: 680,
        maxWidth: '100%',
        background: 'var(--glass-elevated)',
        backdropFilter: 'blur(40px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
        borderRadius: 16,
        border: '0.5px solid var(--glass-border)',
        boxShadow: 'var(--shadow-elevated)',
        overflow: 'hidden',
      }}
    >
      <AttachmentPreview attachments={pendingAttachments} onRemove={removeAttachment} />

      {/* Input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px' }}>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleScreenCapture}
          style={{
            flexShrink: 0,
            padding: 8,
            borderRadius: 8,
            color: 'var(--text-secondary)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Camera size={18} />
        </motion.button>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Mensagem rapida..."
          rows={1}
          autoFocus
          style={{
            flex: 1,
            background: 'transparent',
            color: 'var(--text-primary)',
            fontSize: 14,
            fontWeight: 500,
            resize: 'none',
            outline: 'none',
            border: 'none',
          }}
        />
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleSend}
          style={{
            flexShrink: 0,
            padding: 8,
            borderRadius: 8,
            color: isStreaming ? 'var(--error)' : 'var(--color-accent)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {isStreaming ? <Square size={18} /> : <Send size={18} />}
        </motion.button>
      </div>

      {/* Response area */}
      <AnimatePresence>
        {(lastAiMessage || (isStreaming && streamingContent)) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            layout
            style={{
              borderTop: '0.5px solid var(--border-subtle)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                maxHeight: 320,
                overflowY: 'auto',
              }}
            >
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                  {isStreaming && streamingContent ? streamingContent : lastAiMessage?.content || ''}
                </ReactMarkdown>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isStreaming && !streamingContent && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{
              borderTop: '0.5px solid var(--border-subtle)',
              padding: '12px 16px',
            }}
          >
            <div style={{ display: 'flex', gap: 6 }}>
              {[0, 0.2, 0.4].map((delay) => (
                <div
                  key={delay}
                  className="typing-dot"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--text-muted)',
                    animationDelay: `${delay}s`,
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyboard hints */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 6,
          padding: '6px 16px 8px',
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontFamily: "'SF Mono', 'Fira Code', monospace",
            color: 'var(--text-muted)',
            background: 'var(--glass-secondary)',
            padding: '2px 6px',
            borderRadius: 4,
            border: '0.5px solid var(--glass-border-subtle)',
          }}
        >
          Return
        </span>
        <span
          style={{
            fontSize: 9,
            fontFamily: "'SF Mono', 'Fira Code', monospace",
            color: 'var(--text-muted)',
            background: 'var(--glass-secondary)',
            padding: '2px 6px',
            borderRadius: 4,
            border: '0.5px solid var(--glass-border-subtle)',
          }}
        >
          Esc
        </span>
      </div>
    </motion.div>
  );
}
