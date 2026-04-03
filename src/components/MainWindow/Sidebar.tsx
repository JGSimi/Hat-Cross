import { useState } from 'react';
import { Plus, Search, Settings } from 'lucide-react';
import ConversationItem from './ConversationItem';
import { useConversations } from '../../hooks/useConversations';

interface Props {
  onOpenSettings: () => void;
}

export default function Sidebar({ onOpenSettings }: Props) {
  const {
    conversations,
    activeConversationId,
    createConversation,
    deleteConversation,
    pinConversation,
    renameConversation,
    setActiveConversation,
  } = useConversations();
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = searchQuery
    ? conversations.filter(
        (c) =>
          c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.messages.some((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : conversations;

  const pinned = filtered.filter((c) => c.isPinned);
  const recent = filtered.filter((c) => !c.isPinned);

  return (
    <div className="w-60 h-full flex flex-col bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-[var(--color-border)]">
        <span className="text-sm font-semibold text-[var(--color-text-primary)]">Hat</span>
        <button
          onClick={() => createConversation()}
          className="p-1.5 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
          title="Nova conversa"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Search */}
      <div className="px-2 py-2">
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-[var(--color-bg-input)] rounded-lg border border-[var(--color-border)]">
          <Search size={14} className="text-[var(--color-text-muted)] flex-shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar..."
            className="flex-1 bg-transparent text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none"
          />
        </div>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto">
        {pinned.length > 0 && (
          <>
            <p className="px-4 py-1.5 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
              Fixadas
            </p>
            {pinned.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeConversationId}
                onSelect={() => setActiveConversation(conv.id)}
                onPin={() => pinConversation(conv.id)}
                onDelete={() => deleteConversation(conv.id)}
                onRename={(title) => renameConversation(conv.id, title)}
              />
            ))}
          </>
        )}

        {recent.length > 0 && (
          <>
            <p className="px-4 py-1.5 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
              Recentes
            </p>
            {recent.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeConversationId}
                onSelect={() => setActiveConversation(conv.id)}
                onPin={() => pinConversation(conv.id)}
                onDelete={() => deleteConversation(conv.id)}
                onRename={(title) => renameConversation(conv.id, title)}
              />
            ))}
          </>
        )}

        {filtered.length === 0 && (
          <p className="px-4 py-8 text-xs text-[var(--color-text-muted)] text-center">
            Nenhuma conversa
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--color-border)] px-3 py-2">
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
        >
          <Settings size={14} />
          <span className="text-xs">Configurações</span>
        </button>
      </div>
    </div>
  );
}
