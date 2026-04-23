import { memo, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import {
  Clipboard, ImageIcon, Clock, Cpu, Pin, ChevronRight,
  Copy, Check, Trash2, MessageSquarePlus, FileText, Sparkles, X,
} from 'lucide-react';
import type { ClipboardEntry } from '../../types';
import ClipboardImageThumb from './ClipboardImageThumb';
import { formatTime, formatFullTimestamp, highlightMatch, stripMarkdown } from '../../utils/clipboardSearch';

interface Props {
  entry: ClipboardEntry;
  index: number;
  isFocused: boolean;
  isExpanded: boolean;
  confirmDelete: boolean;
  searchQuery: string;
  onToggleExpand: () => void;
  onCopyResponse: () => void;
  onCopyOriginal: () => void;
  onOpenInChat: () => void;
  onTogglePin: () => void;
  onRequestDelete: () => void;
  onContextMenu: (x: number, y: number) => void;
  onFocus: () => void;
}

function ClipboardCardInner({
  entry,
  index,
  isFocused,
  isExpanded,
  confirmDelete,
  searchQuery,
  onToggleExpand,
  onCopyResponse,
  onCopyOriginal,
  onOpenInChat,
  onTogglePin,
  onRequestDelete,
  onContextMenu,
  onFocus,
}: Props) {
  const reduceMotion = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const isPinned = !!entry.isPinned;
  const hasImages = !!entry.images && entry.images.length > 0;
  const imageCount = entry.images?.length ?? 0;

  useEffect(() => {
    if (isFocused && rootRef.current) {
      rootRef.current.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
      rootRef.current.focus({ preventScroll: true });
    }
  }, [isFocused, reduceMotion]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopyResponse();
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e.clientX, e.clientY);
  };

  const handleTogglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTogglePin();
  };

  const responsePreview = stripMarkdown(entry.response).slice(0, 240) || 'Sem resposta';
  const originalPreview =
    entry.originalText && entry.originalText !== '(imagem)'
      ? entry.originalText
      : hasImages
      ? `Imagem${imageCount > 1 ? `s (${imageCount})` : ''}`
      : '—';

  const borderColor = isFocused
    ? 'var(--color-accent)'
    : hovered
    ? 'color-mix(in srgb, var(--color-accent) 30%, transparent)'
    : isPinned
    ? 'color-mix(in srgb, var(--color-accent) 35%, transparent)'
    : 'var(--border-subtle)';

  const staggerDelay = reduceMotion ? 0 : Math.min(0.03 * index, 0.6);

  return (
    <motion.article
      ref={rootRef}
      layout="position"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.96 }}
      transition={
        reduceMotion
          ? { duration: 0.12 }
          : { type: 'spring', stiffness: 300, damping: 25, delay: staggerDelay }
      }
      onClick={onToggleExpand}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggleExpand();
        }
      }}
      onFocus={onFocus}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onContextMenu={handleContextMenu}
      // `<article>` keeps the semantic "independent piece of content" role
      // (each clipboard entry is self-contained). We deliberately don't
      // promote it to role="button" because the expanded footer hosts real
      // buttons (pin, copy, original, chat, delete) and axe correctly flags
      // nested-interactive + aria-allowed-role when a button wraps buttons.
      // tabIndex + keydown give keyboard users the Enter/Space toggle, and
      // the nav-level shortcuts (j/k/Enter) in ClipboardHistory still work.
      aria-label={`Clipboard de ${formatTime(entry.timestamp)}${isPinned ? ', fixado' : ''}${
        isExpanded ? ', expandido' : ', recolhido'
      }`}
      tabIndex={0}
      style={{
        position: 'relative',
        borderRadius: 14,
        overflow: 'hidden',
        cursor: 'pointer',
        background:
          'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 3%, transparent), color-mix(in srgb, var(--text-primary) 2%, transparent))',
        border: `0.5px solid ${borderColor}`,
        boxShadow: isFocused
          ? '0 0 0 2px var(--color-accent), 0 4px 18px color-mix(in srgb, var(--color-accent) 18%, transparent)'
          : hovered
          ? '0 2px 14px color-mix(in srgb, var(--color-accent) 12%, transparent)'
          : 'none',
        transition: 'border-color 0.18s ease, box-shadow 0.2s ease',
        outline: 'none',
      }}
    >
      {/* Pinned edge indicator */}
      {isPinned && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            top: 10,
            bottom: 10,
            width: 2,
            borderRadius: 2,
            background: 'var(--color-accent)',
            opacity: 0.9,
          }}
        />
      )}

      {/* Row 1 — Original preview */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px 8px',
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
            border: '0.5px solid color-mix(in srgb, var(--color-accent) 18%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: 'var(--color-accent)',
          }}
        >
          {hasImages ? <ImageIcon size={13} /> : <Clipboard size={13} />}
        </div>
        <p
          className="text-body-small"
          style={{
            margin: 0,
            color: 'var(--text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            minWidth: 0,
          }}
        >
          {highlightMatch(originalPreview, searchQuery)}
        </p>
      </div>

      {/* Separator */}
      <div
        aria-hidden
        style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '0 14px' }}
      />

      {/* Row 2 — Response preview */}
      <div style={{ padding: '8px 14px' }}>
        <p
          className="text-body"
          style={{
            margin: 0,
            color: 'var(--text-normal, var(--text-primary))',
            lineHeight: 1.55,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            opacity: entry.response ? 1 : 0.55,
            fontStyle: entry.response ? 'normal' : 'italic',
          }}
        >
          {highlightMatch(responsePreview, searchQuery)}
        </p>
      </div>

      {/* Row 3 — Meta + actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px 11px 14px',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.04)',
            border: '0.5px solid rgba(255,255,255,0.06)',
            fontSize: 10.5,
            color: 'var(--text-muted)',
            maxWidth: 180,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
          aria-label={`Modelo ${entry.model || entry.provider}`}
        >
          <Cpu size={10} />
          {entry.model || entry.provider}
        </span>

        <motion.button
          whileHover={reduceMotion ? undefined : { scale: 1.15 }}
          whileTap={reduceMotion ? undefined : { scale: 0.9 }}
          onClick={handleTogglePin}
          aria-label={isPinned ? 'Desafixar' : 'Fixar'}
          aria-pressed={isPinned}
          animate={{ opacity: isPinned || hovered || isFocused ? 1 : 0 }}
          transition={{ duration: 0.15 }}
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            border: 'none',
            background: isPinned ? 'color-mix(in srgb, var(--color-accent) 15%, transparent)' : 'transparent',
            color: isPinned ? 'var(--color-accent)' : 'var(--text-dim, var(--text-muted))',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            padding: 0,
          }}
        >
          <Pin size={11} style={{ transform: 'rotate(38deg)' }} />
        </motion.button>

        {hasImages && entry.images && (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <ClipboardImageThumb base64={entry.images[0]} size={24} alt="Prévia" />
            {imageCount > 1 && (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  bottom: -3,
                  right: -3,
                  minWidth: 14,
                  height: 14,
                  padding: '0 3px',
                  borderRadius: 7,
                  background: 'rgba(0,0,0,0.75)',
                  color: 'white',
                  fontSize: 9,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                  border: '0.5px solid rgba(255,255,255,0.2)',
                }}
              >
                +{imageCount - 1}
              </span>
            )}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 4 }} />

        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 10.5,
            color: 'var(--text-dim, var(--text-muted))',
            fontVariantNumeric: 'tabular-nums',
            flexShrink: 0,
          }}
          title={formatFullTimestamp(entry.timestamp)}
        >
          <Clock size={10} />
          {formatTime(entry.timestamp)}
        </span>

        <motion.div
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={
            reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 28 }
          }
          style={{
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
          }}
          aria-hidden
        >
          <ChevronRight size={14} />
        </motion.div>
      </div>

      {/* Expanded view */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={
              reduceMotion
                ? { duration: 0.15 }
                : { type: 'spring', stiffness: 280, damping: 26 }
            }
            style={{ overflow: 'hidden' }}
          >
            {/* Original panel */}
            <div
              style={{
                padding: '14px 16px',
                background: 'rgba(0,0,0,0.18)',
                borderTop: '0.5px solid rgba(255,255,255,0.05)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  marginBottom: 10,
                  color: 'var(--text-muted)',
                }}
              >
                {hasImages ? <ImageIcon size={11} /> : <FileText size={11} />}
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 0.9,
                  }}
                >
                  {hasImages ? 'Conteúdo original' : 'Texto original'}
                </span>
              </div>
              {hasImages && entry.images && (
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    marginBottom:
                      entry.originalText && entry.originalText !== '(imagem)' ? 10 : 0,
                    flexWrap: 'wrap',
                  }}
                >
                  {entry.images.map((img, i) => (
                    <img
                      key={i}
                      src={`data:image/png;base64,${img}`}
                      alt={`Clipboard imagem ${i + 1}`}
                      style={{
                        maxWidth: 200,
                        maxHeight: 140,
                        borderRadius: 8,
                        border: '0.5px solid rgba(255,255,255,0.1)',
                        objectFit: 'contain',
                      }}
                    />
                  ))}
                </div>
              )}
              {entry.originalText && entry.originalText !== '(imagem)' && (
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: 'var(--text-normal, var(--text-secondary))',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: 160,
                    overflowY: 'auto',
                    maskImage:
                      'linear-gradient(to bottom, transparent 0, black 8px, black calc(100% - 8px), transparent 100%)',
                    WebkitMaskImage:
                      'linear-gradient(to bottom, transparent 0, black 8px, black calc(100% - 8px), transparent 100%)',
                  }}
                >
                  {entry.originalText}
                </p>
              )}
            </div>

            {/* AI response panel */}
            <div style={{ padding: '14px 16px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  marginBottom: 10,
                  color: 'var(--color-accent)',
                }}
              >
                <Sparkles size={11} />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 0.9,
                  }}
                >
                  Resposta da IA
                </span>
              </div>
              <div
                className="prose prose-invert prose-sm max-w-none"
                style={{
                  fontSize: 13,
                  lineHeight: 1.65,
                  color: 'var(--text-normal, var(--text-primary))',
                  wordBreak: 'break-word',
                  maxHeight: 360,
                  overflowY: 'auto',
                  maskImage:
                    'linear-gradient(to bottom, transparent 0, black 10px, black calc(100% - 10px), transparent 100%)',
                  WebkitMaskImage:
                    'linear-gradient(to bottom, transparent 0, black 10px, black calc(100% - 10px), transparent 100%)',
                }}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                  {entry.response || '_Sem resposta_'}
                </ReactMarkdown>
              </div>
            </div>

            {/* Footer — timestamp + actions */}
            <div
              style={{
                padding: '10px 14px 12px',
                borderTop: '0.5px solid rgba(255,255,255,0.05)',
                background:
                  'linear-gradient(to top, color-mix(in srgb, var(--color-accent) 3%, transparent), transparent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--text-dim, var(--text-muted))',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  minWidth: 0,
                }}
              >
                <Clock size={11} />
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatFullTimestamp(entry.timestamp)}
                </span>
                <span style={{ opacity: 0.5 }}>·</span>
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {entry.model || entry.provider}
                </span>
              </span>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <ActionButton
                  icon={<Pin size={13} style={{ transform: 'rotate(38deg)' }} />}
                  label={isPinned ? 'Desafixar' : 'Fixar'}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePin();
                  }}
                  active={isPinned}
                />
                <ActionButton
                  icon={<FileText size={13} />}
                  label="Original"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCopyOriginal();
                  }}
                />
                <ActionButton
                  icon={copied ? <Check size={13} /> : <Copy size={13} />}
                  label={copied ? 'Copiado' : 'Copiar'}
                  onClick={handleCopy}
                  active={copied}
                />
                <ActionButton
                  icon={<MessageSquarePlus size={13} />}
                  label="Abrir no Chat"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenInChat();
                  }}
                  primary
                />
                <ActionButton
                  icon={confirmDelete ? <X size={13} /> : <Trash2 size={13} />}
                  label={confirmDelete ? 'Confirmar?' : 'Excluir'}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRequestDelete();
                  }}
                  danger={confirmDelete}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  primary,
  danger,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  primary?: boolean;
  danger?: boolean;
  active?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const bg = danger
    ? 'color-mix(in srgb, var(--error) 15%, transparent)'
    : primary
    ? 'color-mix(in srgb, var(--color-accent) 15%, transparent)'
    : active
    ? 'color-mix(in srgb, var(--success) 14%, transparent)'
    : 'rgba(255,255,255,0.04)';
  const color = danger
    ? 'var(--error)'
    : primary
    ? 'var(--color-accent)'
    : active
    ? 'var(--success)'
    : 'var(--text-secondary)';
  const border = danger
    ? '0.5px solid color-mix(in srgb, var(--error) 28%, transparent)'
    : primary
    ? '0.5px solid color-mix(in srgb, var(--color-accent) 28%, transparent)'
    : active
    ? '0.5px solid color-mix(in srgb, var(--success) 25%, transparent)'
    : '0.5px solid rgba(255,255,255,0.06)';

  return (
    <motion.button
      whileHover={reduceMotion ? undefined : { scale: 1.04 }}
      whileTap={reduceMotion ? undefined : { scale: 0.96 }}
      onClick={onClick}
      aria-label={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 7,
        fontSize: 11.5,
        fontWeight: 500,
        background: bg,
        color,
        border,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {label}
    </motion.button>
  );
}

const ClipboardCard = memo(ClipboardCardInner, (prev, next) => {
  return (
    prev.entry.id === next.entry.id &&
    prev.entry.isPinned === next.entry.isPinned &&
    prev.entry.timestamp === next.entry.timestamp &&
    prev.entry.response === next.entry.response &&
    prev.isFocused === next.isFocused &&
    prev.isExpanded === next.isExpanded &&
    prev.confirmDelete === next.confirmDelete &&
    prev.searchQuery === next.searchQuery &&
    prev.index === next.index
  );
});

export default ClipboardCard;
