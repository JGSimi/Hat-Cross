import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Settings, Trash2, HardDrive, Clipboard, PanelLeftClose } from 'lucide-react';
import { getVersion } from '@tauri-apps/api/app';
import { useTranslation } from 'react-i18next';
import ConversationItem from './ConversationItem';
import { useConversations } from '../../hooks/useConversations';
import { useConversationStore } from '../../stores/conversationStore';
import { useClipboardStore } from '../../stores/clipboardStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useToastStore } from '../../stores/toastStore';
import { usePlatform } from '../../hooks/usePlatform';
import { groupByDate, dateGroupLabel } from '../../utils/dateGroups';
import WindowControls from '../Shared/WindowControls';
import State from '../Shared/State';
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
  const clipboardCount = useClipboardStore((s) => s.entries.length);
  const { t, i18n } = useTranslation('chat');
  const { t: tEmpty } = useTranslation('empty');

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
  const recentGrouped = useMemo(() => groupByDate(recent, (c) => c.updatedAt), [recent]);
  const storageStats = useMemo(() => getStorageStats(), [conversations]);

  const handleClearAll = useCallback(() => {
    if (confirmClearAll) {
      clearAllConversations();
      setConfirmClearAll(false);
      useToastStore.getState().showToast(t('sidebar.clearedAll'), 'success');
    } else {
      setConfirmClearAll(true);
    }
  }, [confirmClearAll, clearAllConversations, t]);

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
        width: 220,
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
            title={t('sidebar.openClipboard')}
            aria-label={t('sidebar.openClipboard')}
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
            title={t('sidebar.newChat')}
            aria-label={t('sidebar.newChat')}
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
            title={t('sidebar.hideSidebar')}
            aria-label={t('sidebar.hideSidebar')}
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
            placeholder={t('sidebar.search')}
            aria-label={t('sidebar.searchAria')}
            style={{
              flex: 1, background: 'transparent', fontSize: 11,
              color: 'var(--text-primary)', border: 'none',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              aria-label={t('sidebar.clearSearch')}
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
            <SectionHeader label={t('sidebar.pinned')} count={pinned.length} />
            {pinned.map(renderConversation)}
          </>
        )}

        {recentGrouped.size > 0 && (
          Array.from(recentGrouped.entries()).map(([group, convs]) => (
            <div key={group}>
              <SectionHeader label={dateGroupLabel(group)} count={convs.length} />
              {convs.map(renderConversation)}
            </div>
          ))
        )}

        {filtered.length === 0 && (
          searchQuery ? (
            <State
              variant="empty"
              title={tEmpty('searchResultsEmpty.title', { query: searchQuery })}
              body={tEmpty('searchResultsEmpty.body')}
              action={{
                label: tEmpty('searchResultsEmpty.cta'),
                onClick: () => setSearchQuery(''),
              }}
            />
          ) : (
            <State
              variant="empty"
              title={tEmpty('conversationListEmpty.title')}
              body={tEmpty('conversationListEmpty.body')}
            />
          )
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
                <span>{t('sidebar.storageConversations')}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{storageStats.totalConversations}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                <span>{t('sidebar.storageMessages')}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{storageStats.totalMessages.toLocaleString(i18n.language)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                <span>{t('sidebar.storageSize')}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{formatStorageSize(storageStats.estimatedSizeKB)}</span>
              </div>
              <div style={{
                width: '100%', height: 3, background: 'rgba(255,255,255,0.06)',
                borderRadius: 2, overflow: 'hidden', marginTop: 2,
              }}>
                <div style={{
                  width: `${Math.min((storageStats.totalConversations / (useSettingsStore.getState().settings.chatLimits?.maxConversations ?? 50)) * 100, 100)}%`,
                  height: '100%',
                  background: storageStats.totalConversations > (useSettingsStore.getState().settings.chatLimits?.maxConversations ?? 50) * 0.8 ? 'var(--warning)' : 'var(--color-accent)',
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
                  {confirmClearAll ? t('sidebar.confirmClearAll') : t('sidebar.clearAll')}
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
            <span>{t('sidebar.settings')}</span>
          </button>
          <button
            onClick={() => setShowStorageInfo(!showStorageInfo)}
            title={t('sidebar.storageInfo')}
            aria-label={t('sidebar.storageInfo')}
            aria-expanded={showStorageInfo}
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
    <div
      style={{
        padding: '14px 14px 6px',
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
      }}
    >
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: 1.1,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        aria-hidden
        style={{
          flex: 1,
          height: 1,
          background:
            'linear-gradient(to right, color-mix(in srgb, var(--text-dim) 35%, transparent), transparent)',
          transform: 'translateY(-1px)',
        }}
      />
      <span
        style={{
          fontSize: 9,
          color: 'var(--text-dim)',
          fontWeight: 500,
          fontVariantNumeric: 'tabular-nums',
          flexShrink: 0,
        }}
      >
        {count}
      </span>
    </div>
  );
}
