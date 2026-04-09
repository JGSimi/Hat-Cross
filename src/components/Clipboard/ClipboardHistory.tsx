import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clipboard, Copy, Check, MessageSquarePlus, Trash2, Clock, Cpu, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { useClipboardStore } from '../../stores/clipboardStore';
import { useConversationStore } from '../../stores/conversationStore';
import { useChatStore } from '../../stores/chatStore';
import type { ClipboardEntry, Message } from '../../types';

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);

  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (d >= today) return `Hoje ${time}`;
  if (d >= yesterday) return `Ontem ${time}`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ` ${time}`;
}

function ClipboardCard({ entry, onOpenInChat, onDelete }: {
  entry: ClipboardEntry;
  onOpenInChat: () => void;
  onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(entry.response);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete) {
      onDelete();
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 2500);
    }
  };

  const previewText = entry.originalText.length > 120
    ? entry.originalText.slice(0, 120) + '...'
    : entry.originalText;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      onClick={() => setExpanded(!expanded)}
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14,
        padding: 0,
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'border-color 0.2s ease',
      }}
      whileHover={{ borderColor: 'rgba(255,255,255,0.12)' }}
    >
      {/* Header strip */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        background: 'color-mix(in srgb, var(--color-accent) 5%, transparent)',
        borderBottom: expanded ? '1px solid rgba(255,255,255,0.04)' : 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6,
            background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Clipboard size={11} style={{ color: 'var(--color-accent)' }} />
          </div>
          <p style={{
            fontSize: 11, color: 'var(--text-secondary)', margin: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {previewText}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 9, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Clock size={8} />
            {formatTime(entry.timestamp)}
          </span>
        </div>
      </div>

      {/* Response preview (always visible) */}
      {!expanded && (
        <div style={{ padding: '10px 14px' }}>
          <p style={{
            fontSize: 12, color: 'var(--text-normal)', margin: 0,
            lineHeight: 1.5, overflow: 'hidden',
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
          }}>
            {entry.response.replace(/[#*`_]/g, '').slice(0, 200)}
          </p>
        </div>
      )}

      {/* Expanded view */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            {/* Original text */}
            <div style={{
              padding: '12px 14px',
              background: 'rgba(0,0,0,0.15)',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>
              <p style={{
                fontSize: 9, fontWeight: 600, color: 'var(--text-dim)',
                textTransform: 'uppercase', letterSpacing: 0.8, margin: '0 0 6px',
              }}>
                Texto original
              </p>
              <p style={{
                fontSize: 11.5, color: 'var(--text-muted)', margin: 0,
                lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                maxHeight: 120, overflowY: 'auto',
              }}>
                {entry.originalText}
              </p>
            </div>

            {/* AI Response */}
            <div style={{ padding: '12px 14px' }}>
              <p style={{
                fontSize: 9, fontWeight: 600, color: 'var(--color-accent)',
                textTransform: 'uppercase', letterSpacing: 0.8, margin: '0 0 6px',
                opacity: 0.7,
              }}>
                Resposta da IA
              </p>
              <div
                className="prose prose-invert prose-sm max-w-none"
                style={{
                  fontSize: 12, lineHeight: 1.6, color: 'var(--text-normal)',
                  wordBreak: 'break-word', maxHeight: 300, overflowY: 'auto',
                }}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                  {entry.response}
                </ReactMarkdown>
              </div>
            </div>

            {/* Footer with model info + actions */}
            <div style={{
              padding: '8px 14px 10px',
              borderTop: '1px solid rgba(255,255,255,0.04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(0,0,0,0.08)',
            }}>
              <span style={{
                fontSize: 9, color: 'var(--text-dim)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <Cpu size={9} />
                {entry.model || entry.provider}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <ActionButton
                  icon={confirmDelete ? <X size={11} /> : <Trash2 size={11} />}
                  label={confirmDelete ? 'Certeza?' : 'Excluir'}
                  onClick={handleDelete}
                  danger={confirmDelete}
                />
                <ActionButton
                  icon={copied ? <Check size={11} /> : <Copy size={11} />}
                  label={copied ? 'Copiado' : 'Copiar'}
                  onClick={handleCopy}
                  active={copied}
                />
                <ActionButton
                  icon={<MessageSquarePlus size={11} />}
                  label="Abrir no Chat"
                  onClick={(e) => { e.stopPropagation(); onOpenInChat(); }}
                  primary
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ActionButton({ icon, label, onClick, primary, danger, active }: {
  icon: React.ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  primary?: boolean;
  danger?: boolean;
  active?: boolean;
}) {
  const bg = danger
    ? 'color-mix(in srgb, var(--error) 15%, transparent)'
    : primary
      ? 'color-mix(in srgb, var(--color-accent) 15%, transparent)'
      : active
        ? 'color-mix(in srgb, var(--success) 12%, transparent)'
        : 'rgba(255,255,255,0.04)';
  const color = danger
    ? 'var(--error)'
    : primary
      ? 'var(--color-accent)'
      : active
        ? 'var(--success)'
        : 'var(--text-muted)';
  const border = danger
    ? '1px solid color-mix(in srgb, var(--error) 25%, transparent)'
    : primary
      ? '1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)'
      : '1px solid rgba(255,255,255,0.06)';

  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '4px 8px', borderRadius: 6,
        fontSize: 9, fontWeight: 500,
        background: bg, color, border,
        cursor: 'pointer',
      }}
    >
      {icon}
      {label}
    </motion.button>
  );
}

export default function ClipboardHistory() {
  const entries = useClipboardStore((s) => s.entries);
  const deleteEntry = useClipboardStore((s) => s.deleteEntry);
  const clearAll = useClipboardStore((s) => s.clearAll);
  const createConversation = useConversationStore((s) => s.createConversation);
  const addMessageToConversation = useConversationStore((s) => s.addMessageToConversation);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleOpenInChat = (entry: ClipboardEntry) => {
    const userMsg: Message = {
      id: crypto.randomUUID(),
      content: entry.originalText,
      isUser: true,
      timestamp: entry.timestamp,
      source: 'clipboard',
    };
    const aiMsg: Message = {
      id: crypto.randomUUID(),
      content: entry.response,
      isUser: false,
      timestamp: entry.timestamp + 1,
      source: 'clipboard',
    };
    const conv = createConversation(userMsg);
    addMessageToConversation(conv.id, aiMsg);
    useChatStore.getState().loadFromConversation(conv.id);
  };

  const handleClearAll = () => {
    if (confirmClear) {
      clearAll();
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
    }
  };

  if (entries.length === 0) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 32, textAlign: 'center',
      }}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'color-mix(in srgb, var(--color-accent) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-accent) 12%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Clipboard size={24} style={{ color: 'var(--color-accent)', opacity: 0.5 }} />
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 6px' }}>
            Nenhum clipboard processado
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, maxWidth: 220 }}>
            Copie um texto e pressione o atalho de clipboard para processar com a IA
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px 10px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Clipboard
          </h2>
          <p style={{ fontSize: 10, color: 'var(--text-dim)', margin: '2px 0 0' }}>
            {entries.length} {entries.length === 1 ? 'processamento' : 'processamentos'}
          </p>
        </div>
        {entries.length > 0 && (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleClearAll}
            style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 9, fontWeight: 500,
              background: confirmClear
                ? 'color-mix(in srgb, var(--error) 15%, transparent)'
                : 'rgba(255,255,255,0.04)',
              color: confirmClear ? 'var(--error)' : 'var(--text-muted)',
              border: confirmClear
                ? '1px solid color-mix(in srgb, var(--error) 25%, transparent)'
                : '1px solid rgba(255,255,255,0.06)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Trash2 size={9} />
            {confirmClear ? 'Confirmar limpar tudo' : 'Limpar tudo'}
          </motion.button>
        )}
      </div>

      {/* Cards list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <AnimatePresence>
          {entries.map((entry) => (
            <ClipboardCard
              key={entry.id}
              entry={entry}
              onOpenInChat={() => handleOpenInChat(entry)}
              onDelete={() => deleteEntry(entry.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
