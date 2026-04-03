import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
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
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasContent = text.trim().length > 0 || attachments.length > 0;

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
    const maxHeight = 4 * 24;
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
      style={{
        padding: '0 10px 8px 10px',
      }}
    >
      <AttachmentPreview attachments={attachments} onRemove={onRemoveAttachment} />

      <div
        style={{
          background: isDragOver ? 'var(--glass-elevated)' : 'var(--glass-secondary)',
          border: isFocused
            ? '0.5px solid var(--border-focused)'
            : '0.5px solid var(--border-subtle)',
          borderRadius: 12,
          padding: '8px 12px',
          boxShadow: isFocused
            ? '0 0 0 3px var(--accent-glow)'
            : 'var(--shadow-soft)',
          transition: 'background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
          display: 'flex',
          alignItems: 'flex-end',
          gap: 8,
        }}
      >
        {/* Action buttons group */}
        {onScreenCapture && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--glass-secondary)',
              border: '0.5px solid var(--border-subtle)',
              borderRadius: 7,
              padding: 4,
              flexShrink: 0,
            }}
          >
            <button
              onClick={onScreenCapture}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
              title="Capturar tela"
            >
              <Camera size={16} />
            </button>
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Mensagem..."
          rows={1}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: 12.5,
            lineHeight: 1.5,
            resize: 'none',
            padding: '2px 0',
            maxHeight: 96,
            fontFamily: 'inherit',
          }}
        />

        {/* Send / Stop button */}
        <motion.button
          onClick={handleSend}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.96 }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: isStreaming
              ? '#f87171'
              : hasContent
                ? 'var(--color-accent)'
                : 'var(--text-muted)',
            boxShadow: hasContent && !isStreaming
              ? '0 0 8px var(--accent-glow)'
              : 'none',
            borderRadius: 6,
            transition: 'color 0.15s ease, box-shadow 0.15s ease',
          }}
          title={isStreaming ? 'Parar' : 'Enviar'}
        >
          {isStreaming ? <Square size={22} /> : <Send size={22} />}
        </motion.button>
      </div>
    </div>
  );
}
