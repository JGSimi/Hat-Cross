import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { Send, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AttachmentPreview from './AttachmentPreview';
import ModeSelector from './ModeSelector';
import type { ChatAttachment } from '../../types';
import { useDraftsStore } from '../../stores/draftsStore';
import { useAuthStore } from '../../stores/authStore';
import { useCreditsStore } from '../../stores/creditsStore';
import { formatDraftAge } from '../../utils/markdown';

interface Props {
  onSend: (text: string, images?: string[]) => void;
  onCancel: () => void;
  isStreaming: boolean;
  attachments: ChatAttachment[];
  onRemoveAttachment: (id: string) => void;
  onAddAttachment?: (attachment: ChatAttachment) => void;
  conversationId: string | null;
}

export default function InputArea({
  onSend, onCancel, isStreaming,
  attachments, onRemoveAttachment, onAddAttachment, conversationId,
}: Props) {
  const [text, setText] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [draftChipLabel, setDraftChipLabel] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const shouldAnimatePlunger = useRef(false);
  const { t } = useTranslation('chat');
  const selectedMode = useCreditsStore((s) => s.selectedMode);
  // Varies the placeholder per mode so Hat (quick) and Hat Pro (deep
  // analysis) communicate their shape at the point of entry. Falls back
  // to the generic label if the key for a new mode is ever missing.
  const placeholder = t(`input.placeholderByMode.${selectedMode}`, {
    defaultValue: t('input.placeholder'),
  });
  // Session-only tracker so the plunger animation fires at most once per conversation per session.
  const hydratedIds = useRef(new Set<string>());
  const hasContent = text.trim().length > 0 || attachments.length > 0;
  const isSignedIn = useAuthStore((s) => s.user !== null);

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, []);

  useEffect(() => {
    if (!conversationId) {
      setText('');
      setDraftChipLabel(null);
      shouldAnimatePlunger.current = false;
      return;
    }
    const draft = useDraftsStore.getState().getDraft(conversationId);
    const alreadyHydrated = hydratedIds.current.has(conversationId);
    if (draft?.text && !alreadyHydrated) {
      shouldAnimatePlunger.current = true;
      hydratedIds.current.add(conversationId);
    } else {
      shouldAnimatePlunger.current = false;
    }
    setText(draft?.text ?? '');
    setDraftChipLabel(draft ? formatDraftAge(draft.updatedAt) : null);
    // Resize on next tick so auto-grow matches hydrated content after setText commits.
    requestAnimationFrame(resizeTextarea);
  }, [conversationId, resizeTextarea]);


  const handleSend = useCallback(() => {
    if (isStreaming) { onCancel(); return; }
    if (!text.trim() && attachments.length === 0) return;
    onSend(text);
    setText('');
    setDraftChipLabel(null);
    resizeTextarea();
    if (conversationId) {
      useDraftsStore.getState().clearDraft(conversationId);
    }
  }, [text, isStreaming, attachments, onSend, onCancel, conversationId, resizeTextarea]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setText(value);
    if (conversationId) {
      useDraftsStore.getState().setDraft(conversationId, value);
    }
    // Clear chip as soon as user starts editing their own draft
    if (draftChipLabel) setDraftChipLabel(null);
  };

  const handleInput = resizeTextarea;

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

  const animatePlunger = shouldAnimatePlunger.current;
  const wrapperKey = `${conversationId ?? 'none'}:${animatePlunger ? 'plunger' : 'static'}`;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ padding: '10px 16px 14px', flexShrink: 0 }}
    >
      <AttachmentPreview attachments={attachments} onRemove={onRemoveAttachment} />
      {isSignedIn && (
        <div style={{ marginBottom: 8 }}>
          <ModeSelector />
        </div>
      )}
      {draftChipLabel && (
        <motion.div
          initial={{ opacity: 0, y: -2 }}
          animate={{ opacity: 0.7, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            marginBottom: 6,
            padding: '2px 8px',
            fontSize: 10,
            color: 'var(--text-muted)',
            background: 'color-mix(in srgb, var(--surface-input) 60%, transparent)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid var(--border-input)',
            borderRadius: 6,
            letterSpacing: '0.02em',
          }}
        >
          {draftChipLabel}
        </motion.div>
      )}
      <motion.div
        key={wrapperKey}
        initial={animatePlunger ? { y: 4, opacity: 0.7 } : false}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        style={{
          background: isDragOver
            ? 'var(--surface-input-hover)'
            : 'color-mix(in srgb, var(--surface-input) 80%, transparent)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: isFocused ? '1px solid var(--border-focused)' : '1px solid var(--border-input)',
          borderRadius: 14, padding: '10px 14px',
          boxShadow: isFocused
            ? '0 0 0 1px var(--accent-glow), var(--inset-highlight)'
            : 'var(--inset-highlight)',
          transition: 'border-color var(--transition-normal), box-shadow var(--transition-normal), background var(--transition-normal)',
          display: 'flex', alignItems: 'flex-end', gap: 6,
        }}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          aria-label={t('input.ariaLabel')}
          rows={1}
          style={{
            flex: 1, background: 'none', border: 'none',
            color: 'var(--text-strong)', fontSize: 13.5, lineHeight: 1.5,
            resize: 'none', padding: '2px 0', maxHeight: 96, fontFamily: 'inherit',
            letterSpacing: '0.01em',
          }}
        />
        <motion.button
          onClick={handleSend}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.92 }}
          style={{
            background: isStreaming
              ? 'color-mix(in srgb, var(--error) 15%, transparent)'
              : hasContent ? 'var(--color-accent)' : 'rgba(255,255,255,0.04)',
            border: 'none', cursor: 'pointer',
            padding: hasContent || isStreaming ? 5 : 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            color: isStreaming ? 'var(--error)' : hasContent ? 'white' : 'var(--text-dim)',
            borderRadius: 10,
            boxShadow: hasContent && !isStreaming ? '0 2px 8px var(--accent-glow)' : 'none',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          aria-label={isStreaming ? t('input.stop') : t('input.send')}
        >
          {isStreaming ? <Square size={16} /> : <Send size={16} />}
        </motion.button>
      </motion.div>
    </div>
  );
}
