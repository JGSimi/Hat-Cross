import { Pin, MoreHorizontal, Trash2, PenLine } from 'lucide-react';
import { useState, useRef, useEffect, memo, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { Conversation, Message } from '../../types';
import { formatTimestamp } from '../../utils/markdown';
import { useToastStore } from '../../stores/toastStore';

interface Props {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onPin: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}

// Strips model artefacts that leak into previews and collapses whitespace so
// one-line truncation doesn't look like broken text. Keeps human-readable
// punctuation. Called once per render (cheap, short strings).
function sanitizePreview(raw: string): string {
  return raw
    // Model "thought" blocks — never surface internal reasoning
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    .replace(/<think(ing)?>[\s\S]*?<\/think(ing)?>/gi, '')
    // Markdown headings / fences / emphasis markers that read badly on one line
    .replace(/```[\s\S]*?```/g, '[código]')
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    // Common "meta" prefixes leaked from system prompts
    .replace(/^\s*(user|assistant|system)\s*(says|:)?\s*[:"']?\s*/i, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

interface PreviewData {
  role: 'user' | 'assistant';
  text: string;
}

function buildPreview(messages: Message[]): PreviewData | null {
  const last = messages[messages.length - 1];
  if (!last) return null;
  const text = sanitizePreview(last.content);
  if (!text) return null;
  return { role: last.isUser ? 'user' : 'assistant', text };
}

function ConversationItemInner({
  conversation,
  isActive,
  onSelect,
  onPin,
  onDelete,
  onRename,
}: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(conversation.title);
  const [isHovered, setIsHovered] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [menuFlipped, setMenuFlipped] = useState(false);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const menuRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const { t } = useTranslation('chat');

  const msgCount = conversation.messages.length;
  const preview = useMemo(() => buildPreview(conversation.messages), [conversation.messages]);
  const isEmpty = msgCount === 0;

  const handleRename = () => {
    if (newTitle.trim()) onRename(newTitle.trim());
    setIsRenaming(false);
  };

  useEffect(() => {
    if (!showMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setConfirmingDelete(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowMenu(false);
        setConfirmingDelete(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showMenu]);

  useEffect(() => () => clearTimeout(deleteTimerRef.current), []);

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative',
        cursor: 'pointer',
        margin: '1px 6px',
        padding: '8px 10px 8px 12px',
        borderRadius: 8,
        // Layered background — active gets a soft accent wash, hover gets a
        // barely-there tint so rows don't shout at you during scroll.
        background: isActive
          ? 'linear-gradient(95deg, color-mix(in srgb, var(--color-accent) 14%, transparent) 0%, color-mix(in srgb, var(--color-accent) 5%, transparent) 55%, transparent 100%)'
          : isHovered
            ? 'color-mix(in srgb, var(--text-primary) 4%, transparent)'
            : 'transparent',
        transition: 'background 120ms ease',
      }}
    >
      {/* Active indicator — a subtle left-edge bloom that feels built-in
          rather than a stamped border. Spring-morphs between items via
          layoutId so the selection "glides" rather than jumps. */}
      {isActive && (
        <motion.span
          layoutId="conversation-active-indicator"
          aria-hidden
          transition={
            reducedMotion
              ? { duration: 0 }
              : { type: 'spring', stiffness: 500, damping: 38 }
          }
          style={{
            position: 'absolute',
            left: 2,
            top: '22%',
            bottom: '22%',
            width: 2,
            borderRadius: 2,
            background: 'var(--color-accent)',
            boxShadow: '0 0 8px color-mix(in srgb, var(--color-accent) 55%, transparent)',
          }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Row 1: title (+ pin) + right-aligned timestamp */}
          {isRenaming ? (
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                background: 'var(--input-bg)',
                fontSize: 12.5,
                color: 'var(--text-primary)',
                borderRadius: 4,
                padding: '2px 6px',
                outline: 'none',
                border: '0.5px solid var(--border-focused)',
              }}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                minWidth: 0,
              }}
            >
              {conversation.isPinned && (
                <Pin
                  size={9.5}
                  strokeWidth={2.4}
                  style={{
                    color: 'var(--color-accent)',
                    flexShrink: 0,
                    transform: 'rotate(38deg)',
                  }}
                />
              )}
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12.5,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--text-bright)' : 'var(--text-primary)',
                  letterSpacing: isActive ? -0.15 : -0.05,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {conversation.title}
              </span>
              <span
                style={{
                  fontSize: 9.5,
                  color: 'var(--text-dim)',
                  flexShrink: 0,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: 0.2,
                }}
              >
                {formatTimestamp(conversation.updatedAt)}
              </span>
            </div>
          )}

          {/* Row 2: preview or empty-state hint + msg count */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 3,
              minWidth: 0,
            }}
          >
            {preview ? (
              <>
                <span
                  aria-hidden
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background:
                      preview.role === 'user'
                        ? 'color-mix(in srgb, var(--color-accent) 70%, transparent)'
                        : 'color-mix(in srgb, var(--text-muted) 55%, transparent)',
                  }}
                />
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 10.5,
                    color: 'var(--text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.35,
                  }}
                >
                  {preview.text}
                </span>
              </>
            ) : (
              <span
                style={{
                  flex: 1,
                  fontSize: 10.5,
                  color: 'var(--text-dim)',
                  fontStyle: 'italic',
                  letterSpacing: 0.1,
                }}
              >
                {t('conversation.start')}
              </span>
            )}

            {!isEmpty && (
              <span
                aria-label={t('conversation.messagesCount', { count: msgCount })}
                style={{
                  flexShrink: 0,
                  fontSize: 9,
                  fontWeight: 600,
                  color: isActive ? 'var(--color-accent)' : 'var(--text-dim)',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: 0.3,
                  padding: '1px 5px',
                  borderRadius: 999,
                  background: isActive
                    ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)'
                    : 'color-mix(in srgb, var(--text-primary) 5%, transparent)',
                }}
              >
                {msgCount}
              </span>
            )}
          </div>
        </div>

        {/* Kebab menu — only reveals on hover/focus so rows stay clean */}
        <div style={{ position: 'relative', flexShrink: 0 }} ref={menuRef}>
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered || showMenu ? 1 : 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const menuHeight = 120;
              setMenuFlipped(rect.bottom + menuHeight > window.innerHeight);
              setShowMenu(!showMenu);
            }}
            aria-label={t('conversation.options')}
            style={{
              padding: 3,
              borderRadius: 4,
              color: 'var(--text-muted)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <MoreHorizontal size={13} />
          </motion.button>
          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                style={{
                  position: 'absolute',
                  right: 0,
                  ...(menuFlipped
                    ? { bottom: '100%', marginBottom: 4 }
                    : { top: '100%', marginTop: 4 }),
                  width: 140,
                  background: 'var(--bg-secondary)',
                  border: '0.5px solid var(--glass-border-subtle)',
                  borderRadius: 8,
                  boxShadow: 'var(--shadow-elevated)',
                  zIndex: 50,
                  padding: '4px 0',
                }}
              >
                <motion.button
                  whileHover={{ backgroundColor: 'var(--surface-hover)' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPin();
                    setShowMenu(false);
                    useToastStore.getState().showToast(
                      conversation.isPinned ? t('conversation.unpinned') : t('conversation.pinned'),
                      'info',
                    );
                  }}
                  style={menuButton}
                >
                  <Pin size={11} />
                  {conversation.isPinned ? t('conversation.unpin') : t('conversation.pin')}
                </motion.button>
                <motion.button
                  whileHover={{ backgroundColor: 'var(--surface-hover)' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsRenaming(true);
                    setShowMenu(false);
                  }}
                  style={menuButton}
                >
                  <PenLine size={11} />
                  {t('conversation.rename')}
                </motion.button>
                <motion.button
                  whileHover={{ backgroundColor: 'color-mix(in srgb, var(--error) 10%, transparent)' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirmingDelete) {
                      onDelete();
                      setShowMenu(false);
                      setConfirmingDelete(false);
                      clearTimeout(deleteTimerRef.current);
                      useToastStore.getState().showToast(t('conversation.deleted'), 'success');
                    } else {
                      setConfirmingDelete(true);
                      clearTimeout(deleteTimerRef.current);
                      deleteTimerRef.current = setTimeout(() => setConfirmingDelete(false), 3000);
                    }
                  }}
                  style={{
                    ...menuButton,
                    color: 'var(--error)',
                    background: confirmingDelete
                      ? 'color-mix(in srgb, var(--error) 10%, transparent)'
                      : 'transparent',
                    fontWeight: confirmingDelete ? 600 : 400,
                  }}
                >
                  <Trash2 size={11} />
                  {confirmingDelete ? t('conversation.confirmDelete') : t('conversation.delete')}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

const menuButton: React.CSSProperties = {
  width: '100%',
  textAlign: 'left',
  padding: '6px 12px',
  fontSize: 12,
  color: 'var(--text-secondary)',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

export default memo(ConversationItemInner, (prev, next) => {
  return (
    prev.conversation.id === next.conversation.id &&
    prev.conversation.title === next.conversation.title &&
    prev.conversation.isPinned === next.conversation.isPinned &&
    prev.conversation.updatedAt === next.conversation.updatedAt &&
    prev.conversation.messages.length === next.conversation.messages.length &&
    prev.isActive === next.isActive
  );
});
