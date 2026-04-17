import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Copy, FileText, CopyCheck, MessageSquarePlus, Pin, PinOff, Trash2 } from 'lucide-react';

export interface ContextMenuActions {
  onCopyResponse: () => void;
  onCopyOriginal: () => void;
  onCopyBoth: () => void;
  onOpenInChat: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
}

interface Props extends ContextMenuActions {
  x: number;
  y: number;
  isPinned: boolean;
  onClose: () => void;
}

const MENU_WIDTH = 200;
const ESTIMATED_HEIGHT = 280;
const EDGE_MARGIN = 8;

export default function ClipboardContextMenu({
  x,
  y,
  isPinned,
  onClose,
  onCopyResponse,
  onCopyOriginal,
  onCopyBoth,
  onOpenInChat,
  onTogglePin,
  onDelete,
}: Props) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ x, y });

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const width = rect.width || MENU_WIDTH;
    const height = rect.height || ESTIMATED_HEIGHT;
    let nx = x;
    let ny = y;
    if (nx + width + EDGE_MARGIN > window.innerWidth) {
      nx = Math.max(EDGE_MARGIN, window.innerWidth - width - EDGE_MARGIN);
    }
    if (ny + height + EDGE_MARGIN > window.innerHeight) {
      ny = Math.max(EDGE_MARGIN, window.innerHeight - height - EDGE_MARGIN);
    }
    setPosition({ x: nx, y: ny });
  }, [x, y]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    const onResize = () => onClose();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [onClose]);

  const items: Array<
    | { type: 'separator' }
    | { type: 'item'; label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }
  > = [
    { type: 'item', label: 'Copiar resposta', icon: <Copy size={14} />, onClick: onCopyResponse },
    { type: 'item', label: 'Copiar original', icon: <FileText size={14} />, onClick: onCopyOriginal },
    { type: 'item', label: 'Copiar ambos', icon: <CopyCheck size={14} />, onClick: onCopyBoth },
    {
      type: 'item',
      label: 'Abrir no Chat',
      icon: <MessageSquarePlus size={14} />,
      onClick: onOpenInChat,
    },
    {
      type: 'item',
      label: isPinned ? 'Desafixar' : 'Fixar',
      icon: isPinned ? <PinOff size={14} /> : <Pin size={14} />,
      onClick: onTogglePin,
    },
    { type: 'separator' },
    {
      type: 'item',
      label: 'Excluir',
      icon: <Trash2 size={14} />,
      onClick: onDelete,
      danger: true,
    },
  ];

  const handleSelect = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return (
    <motion.div
      ref={ref}
      role="menu"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -4 }}
      transition={
        reduceMotion
          ? { duration: 0.1 }
          : { type: 'spring', stiffness: 400, damping: 26 }
      }
      style={{
        position: 'fixed',
        top: position.y,
        left: position.x,
        minWidth: MENU_WIDTH,
        padding: '4px 0',
        background: 'var(--bg-secondary)',
        border: '0.5px solid var(--glass-border-subtle)',
        borderRadius: 10,
        boxShadow: 'var(--shadow-elevated, 0 16px 40px rgba(0,0,0,0.4))',
        zIndex: 1000,
        transformOrigin: 'top left',
      }}
    >
      {items.map((item, i) => {
        if (item.type === 'separator') {
          return (
            <div
              key={`sep-${i}`}
              aria-hidden
              style={{
                height: 0.5,
                background: 'var(--glass-border-subtle)',
                margin: '4px 0',
              }}
            />
          );
        }
        return (
          <button
            key={item.label}
            role="menuitem"
            onClick={handleSelect(item.onClick)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 14px',
              background: 'transparent',
              border: 'none',
              color: item.danger ? 'var(--error)' : 'var(--text-secondary)',
              fontSize: 12.5,
              fontWeight: 500,
              fontFamily: 'inherit',
              textAlign: 'left',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = item.danger
                ? 'color-mix(in srgb, var(--error) 14%, transparent)'
                : 'var(--color-surface-hover, rgba(255,255,255,0.06))';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            <span style={{ display: 'flex', opacity: 0.85 }}>{item.icon}</span>
            <span style={{ flex: 1 }}>{item.label}</span>
          </button>
        );
      })}
    </motion.div>
  );
}
