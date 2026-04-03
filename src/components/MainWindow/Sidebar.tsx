import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
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

  const filtered = useMemo(() => {
    if (!searchQuery) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  }, [searchQuery, conversations]);

  const pinned = filtered.filter((c) => c.isPinned);
  const recent = filtered.filter((c) => !c.isPinned);

  return (
    <div
      style={{
        width: 220,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-secondary)',
        borderRight: '0.5px solid var(--border-subtle)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px',
          borderBottom: '0.5px solid var(--border-subtle)',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          Hat
        </span>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => createConversation()}
          title="Nova conversa"
          style={{
            padding: 6,
            borderRadius: 8,
            background: 'var(--glass-secondary)',
            border: '0.5px solid var(--glass-border-subtle)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Plus size={14} />
        </motion.button>
      </div>

      {/* Search */}
      <div style={{ padding: '8px 12px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            background: 'var(--glass-secondary)',
            borderRadius: 6,
            border: '0.5px solid var(--glass-border-subtle)',
          }}
        >
          <Search size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar..."
            style={{
              flex: 1,
              background: 'transparent',
              fontSize: 11,
              color: 'var(--text-primary)',
              outline: 'none',
              border: 'none',
            }}
          />
        </div>
      </div>

      {/* Conversations */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {pinned.length > 0 && (
          <>
            <p
              style={{
                padding: '6px 14px',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: 0.3,
              }}
            >
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
            <p
              style={{
                padding: '6px 14px',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: 0.3,
              }}
            >
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
          <p
            style={{
              padding: '32px 14px',
              fontSize: 11,
              color: 'var(--text-muted)',
              textAlign: 'center',
            }}
          >
            Nenhuma conversa
          </p>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: '0.5px solid var(--border-subtle)',
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <motion.button
          whileHover={{ scale: 1.05, backgroundColor: 'var(--surface-hover)' }}
          whileTap={{ scale: 0.97 }}
          onClick={onOpenSettings}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '6px 8px',
            borderRadius: 8,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          <Settings size={12} />
          <span>Configurações</span>
        </motion.button>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
          v2
        </span>
      </div>
    </div>
  );
}
