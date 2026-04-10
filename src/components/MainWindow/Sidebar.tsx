import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Settings, Trash2, HardDrive, Clipboard, PanelLeftClose } from 'lucide-react';
import { getVersion } from '@tauri-apps/api/app';
import ConversationItem from './ConversationItem';
import { useConversations } from '../../hooks/useConversations';
import { useConversationStore } from '../../stores/conversationStore';
import { useClipboardStore } from '../../stores/clipboardStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { usePlatform } from '../../hooks/usePlatform';
import WindowControls from '../Shared/WindowControls';
import type { Conversation } from '../../types';

export type SidebarView = 'chats' | 'clipboard';

interface Props {
  onOpenSettings: () => void;
  activeView: SidebarView;
  onViewChange: (view: SidebarView) => void;
  onSelectConversation: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

// --- Date grouping helpers ---

function getDateGroup(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);
  const monthAgo = new Date(today.getTime() - 30 * 86400000);

  if (date >= today) return 'Hoje';
  if (date >= yesterday) return 'Ontem';
  if (date >= weekAgo) return 'Esta semana';
  if (date >= monthAgo) return 'Este mês';
  return 'Mais antigas';
}

const GROUP_ORDER = ['Hoje', 'Ontem', 'Esta semana', 'Este mês', 'Mais antigas'];

function groupConversations(conversations: Conversation[]): Map<string, Conversation[]> {
  const groups = new Map<string, Conversation[]>();
  for (const conv of conversations) {
    const group = getDateGroup(conv.updatedAt);
    const existing = groups.get(group) || [];
    existing.push(conv);
    groups.set(group, existing);
  }
  const sorted = new Map<string, Conversation[]>();
  for (const key of GROUP_ORDER) {
    if (groups.has(key)) sorted.set(key, groups.get(key)!);
  }
  return sorted;
}

