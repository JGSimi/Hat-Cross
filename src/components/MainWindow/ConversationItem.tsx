import { Pin, MoreHorizontal, Trash2, PenLine } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Conversation } from '../../types';
import { truncate, formatTimestamp } from '../../utils/markdown';

interface Props {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onPin: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}

export default function ConversationItem({
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
  const menuRef = useRef<HTMLDivElement>(null);

  const lastMessage = conversation.messages[conversation.messages.length - 1];
  const preview = lastMessage ? truncate(lastMessage.content, 60) : '';

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
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);

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
        borderRadius: 6,
        margin: '0 6px 2px',
        background: isActive ? 'rgba(var(--color-accent), 0.12)' : 'transparent',
        border: isActive
          ? '0.5px solid color-mix(in srgb, var(--color-accent) 25%, transparent)'
          : '0.5px solid transparent',
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
                outline: 'none',
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
                fontSize: 11,
                color: 'var(--text-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginTop: 4,
              }}
            >
              {preview}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.8 }}>
            {formatTimestamp(conversation.updatedAt)}
          </span>
          <div style={{ position: 'relative' }} ref={menuRef}>
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: isHovered || showMenu ? 1 : 0 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
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
                    top: '100%',
                    marginTop: 4,
                    width: 140,
                    background: 'var(--bg-secondary)',
                    border: '0.5px solid var(--glass-border-subtle)',
                    borderRadius: 8,
                    boxShadow: 'var(--shadow-elevated)',
                    zIndex: 50,
                    padding: '4px 0',
                    backdropFilter: 'blur(20px)',
                  }}
                >
                  <motion.button
                    whileHover={{ backgroundColor: 'var(--surface-hover)' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPin();
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
                      onDelete();
                      setShowMenu(false);
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 12px',
                      fontSize: 12,
                      color: 'var(--error)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Trash2 size={11} />
                    Excluir
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
