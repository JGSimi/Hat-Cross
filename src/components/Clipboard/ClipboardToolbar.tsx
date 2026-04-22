import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft, Search, X, ArrowDownUp, Trash2,
  Clock, ArrowDown01, ArrowDownAZ, Check,
} from 'lucide-react';

export type SortMode = 'recent' | 'oldest' | 'alphabetical';

interface Props {
  onBack?: () => void;
  totalCount: number;
  filteredCount: number;
  searchValue: string;
  onSearchChange: (v: string) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  sortMode: SortMode;
  onSortChange: (m: SortMode) => void;
  hasEntries: boolean;
  onClearAll: () => void;
  confirmClear: boolean;
}

const SORT_OPTIONS: { id: SortMode; label: string; short: string; icon: React.ReactNode }[] = [
  { id: 'recent', label: 'Mais recentes', short: 'Recente', icon: <Clock size={13} /> },
  { id: 'oldest', label: 'Mais antigos', short: 'Antigo', icon: <ArrowDown01 size={13} /> },
  { id: 'alphabetical', label: 'Alfabético', short: 'A–Z', icon: <ArrowDownAZ size={13} /> },
];

export default function ClipboardToolbar({
  onBack,
  totalCount,
  filteredCount,
  searchValue,
  onSearchChange,
  searchInputRef,
  sortMode,
  onSortChange,
  hasEntries,
  onClearAll,
  confirmClear,
}: Props) {
  const [sortOpen, setSortOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const sortRef = useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();

  const currentSort = SORT_OPTIONS.find((s) => s.id === sortMode)!;
  const hasQuery = searchValue.length > 0;
  const filtered = filteredCount !== totalCount;

  useEffect(() => {
    if (!sortOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSortOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [sortOpen]);

  return (
    <div
      style={{
        padding: '14px 18px 12px',
        borderBottom: '0.5px solid var(--border-subtle)',
        background: 'color-mix(in srgb, var(--bg-secondary) 80%, transparent)',
        backdropFilter: 'blur(24px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
        position: 'sticky',
        top: 0,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexShrink: 0,
      }}
    >
      {onBack && (
        <motion.button
          whileHover={reduceMotion ? undefined : { scale: 1.08 }}
          whileTap={reduceMotion ? undefined : { scale: 0.92 }}
          onClick={onBack}
          aria-label="Voltar"
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: 'var(--glass-secondary)',
            border: '0.5px solid var(--glass-border-subtle)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <ArrowLeft size={15} />
        </motion.button>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <h2
          className="text-title"
          style={{ margin: 0, color: 'var(--text-primary)', lineHeight: 1.15 }}
        >
          Clipboard
        </h2>
        <p
          className="text-caption"
          style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.2 }}
        >
          {totalCount === 0
            ? 'Nenhum item'
            : filtered
            ? `${filteredCount} de ${totalCount} ${totalCount === 1 ? 'item' : 'itens'}`
            : `${totalCount} ${totalCount === 1 ? 'processamento' : 'processamentos'}`}
        </p>
      </div>

      <div style={{ flex: 1, minWidth: 8 }} />

      {/* Search */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '7px 11px',
          width: 260,
          minWidth: 160,
          maxWidth: 260,
          background: 'var(--input-bg, color-mix(in srgb, var(--text-primary) 4%, transparent))',
          border: `0.5px solid ${searchFocused ? 'var(--border-focused, var(--color-accent))' : 'var(--border-subtle)'}`,
          borderRadius: 8,
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          boxShadow: searchFocused
            ? '0 0 0 3px var(--accent-glow, color-mix(in srgb, var(--color-accent) 18%, transparent))'
            : 'none',
          flexShrink: 1,
        }}
      >
        <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          ref={searchInputRef}
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder={`Buscar em ${totalCount} ${totalCount === 1 ? 'clipboard' : 'clipboards'}...`}
          aria-label="Buscar no histórico de clipboard"
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 12.5,
            color: 'var(--text-primary)',
            background: 'transparent',
            border: 'none',
            fontFamily: 'inherit',
          }}
        />
        {hasQuery && (
          <motion.button
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            whileHover={reduceMotion ? undefined : { scale: 1.1 }}
            whileTap={reduceMotion ? undefined : { scale: 0.9 }}
            onClick={() => onSearchChange('')}
            aria-label="Limpar busca"
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(255,255,255,0.08)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              padding: 0,
            }}
          >
            <X size={10} />
          </motion.button>
        )}
      </div>

      {/* Sort dropdown */}
      <div ref={sortRef} style={{ position: 'relative', flexShrink: 0 }}>
        <motion.button
          whileHover={reduceMotion ? undefined : { scale: 1.03 }}
          whileTap={reduceMotion ? undefined : { scale: 0.97 }}
          onClick={() => setSortOpen((v) => !v)}
          aria-label="Ordenar"
          aria-haspopup="menu"
          aria-expanded={sortOpen}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            borderRadius: 7,
            background: sortOpen
              ? 'color-mix(in srgb, var(--color-accent) 15%, transparent)'
              : 'var(--glass-secondary)',
            border: `0.5px solid ${sortOpen ? 'color-mix(in srgb, var(--color-accent) 28%, transparent)' : 'var(--glass-border-subtle)'}`,
            color: sortOpen ? 'var(--color-accent)' : 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 500,
          }}
        >
          <ArrowDownUp size={13} />
          <span>{currentSort.short}</span>
        </motion.button>

        <AnimatePresence>
          {sortOpen && (
            <motion.div
              role="menu"
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ type: 'spring', stiffness: 400, damping: 26 }}
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                minWidth: 180,
                padding: '4px 0',
                background: 'var(--bg-secondary)',
                border: '0.5px solid var(--glass-border-subtle)',
                borderRadius: 10,
                boxShadow: 'var(--shadow-elevated, 0 12px 32px rgba(0,0,0,0.35))',
                zIndex: 100,
                transformOrigin: 'top right',
              }}
            >
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  role="menuitem"
                  onClick={() => {
                    onSortChange(opt.id);
                    setSortOpen(false);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 14px',
                    background: 'transparent',
                    border: 'none',
                    color: opt.id === sortMode ? 'var(--color-accent)' : 'var(--text-secondary)',
                    fontSize: 12.5,
                    fontWeight: opt.id === sortMode ? 600 : 400,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      'var(--color-surface-hover, rgba(255,255,255,0.06))';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  }}
                >
                  <span style={{ opacity: 0.8, display: 'flex' }}>{opt.icon}</span>
                  <span style={{ flex: 1 }}>{opt.label}</span>
                  {opt.id === sortMode && <Check size={13} />}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Clear all */}
      {hasEntries && (
        <motion.button
          whileHover={reduceMotion ? undefined : { scale: 1.03 }}
          whileTap={reduceMotion ? undefined : { scale: 0.97 }}
          onClick={onClearAll}
          aria-label={confirmClear ? 'Confirmar limpar tudo' : 'Limpar tudo'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 11px',
            borderRadius: 7,
            fontSize: 11.5,
            fontWeight: 500,
            background: confirmClear
              ? 'color-mix(in srgb, var(--error) 15%, transparent)'
              : 'rgba(255,255,255,0.04)',
            color: confirmClear ? 'var(--error)' : 'var(--text-muted)',
            border: confirmClear
              ? '0.5px solid color-mix(in srgb, var(--error) 30%, transparent)'
              : '0.5px solid rgba(255,255,255,0.06)',
            cursor: 'pointer',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          <Trash2 size={12} />
          {confirmClear ? 'Confirmar?' : 'Limpar tudo'}
        </motion.button>
      )}
    </div>
  );
}
