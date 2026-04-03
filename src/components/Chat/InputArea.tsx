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
  onSend, onCancel, onScreenCapture, isStreaming,
  attachments, onRemoveAttachment, onAddAttachment,
}: Props) {
  const [text, setText] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasContent = text.trim().length > 0 || attachments.length > 0;

  const handleSend = useCallback(() => {
    if (isStreaming) { onCancel(); return; }
    if (!text.trim() && attachments.length === 0) return;
    onSend(text);
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [text, isStreaming, attachments, onSend, onCancel]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setIsDragOver(false);
    if (!onAddAttachment) return;
    for (const file of Array.from(e.dataTransfer.files)) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          onAddAttachment({
            id: crypto.randomUUID(), name: file.name,
            data: (reader.result as string).split(',')[1],
            content: null, isImage: true,
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
      style={{ padding: '8px 12px 12px', flexShrink: 0 }}
    >
      <AttachmentPreview attachments={attachments} onRemove={onRemoveAttachment} />
      <div
        style={{
          background: isDragOver ? 'var(--surface-input-hover)' : 'var(--surface-input)',
          border: isFocused ? '1px solid var(--border-focused)' : '1px solid var(--border-input)',
          borderRadius: 12, padding: '8px 12px',
          boxShadow: isFocused ? '0 0 0 3px var(--accent-glow), var(--inset-highlight)' : 'var(--inset-highlight)',
          transition: 'border-color var(--transition-normal), box-shadow var(--transition-normal), background var(--transition-normal)',
          display: 'flex', alignItems: 'flex-end', gap: 6,
        }}
      >
        {onScreenCapture && (
          <motion.button
            whileHover={{ scale: 1.1, color: 'var(--text-soft)' }}
            whileTap={{ scale: 0.9 }}
            onClick={onScreenCapture}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 4, display: 'flex', alignItems: 'center',
              color: 'var(--text-faint)', flexShrink: 0, borderRadius: 6,
            }}
            aria-label="Capturar tela"
          >
            <Camera size={16} />
          </motion.button>
        )}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Mensagem..."
          aria-label="Mensagem"
          rows={1}
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            color: 'var(--text-strong)', fontSize: 13, lineHeight: 1.5,
            resize: 'none', padding: '2px 0', maxHeight: 96, fontFamily: 'inherit',
          }}
        />
        <motion.button
          onClick={handleSend}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.92 }}
          style={{
            background: isStreaming
              ? 'color-mix(in srgb, var(--error) 15%, transparent)'
              : hasContent ? 'var(--color-accent)' : 'transparent',
            border: 'none', cursor: 'pointer',
            padding: hasContent || isStreaming ? 5 : 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            color: isStreaming ? 'var(--error)' : hasContent ? 'white' : 'var(--text-faint)',
            borderRadius: 8, transition: 'all var(--transition-normal)',
          }}
          aria-label="Enviar"
        >
          {isStreaming ? <Square size={16} /> : <Send size={16} />}
        </motion.button>
      </div>
    </div>
  );
}
