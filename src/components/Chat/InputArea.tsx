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
      style={{ padding: '4px 10px 10px', flexShrink: 0 }}
    >
      <AttachmentPreview attachments={attachments} onRemove={onRemoveAttachment} />

      <div
        style={{
          background: isDragOver
            ? 'rgba(255, 255, 255, 0.08)'
            : 'rgba(255, 255, 255, 0.04)',
          border: isFocused
            ? '1px solid rgba(var(--color-accent-rgb, 99, 102, 241), 0.4)'
            : '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 12,
          padding: '8px 10px',
          boxShadow: isFocused
            ? '0 0 0 3px rgba(99, 102, 241, 0.12), inset 0 1px 0 rgba(255,255,255,0.04)'
            : 'inset 0 1px 0 rgba(255,255,255,0.03)',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'flex-end',
          gap: 6,
        }}
      >
        {/* Camera button */}
        {onScreenCapture && (
          <motion.button
            whileHover={{ scale: 1.1, color: 'rgba(255,255,255,0.7)' }}
            whileTap={{ scale: 0.9 }}
            onClick={onScreenCapture}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 4, display: 'flex', alignItems: 'center',
              color: 'rgba(255,255,255,0.3)', flexShrink: 0,
              borderRadius: 6,
            }}
            title="Capturar tela"
          >
            <Camera size={16} />
          </motion.button>
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
            color: 'rgba(255,255,255,0.9)',
            fontSize: 13,
            lineHeight: 1.5,
            resize: 'none',
            padding: '2px 0',
            maxHeight: 96,
            fontFamily: 'inherit',
          }}
        />

        {/* Send / Stop */}
        <motion.button
          onClick={handleSend}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.92 }}
          style={{
            background: isStreaming
              ? 'rgba(248, 113, 113, 0.15)'
              : hasContent
                ? 'var(--color-accent)'
                : 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: hasContent || isStreaming ? 5 : 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: isStreaming
              ? '#f87171'
              : hasContent
                ? 'white'
                : 'rgba(255,255,255,0.25)',
            borderRadius: 8,
            transition: 'all 0.15s ease',
          }}
          title={isStreaming ? 'Parar' : 'Enviar'}
        >
          {isStreaming ? <Square size={16} /> : <Send size={16} />}
        </motion.button>
      </div>
    </div>
  );
}
