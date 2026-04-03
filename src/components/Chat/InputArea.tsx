import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { Camera, Send, Square } from 'lucide-react';
import AttachmentPreview from './AttachmentPreview';
import type { ChatAttachment } from '../../types';

interface Props {
  onSend: (text: string, images?: string[]) => void;
  onCancel: () => void;
  onScreenCapture?: () => void;
  isStreaming: boolean;
  attachments: ChatAttachment[];
  onRemoveAttachment: (id: string) => void;
  onAddAttachment?: (attachment: ChatAttachment) => void;
}

export default function InputArea({
  onSend,
  onCancel,
  onScreenCapture,
  isStreaming,
  attachments,
  onRemoveAttachment,
  onAddAttachment,
}: Props) {
  const [text, setText] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    if (isStreaming) {
      onCancel();
      return;
    }
    if (!text.trim() && attachments.length === 0) return;
    onSend(text);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, isStreaming, attachments, onSend, onCancel]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxHeight = 4 * 24; // 4 lines
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!onAddAttachment) return;

    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          onAddAttachment({
            id: crypto.randomUUID(),
            name: file.name,
            data: base64,
            content: null,
            isImage: true,
          });
        };
        reader.readAsDataURL(file);
      }
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border-t border-[var(--color-border)] ${isDragOver ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]/30' : ''}`}
    >
      <AttachmentPreview attachments={attachments} onRemove={onRemoveAttachment} />
      <div className="flex items-end gap-2 px-3 py-2.5">
        {onScreenCapture && (
          <button
            onClick={onScreenCapture}
            className="flex-shrink-0 p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
            title="Capturar tela"
          >
            <Camera size={18} />
          </button>
        )}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Mensagem..."
          rows={1}
          className="flex-1 bg-[var(--color-bg-input)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] rounded-xl px-3.5 py-2 text-sm resize-none outline-none border border-[var(--color-border)] focus:border-[var(--color-border-focus)] transition-colors"
          style={{ maxHeight: '96px' }}
        />
        <button
          onClick={handleSend}
          className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
            isStreaming
              ? 'text-red-400 hover:bg-red-500/20'
              : 'text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20'
          }`}
          title={isStreaming ? 'Parar' : 'Enviar'}
        >
          {isStreaming ? <Square size={18} /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}
