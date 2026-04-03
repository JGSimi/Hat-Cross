import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
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
    <div className="flex flex-col w-full glass rounded-2xl overflow-hidden border border-[var(--color-border)] animate-scale-in">
      <AttachmentPreview attachments={pendingAttachments} onRemove={removeAttachment} />

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          onClick={handleScreenCapture}
          className="flex-shrink-0 p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
        >
          <Camera size={18} />
        </button>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Mensagem rápida..."
          rows={1}
          autoFocus
          className="flex-1 bg-transparent text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] text-sm resize-none outline-none"
        />
        <button
          onClick={handleSend}
          className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
            isStreaming
              ? 'text-red-400 hover:bg-red-500/20'
              : 'text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20'
          }`}
        >
          {isStreaming ? <Square size={18} /> : <Send size={18} />}
        </button>
      </div>

      {/* Response area */}
      {(lastAiMessage || (isStreaming && streamingContent)) && (
        <div className="border-t border-[var(--color-border)] px-4 py-3 max-h-80 overflow-y-auto">
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {isStreaming && streamingContent ? streamingContent : lastAiMessage?.content || ''}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {isStreaming && !streamingContent && (
        <div className="border-t border-[var(--color-border)] px-4 py-3">
          <div className="flex space-x-1.5">
            <div className="w-2 h-2 bg-[var(--color-text-muted)] rounded-full typing-dot" style={{ animationDelay: '0s' }} />
            <div className="w-2 h-2 bg-[var(--color-text-muted)] rounded-full typing-dot" style={{ animationDelay: '0.2s' }} />
            <div className="w-2 h-2 bg-[var(--color-text-muted)] rounded-full typing-dot" style={{ animationDelay: '0.4s' }} />
          </div>
        </div>
      )}
    </div>
  );
}
