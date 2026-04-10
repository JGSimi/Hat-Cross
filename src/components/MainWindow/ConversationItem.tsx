import { Pin, MoreHorizontal, Trash2, PenLine, MessageSquare } from 'lucide-react';
import { useState, useRef, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Conversation } from '../../types';
import { truncate, formatTimestamp } from '../../utils/markdown';
import { useToastStore } from '../../stores/toastStore';

interface Props {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onPin: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
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

  const msgCount = conversation.messages.length;
  const lastMessage = conversation.messages[conversation.messages.length - 1];
  const preview = lastMessage
    ? `${lastMessage.isUser ? 'Você' : 'IA'}: ${truncate(lastMessage.content.replace(/\n/g, ' '), 50)}`
    : '';

  const handleRename = () => {
    if (newTitle.trim()) {
      onRename(newTitle.trim());
    }
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

  useEffect(() => {
    return () => clearTimeout(deleteTimerRef.current);
  }, []);

  return (
    <motion.div
      onClick={onSelect}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={!isActive ? { backgroundColor: 'var(--surface-hover)' } : undefined}
      whileTap={{ scale: 0.98 }}
      style={{
        padding: '8px 12px',
        cursor: 'pointer',
        borderRadius: 8,
        margin: '0 6px 2px',
        background: isActive ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)' : 'transparent',
        borderLeft: isActive
          ? '2px solid var(--color-accent)'
          : '2px solid transparent',
        transition: 'background 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
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
                fontSize: 12,
                color: 'var(--text-primary)',
                borderRadius: 4,
                padding: '2px 6px',
                outline: undefined,
                border: '0.5px solid var(--border-focused)',
              }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {conversation.isPinned && (
                <Pin size={10} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
              )}
              <p
                style={{
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 400,
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  margin: 0,
                }}
              >
                {conversation.title}
              </p>
            </div>
          )}
          {preview && (
            <p
              style={{
                fontSize: 10.5,
                color: 'var(--text-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginTop: 3,
              }}
            >
              {preview}
            </p>
          )}
          {/* Bottom row: timestamp + message count */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 4,
          }}>
            <span style={{ fontSize: 9.5, color: 'var(--text-dim)' }}>
              {formatTimestamp(conversation.updatedAt)}
            </span>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 9.5,
              color: 'var(--text-dim)',
            }}>
              <MessageSquare size={8} />
              <span>{msgCount}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <div style={{ position: 'relative' }} ref={menuRef}>
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: isHovered || showMenu ? 1 : 0 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => {
                e.stopPropagation();
                // Detect if menu would overflow bottom of window
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const menuHeight = 120; // approx 3 items * 34px + padding
                setMenuFlipped(rect.bottom + menuHeight > window.innerHeight);
                setShowMenu(!showMenu);
              }}
              aria-label="Opções da conversa"
              style={{
                padding: 4,
                borderRadius: 4,
                color: 'var(--text-muted)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <MoreHorizontal size={14} />
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
                        conversation.isPinned ? 'Conversa desafixada' : 'Conversa fixada',
                        'info'
                      );
                    }}
                    style={{
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
                    }}
                  >
                    <Pin size={11} />
                    {conversation.isPinned ? 'Desafixar' : 'Fixar'}
                  </motion.button>
                  <motion.button
                    whileHover={{ backgroundColor: 'var(--surface-hover)' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsRenaming(true);
                      setShowMenu(false);
                    }}
                    style={{
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
                    }}
                  >
                    <PenLine size={11} />
                    Renomear
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
                        useToastStore.getState().showToast('Conversa excluída', 'success');
                      } else {
                        setConfirmingDelete(true);
                        clearTimeout(deleteTimerRef.current);
                        deleteTimerRef.current = setTimeout(() => setConfirmingDelete(false), 3000);
                      }
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 12px',
                      fontSize: 12,
                      color: 'var(--error)',
                      background: confirmingDelete ? 'color-mix(in srgb, var(--error) 10%, transparent)' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontWeight: confirmingDelete ? 600 : 400,
                    }}
                  >
                    <Trash2 size={11} />
                    {confirmingDelete ? 'Tem certeza?' : 'Excluir'}
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default memo(ConversationItemInner, (prev, next) => {
  return prev.conversation.id === next.conversation.id &&
    prev.conversation.title === next.conversation.title &&
    prev.conversation.isPinned === next.conversation.isPinned &&
    prev.conversation.updatedAt === next.conversation.updatedAt &&
    prev.conversation.messages.length === next.conversation.messages.length &&
    prev.isActive === next.isActive;
});