function formatStorageSize(kb: number): string {
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export default function Sidebar({
  onOpenSettings, activeView, onViewChange, onSelectConversation, collapsed: _, onToggleCollapse,
}: Props) {
  const {
    conversations, activeConversationId, createConversation,
    deleteConversation, pinConversation, renameConversation,
  } = useConversations();
  const clearAllConversations = useConversationStore((s) => s.clearAllConversations);
  const getStorageStats = useConversationStore((s) => s.getStorageStats);
  const [searchQuery, setSearchQuery] = useState('');
  const [appVersion, setAppVersion] = useState('');
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [showStorageInfo, setShowStorageInfo] = useState(false);
  const platform = usePlatform();
  const sidebarWidth = useSettingsStore((s) => s.settings.appearance?.sidebarWidth ?? 220);
  const clipboardCount = useClipboardStore((s) => s.entries.length);

  useEffect(() => { getVersion().then(setAppVersion).catch(() => {}); }, []);

  useEffect(() => {
    if (!confirmClearAll) return;
    const t = setTimeout(() => setConfirmClearAll(false), 3000);
    return () => clearTimeout(t);
  }, [confirmClearAll]);

  const filtered = useMemo(() => {
    if (!searchQuery) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(
      (c) => c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  }, [searchQuery, conversations]);

  const pinned = useMemo(() => filtered.filter((c) => c.isPinned), [filtered]);
  const recent = useMemo(() => filtered.filter((c) => !c.isPinned), [filtered]);
  const recentGrouped = useMemo(() => groupConversations(recent), [recent]);
  const storageStats = useMemo(() => getStorageStats(), [conversations]);

  const handleClearAll = useCallback(() => {
    if (confirmClearAll) { clearAllConversations(); setConfirmClearAll(false); }
    else setConfirmClearAll(true);
  }, [confirmClearAll, clearAllConversations]);

  const renderConversation = (conv: Conversation) => (
    <ConversationItem
      key={conv.id}
      conversation={conv}
      isActive={conv.id === activeConversationId}
      onSelect={() => onSelectConversation(conv.id)}
      onPin={() => pinConversation(conv.id)}
      onDelete={() => deleteConversation(conv.id)}
      onRename={(title) => renameConversation(conv.id, title)}
    />
  );

  return (
    <div
      style={{
        width: sidebarWidth,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'color-mix(in srgb, var(--bg-secondary) 85%, transparent)',
        backdropFilter: 'blur(30px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(30px) saturate(1.5)',
        borderRight: '0.5px solid var(--border-subtle)',
        position: 'relative',
        zIndex: 1,
      }}
    >
      {/* Header */}
      <div
        data-tauri-drag-region
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: platform === 'macos' ? '10px 12px' : '12px',
          paddingTop: platform === 'macos' ? 10 : 12,
          borderBottom: '0.5px solid var(--border-subtle)',
          gap: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {platform === 'macos' && <WindowControls variant="sidebar" />}
          <span style={{
            fontSize: 14, fontWeight: 700, letterSpacing: -0.5,
            background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-hover))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Hat
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Clipboard shortcut button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onViewChange('clipboard')}
            title="Clipboard"
            style={{
              padding: 5, borderRadius: 6,
              background: clipboardCount > 0 ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)' : 'transparent',
              border: 'none',
              color: activeView === 'clipboard' ? 'var(--color-accent)' : 'var(--text-muted)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}
          >
            <Clipboard size={13} />
            {clipboardCount > 0 && (
              <span style={{
                position: 'absolute', top: -2, right: -2,
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--color-accent)',
                border: '1.5px solid var(--bg-secondary)',
              }} />
            )}
          </motion.button>
          {/* New conversation */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => createConversation()}
            title="Nova conversa"
            style={{
              padding: 5, borderRadius: 6,
              background: 'var(--glass-secondary)',
              border: '0.5px solid var(--glass-border-subtle)',
              color: 'var(--text-secondary)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Plus size={13} />
          </motion.button>
          {/* Collapse sidebar */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={onToggleCollapse}
            title="Ocultar sidebar"
            style={{
              padding: 5, borderRadius: 6,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <PanelLeftClose size={13} />
          </motion.button>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '8px 12px' }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
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
              flex: 1, background: 'transparent', fontSize: 11,
              color: 'var(--text-primary)', outline: 'none', border: 'none',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 0, display: 'flex',
                alignItems: 'center', fontSize: 12, lineHeight: 1,
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Conversations list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {pinned.length > 0 && (
          <>
            <SectionHeader label="Fixadas" count={pinned.length} />
            {pinned.map(renderConversation)}
          </>
        )}

        {recentGrouped.size > 0 && (
          Array.from(recentGrouped.entries()).map(([group, convs]) => (
            <div key={group}>
              <SectionHeader label={group} count={convs.length} />
              {convs.map(renderConversation)}
            </div>
          ))
        )}

        {filtered.length === 0 && (
          <p style={{
            padding: '32px 14px', fontSize: 11,
            color: 'var(--text-muted)', textAlign: 'center',
          }}>
            {searchQuery ? `Nenhum resultado para "${searchQuery}"` : 'Nenhuma conversa'}
          </p>
        )}
      </div>

      {/* Storage info */}
      <AnimatePresence>
        {showStorageInfo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            style={{ overflow: 'hidden', borderTop: '0.5px solid var(--border-subtle)' }}
          >
            <div style={{
              padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4,
              background: 'color-mix(in srgb, var(--color-accent) 3%, transparent)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                <span>Conversas</span>
                <span style={{ color: 'var(--text-secondary)' }}>{storageStats.totalConversations}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                <span>Mensagens</span>
                <span style={{ color: 'var(--text-secondary)' }}>{storageStats.totalMessages.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                <span>Armazenamento</span>
                <span style={{ color: 'var(--text-secondary)' }}>{formatStorageSize(storageStats.estimatedSizeKB)}</span>
              </div>
              <div style={{
                width: '100%', height: 3, background: 'rgba(255,255,255,0.06)',
                borderRadius: 2, overflow: 'hidden', marginTop: 2,
              }}>
                <div style={{
                  width: `${Math.min((storageStats.totalConversations / 50) * 100, 100)}%`,
                  height: '100%',
                  background: storageStats.totalConversations > 40 ? 'var(--warning)' : 'var(--color-accent)',
                  borderRadius: 2, transition: 'width 0.3s ease',
                }} />
              </div>
              {conversations.length > 0 && (
                <button
                  onClick={handleClearAll}
                  style={{
                    marginTop: 4, padding: '4px 8px', borderRadius: 4,
                    fontSize: 10, fontWeight: confirmClearAll ? 600 : 400,
                    background: confirmClearAll ? 'color-mix(in srgb, var(--error) 15%, transparent)' : 'rgba(255,255,255,0.04)',
                    color: confirmClearAll ? 'var(--error)' : 'var(--text-muted)',
                    border: confirmClearAll ? '1px solid color-mix(in srgb, var(--error) 25%, transparent)' : '1px solid rgba(255,255,255,0.06)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  }}
                >
                  <Trash2 size={9} />
                  {confirmClearAll ? 'Tem certeza? Clique novamente' : 'Limpar todas as conversas'}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div
        style={{
          borderTop: '0.5px solid var(--border-subtle)',
          padding: '10px 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(to top, color-mix(in srgb, var(--color-accent) 3%, transparent), transparent 40%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
          <button
            onClick={onOpenSettings}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, flex: 1,
              padding: '6px 8px', borderRadius: 8,
              background: 'transparent', border: 'none',
              color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11,
            }}
          >
            <Settings size={12} />
            <span>Configurações</span>
          </button>
          <button
            onClick={() => setShowStorageInfo(!showStorageInfo)}
            title="Info de armazenamento"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: showStorageInfo ? 'var(--color-accent)' : 'var(--text-muted)',
              padding: 4, display: 'flex', alignItems: 'center', borderRadius: 4,
            }}
          >
            <HardDrive size={11} />
          </button>
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
          {appVersion ? `v${appVersion}` : ''}
        </span>
      </div>
    </div>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div style={{
      padding: '8px 14px 4px', display: 'flex',
      alignItems: 'center', justifyContent: 'space-between',
    }}>
      <p style={{
        fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: 0.8, margin: 0,
      }}>
        {label}
      </p>
      <span style={{
        fontSize: 9, color: 'var(--text-dim)',
        background: 'rgba(255,255,255,0.04)',
        padding: '1px 5px', borderRadius: 4, fontWeight: 500,
      }}>
        {count}
      </span>
    </div>
  );
}
