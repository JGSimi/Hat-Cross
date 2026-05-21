import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Loader2, Sparkles } from 'lucide-react';
import { useClipboardStore } from '../../stores/clipboardStore';
import { useToastStore } from '../../stores/toastStore';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { groupByDate, type DateGroup } from '../../utils/dateGroups';
import { matchesSearch } from '../../utils/clipboardSearch';
import type { ClipboardEntry } from '../../types';
import ClipboardToolbar, { type SortMode } from './ClipboardToolbar';
import ClipboardCard from './ClipboardCard';
import ClipboardGroup from './ClipboardGroup';
import ClipboardContextMenu from './ClipboardContextMenu';
import { ClipboardZeroState, ClipboardNoResultsState } from './ClipboardEmptyState';

interface Props {
  onBack?: () => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  entryId: string;
}

const PINNED_GROUP_KEY = 'Fixados';
const FLAT_GROUP_KEY = 'Todos';

export default function ClipboardHistory({ onBack }: Props) {
  const { t } = useTranslation('clipboard');
  const entries = useClipboardStore((s) => s.entries);
  const isProcessing = useClipboardStore((s) => s.isProcessing);
  const deleteEntry = useClipboardStore((s) => s.deleteEntry);
  const togglePin = useClipboardStore((s) => s.togglePin);
  const clearAll = useClipboardStore((s) => s.clearAll);
  const showToast = useToastStore((s) => s.showToast);
  const reduceMotion = useReducedMotion();

  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Debounce search input -> query (150ms)
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput), 150);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset confirm states after timeout
  useEffect(() => {
    if (!confirmDeleteId) return;
    const t = setTimeout(() => setConfirmDeleteId(null), 2500);
    return () => clearTimeout(t);
  }, [confirmDeleteId]);

  useEffect(() => {
    if (!confirmClear) return;
    const t = setTimeout(() => setConfirmClear(false), 3000);
    return () => clearTimeout(t);
  }, [confirmClear]);

  // ---- Derived data ----

  const filtered = useMemo(() => {
    if (!searchQuery) return entries;
    return entries.filter(
      (e) => matchesSearch(e.originalText, searchQuery) || matchesSearch(e.response, searchQuery),
    );
  }, [entries, searchQuery]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    if (sortMode === 'oldest') {
      copy.sort((a, b) => a.timestamp - b.timestamp);
    } else if (sortMode === 'alphabetical') {
      copy.sort((a, b) => a.originalText.localeCompare(b.originalText, 'pt-BR'));
    } else {
      copy.sort((a, b) => b.timestamp - a.timestamp);
    }
    return copy;
  }, [filtered, sortMode]);

  const pinnedEntries = useMemo(() => sorted.filter((e) => e.isPinned), [sorted]);
  const unpinnedEntries = useMemo(() => sorted.filter((e) => !e.isPinned), [sorted]);

  const dateGroups = useMemo(() => {
    if (sortMode !== 'recent') {
      return new Map<DateGroup | typeof FLAT_GROUP_KEY, ClipboardEntry[]>([
        [FLAT_GROUP_KEY, unpinnedEntries],
      ]);
    }
    return groupByDate(unpinnedEntries, (e) => e.timestamp);
  }, [unpinnedEntries, sortMode]);

  // Flat display order for keyboard nav (pinned first, then groups)
  const flatDisplayOrder = useMemo(() => {
    const list: ClipboardEntry[] = [];
    if (pinnedEntries.length > 0) list.push(...pinnedEntries);
    for (const items of dateGroups.values()) list.push(...items);
    return list;
  }, [pinnedEntries, dateGroups]);

  // Clamp focusedIndex when list size changes
  useEffect(() => {
    if (flatDisplayOrder.length === 0) {
      if (focusedIndex !== 0) setFocusedIndex(0);
      return;
    }
    if (focusedIndex >= flatDisplayOrder.length) {
      setFocusedIndex(flatDisplayOrder.length - 1);
    }
  }, [flatDisplayOrder, focusedIndex]);

  // ---- Handlers ----

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleCopyResponse = useCallback(
    (entry: ClipboardEntry) => {
      navigator.clipboard.writeText(entry.response).catch(() => {});
      showToast(t('toasts.responseCopied'), 'success');
    },
    [showToast],
  );

  const handleCopyOriginal = useCallback(
    (entry: ClipboardEntry) => {
      const text = entry.originalText && entry.originalText !== '(imagem)' ? entry.originalText : '';
      if (!text) {
        showToast(t('toasts.nothingToCopy'), 'info');
        return;
      }
      navigator.clipboard.writeText(text).catch(() => {});
      showToast(t('toasts.originalCopied'), 'success');
    },
    [showToast],
  );

  const handleCopyBoth = useCallback(
    (entry: ClipboardEntry) => {
      const orig = entry.originalText && entry.originalText !== '(imagem)' ? entry.originalText : '';
      const combined = orig ? `${orig}\n\n---\n\n${entry.response}` : entry.response;
      navigator.clipboard.writeText(combined).catch(() => {});
      showToast(t('toasts.originalAndResponseCopied'), 'success');
    },
    [showToast],
  );

  const handleTogglePin = useCallback(
    (entry: ClipboardEntry) => {
      togglePin(entry.id);
      showToast(entry.isPinned ? t('toasts.unpinned') : t('toasts.pinned'), 'info');
    },
    [togglePin, showToast],
  );

  const requestDelete = useCallback(
    (entry: ClipboardEntry) => {
      if (confirmDeleteId === entry.id) {
        deleteEntry(entry.id);
        setConfirmDeleteId(null);
        showToast(t('toasts.removed'), 'success');
        setExpandedIds((prev) => {
          const next = new Set(prev);
          next.delete(entry.id);
          return next;
        });
      } else {
        setConfirmDeleteId(entry.id);
      }
    },
    [confirmDeleteId, deleteEntry, showToast],
  );

  const handleClearAll = useCallback(() => {
    if (confirmClear) {
      clearAll();
      setConfirmClear(false);
      setExpandedIds(new Set());
      setConfirmDeleteId(null);
      showToast(t('toasts.historyCleared'), 'success');
    } else {
      setConfirmClear(true);
    }
  }, [confirmClear, clearAll, showToast]);

  const handleContextMenu = useCallback((entry: ClipboardEntry, x: number, y: number) => {
    setContextMenu({ x, y, entryId: entry.id });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  // ---- Keyboard shortcuts ----

  const focusedEntry = flatDisplayOrder[focusedIndex];

  useKeyboardShortcuts({
    ArrowDown: (e) => {
      if (flatDisplayOrder.length === 0) return;
      e.preventDefault();
      setFocusedIndex((i) => Math.min(flatDisplayOrder.length - 1, i + 1));
    },
    j: (e) => {
      if (flatDisplayOrder.length === 0) return;
      e.preventDefault();
      setFocusedIndex((i) => Math.min(flatDisplayOrder.length - 1, i + 1));
    },
    ArrowUp: (e) => {
      if (flatDisplayOrder.length === 0) return;
      e.preventDefault();
      setFocusedIndex((i) => Math.max(0, i - 1));
    },
    k: (e) => {
      if (flatDisplayOrder.length === 0) return;
      e.preventDefault();
      setFocusedIndex((i) => Math.max(0, i - 1));
    },
    Home: (e) => {
      if (flatDisplayOrder.length === 0) return;
      e.preventDefault();
      setFocusedIndex(0);
    },
    End: (e) => {
      if (flatDisplayOrder.length === 0) return;
      e.preventDefault();
      setFocusedIndex(flatDisplayOrder.length - 1);
    },
    Enter: (e) => {
      if (!focusedEntry) return;
      e.preventDefault();
      toggleExpand(focusedEntry.id);
    },
    space: (e) => {
      if (!focusedEntry) return;
      e.preventDefault();
      toggleExpand(focusedEntry.id);
    },
    'mod+c': (e) => {
      if (!focusedEntry) return;
      const selection = window.getSelection?.()?.toString();
      if (selection && selection.length > 0) return; // let browser copy selection
      e.preventDefault();
      handleCopyResponse(focusedEntry);
    },
    'shift+c': (e) => {
      if (!focusedEntry) return;
      e.preventDefault();
      handleCopyOriginal(focusedEntry);
    },
    Delete: (e) => {
      if (!focusedEntry) return;
      e.preventDefault();
      requestDelete(focusedEntry);
    },
    Backspace: (e) => {
      if (!focusedEntry) return;
      e.preventDefault();
      requestDelete(focusedEntry);
    },
    p: (e) => {
      if (!focusedEntry) return;
      e.preventDefault();
      handleTogglePin(focusedEntry);
    },
    'mod+f': (e) => {
      e.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    },
    'mod+shift+d': (e) => {
      e.preventDefault();
      handleClearAll();
    },
    Escape: (e) => {
      if (contextMenu) {
        e.preventDefault();
        closeContextMenu();
        return;
      }
      if (focusedEntry && expandedIds.has(focusedEntry.id)) {
        e.preventDefault();
        toggleExpand(focusedEntry.id);
        return;
      }
      if (document.activeElement === searchInputRef.current) {
        if (searchInput) {
          e.preventDefault();
          setSearchInput('');
        } else {
          searchInputRef.current?.blur();
        }
        return;
      }
      if (searchInput) {
        e.preventDefault();
        setSearchInput('');
      }
    },
  });

  // ---- Render ----

  const contextMenuEntry = contextMenu
    ? flatDisplayOrder.find((e) => e.id === contextMenu.entryId) ??
      entries.find((e) => e.id === contextMenu.entryId) ??
      null
    : null;

  const showZeroState = entries.length === 0 && !isProcessing;
  const showNoResults = entries.length > 0 && filtered.length === 0 && searchQuery.length > 0;

  if (showZeroState) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <ClipboardToolbar
          onBack={onBack}
          totalCount={0}
          filteredCount={0}
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          searchInputRef={searchInputRef}
          sortMode={sortMode}
          onSortChange={setSortMode}
          hasEntries={false}
          onClearAll={handleClearAll}
          confirmClear={confirmClear}
        />
        <ClipboardZeroState onSuggestionClick={onBack} />
      </div>
    );
  }

  let globalIndex = 0;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <ClipboardToolbar
        onBack={onBack}
        totalCount={entries.length}
        filteredCount={filtered.length}
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchInputRef={searchInputRef}
        sortMode={sortMode}
        onSortChange={setSortMode}
        hasEntries={entries.length > 0}
        onClearAll={handleClearAll}
        confirmClear={confirmClear}
      />

      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 14px 18px',
          display: 'flex',
          flexDirection: 'column',
          maskImage:
            'linear-gradient(to bottom, transparent 0, black 14px, black calc(100% - 16px), transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent 0, black 14px, black calc(100% - 16px), transparent 100%)',
        }}
      >
        <AnimatePresence initial={false}>
          {isProcessing && <ProcessingSkeleton key="processing-skeleton" reduceMotion={!!reduceMotion} />}
        </AnimatePresence>

        {showNoResults ? (
          <ClipboardNoResultsState query={searchQuery} onClearSearch={() => setSearchInput('')} />
        ) : (
          <>
            {pinnedEntries.length > 0 && (
              <ClipboardGroup
                label={PINNED_GROUP_KEY}
                count={pinnedEntries.length}
                isPinnedGroup
              >
                <AnimatePresence initial={false}>
                  {pinnedEntries.map((entry) => {
                    const index = globalIndex++;
                    return (
                      <ClipboardCard
                        key={entry.id}
                        entry={entry}
                        index={index}
                        isFocused={focusedIndex === index}
                        isExpanded={expandedIds.has(entry.id)}
                        confirmDelete={confirmDeleteId === entry.id}
                        searchQuery={searchQuery}
                        onToggleExpand={() => {
                          setFocusedIndex(index);
                          toggleExpand(entry.id);
                        }}
                        onCopyResponse={() => handleCopyResponse(entry)}
                        onCopyOriginal={() => handleCopyOriginal(entry)}
                        onTogglePin={() => handleTogglePin(entry)}
                        onRequestDelete={() => requestDelete(entry)}
                        onContextMenu={(x, y) => {
                          setFocusedIndex(index);
                          handleContextMenu(entry, x, y);
                        }}
                        onFocus={() => setFocusedIndex(index)}
                      />
                    );
                  })}
                </AnimatePresence>
              </ClipboardGroup>
            )}

            {Array.from(dateGroups.entries()).map(([groupKey, items]) => {
              if (items.length === 0) return null;
              if (sortMode !== 'recent') {
                return (
                  <AnimatePresence key="flat-list" initial={false}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 10 }}>
                      {items.map((entry) => {
                        const index = globalIndex++;
                        return (
                          <ClipboardCard
                            key={entry.id}
                            entry={entry}
                            index={index}
                            isFocused={focusedIndex === index}
                            isExpanded={expandedIds.has(entry.id)}
                            confirmDelete={confirmDeleteId === entry.id}
                            searchQuery={searchQuery}
                            onToggleExpand={() => {
                              setFocusedIndex(index);
                              toggleExpand(entry.id);
                            }}
                            onCopyResponse={() => handleCopyResponse(entry)}
                            onCopyOriginal={() => handleCopyOriginal(entry)}
                            onTogglePin={() => handleTogglePin(entry)}
                            onRequestDelete={() => requestDelete(entry)}
                            onContextMenu={(x, y) => {
                              setFocusedIndex(index);
                              handleContextMenu(entry, x, y);
                            }}
                            onFocus={() => setFocusedIndex(index)}
                          />
                        );
                      })}
                    </div>
                  </AnimatePresence>
                );
              }
              return (
                <ClipboardGroup
                  key={groupKey as string}
                  label={groupKey as string}
                  count={items.length}
                >
                  <AnimatePresence initial={false}>
                    {items.map((entry) => {
                      const index = globalIndex++;
                      return (
                        <ClipboardCard
                          key={entry.id}
                          entry={entry}
                          index={index}
                          isFocused={focusedIndex === index}
                          isExpanded={expandedIds.has(entry.id)}
                          confirmDelete={confirmDeleteId === entry.id}
                          searchQuery={searchQuery}
                          onToggleExpand={() => {
                            setFocusedIndex(index);
                            toggleExpand(entry.id);
                          }}
                          onCopyResponse={() => handleCopyResponse(entry)}
                          onCopyOriginal={() => handleCopyOriginal(entry)}
                          onTogglePin={() => handleTogglePin(entry)}
                          onRequestDelete={() => requestDelete(entry)}
                          onContextMenu={(x, y) => {
                            setFocusedIndex(index);
                            handleContextMenu(entry, x, y);
                          }}
                          onFocus={() => setFocusedIndex(index)}
                        />
                      );
                    })}
                  </AnimatePresence>
                </ClipboardGroup>
              );
            })}
          </>
        )}
      </div>

      <AnimatePresence>
        {contextMenu && contextMenuEntry && (
          <ClipboardContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            isPinned={!!contextMenuEntry.isPinned}
            onClose={closeContextMenu}
            onCopyResponse={() => handleCopyResponse(contextMenuEntry)}
            onCopyOriginal={() => handleCopyOriginal(contextMenuEntry)}
            onCopyBoth={() => handleCopyBoth(contextMenuEntry)}
            onTogglePin={() => handleTogglePin(contextMenuEntry)}
            onDelete={() => {
              // Skip confirm for context-menu delete to feel snappy
              deleteEntry(contextMenuEntry.id);
              showToast(t('toasts.removed'), 'success');
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ProcessingSkeleton({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        margin: '14px 0 10px',
        borderRadius: 14,
        background:
          'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 8%, transparent), color-mix(in srgb, var(--color-accent) 3%, transparent))',
        border: '0.5px solid color-mix(in srgb, var(--color-accent) 22%, transparent)',
        boxShadow: '0 2px 14px color-mix(in srgb, var(--color-accent) 14%, transparent)',
      }}
      role="status"
      aria-live="polite"
    >
      {reduceMotion ? (
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            width: 18,
            height: 18,
            borderRadius: 6,
            background: 'color-mix(in srgb, var(--color-accent) 35%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-accent)',
          }}
        >
          <Sparkles size={11} />
        </motion.div>
      ) : (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
          style={{ display: 'flex', color: 'var(--color-accent)' }}
        >
          <Loader2 size={18} />
        </motion.div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--text-secondary)',
          }}
        >
          Processando seu clipboard
        </span>
        <span
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
          }}
        >
          A IA está analisando o conteúdo copiado...
        </span>
      </div>
    </motion.div>
  );
}
