import { Pin, MoreHorizontal, Trash2, PenLine } from 'lucide-react';
import { useState } from 'react';
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

  const lastMessage = conversation.messages[conversation.messages.length - 1];
  const preview = lastMessage ? truncate(lastMessage.content, 60) : '';

  const handleRename = () => {
    if (newTitle.trim()) {
      onRename(newTitle.trim());
    }
    setIsRenaming(false);
  };

  return (
    <div
      onClick={onSelect}
      className={`group px-3 py-2.5 cursor-pointer rounded-lg mx-1.5 mb-0.5 transition-colors ${
        isActive
          ? 'bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/30'
          : 'hover:bg-[var(--color-bg-tertiary)] border border-transparent'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {isRenaming ? (
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-[var(--color-bg-input)] text-sm text-[var(--color-text-primary)] rounded px-1.5 py-0.5 outline-none border border-[var(--color-border-focus)]"
            />
          ) : (
            <div className="flex items-center gap-1.5">
              {conversation.isPinned && <Pin size={10} className="text-[var(--color-accent)] flex-shrink-0" />}
              <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                {conversation.title}
              </p>
            </div>
          )}
          {preview && (
            <p className="text-xs text-[var(--color-text-muted)] truncate mt-0.5">{preview}</p>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {formatTimestamp(conversation.updatedAt)}
          </span>
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1 rounded opacity-0 group-hover:opacity-100 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-all"
            >
              <MoreHorizontal size={14} />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl z-50 py-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPin();
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-2"
                >
                  <Pin size={12} />
                  {conversation.isPinned ? 'Desafixar' : 'Fixar'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsRenaming(true);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-2"
                >
                  <PenLine size={12} />
                  Renomear
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                >
                  <Trash2 size={12} />
                  Excluir
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
