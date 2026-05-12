import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DoorOpen, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ROOM_JOIN_COST } from '../../types/rooms';

interface Props {
  open: boolean;
  credits: number;
  busy: boolean;
  onClose: () => void;
  onCreate: (title: string) => void;
  onJoin: (roomId: string) => void;
}

export default function RoomJoinModal({ open, credits, busy, onClose, onCreate, onJoin }: Props) {
  const { t } = useTranslation('rooms');
  const [title, setTitle] = useState('');
  const [roomId, setRoomId] = useState('');
  const canPay = credits >= ROOM_JOIN_COST;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose, open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !busy) onClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="room-join-title"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            onMouseDown={(event) => event.stopPropagation()}
            style={{
              width: 'min(520px, 100%)',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <h2 id="room-join-title" style={{ margin: 0, fontSize: 15, color: 'var(--text-strong)' }}>{t('join.title')}</h2>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                  {t('join.cost', { count: ROOM_JOIN_COST.toLocaleString() })}
                </p>
              </div>
              <button type="button" onClick={onClose} aria-label={t('common.close')} style={iconButtonStyle}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: 16, display: 'grid', gap: 14 }}>
              <div style={balanceStyle(canPay)}>
                <span>{t('join.balance')}</span>
                <strong>{credits.toLocaleString()} cr</strong>
              </div>

              {!canPay && (
                <div style={{ fontSize: 12, color: 'var(--error)', background: 'color-mix(in srgb, var(--error) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--error) 22%, transparent)', borderRadius: 6, padding: 10 }}>
                  {t('join.notEnough')}
                </div>
              )}

              <label style={labelStyle}>
                <span>{t('join.createLabel')}</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={t('join.createPlaceholder')}
                  autoFocus
                  style={inputStyle}
                />
              </label>
              <button
                type="button"
                disabled={!canPay || busy}
                onClick={() => onCreate(title)}
                style={primaryButtonStyle(!canPay || busy)}
              >
                <Plus size={14} />
                {t('join.create')}
              </button>

              <div style={{ height: 1, background: 'var(--border-subtle)' }} />

              <label style={labelStyle}>
                <span>{t('join.codeLabel')}</span>
                <input
                  value={roomId}
                  onChange={(event) => setRoomId(event.target.value.trim())}
                  placeholder={t('join.codePlaceholder')}
                  style={inputStyle}
                />
              </label>
              <button
                type="button"
                disabled={!canPay || busy || !roomId}
                onClick={() => onJoin(roomId)}
                style={secondaryButtonStyle(!canPay || busy || !roomId)}
              >
                <DoorOpen size={14} />
                {t('join.enter')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const iconButtonStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 6,
  border: '1px solid var(--border-subtle)',
  background: 'transparent',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  display: 'grid',
  placeItems: 'center',
};

const labelStyle: React.CSSProperties = {
  display: 'grid',
  gap: 6,
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-secondary)',
};

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-input)',
  color: 'var(--text-strong)',
  border: '1px solid var(--border-input)',
  borderRadius: 7,
  padding: '10px 12px',
  fontSize: 13,
};

function balanceStyle(canPay: boolean): React.CSSProperties {
  return {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 12,
    color: canPay ? 'var(--text-secondary)' : 'var(--error)',
    background: 'var(--glass-secondary)',
    border: '1px solid var(--glass-border-subtle)',
    borderRadius: 7,
    padding: '10px 12px',
  };
}

function primaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    border: 'none',
    borderRadius: 7,
    padding: '10px 12px',
    fontSize: 12,
    fontWeight: 700,
    background: disabled ? 'rgba(255,255,255,0.05)' : 'var(--color-accent)',
    color: disabled ? 'var(--text-muted)' : 'white',
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

function secondaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    ...primaryButtonStyle(disabled),
    background: disabled ? 'rgba(255,255,255,0.05)' : 'var(--glass-secondary)',
    color: disabled ? 'var(--text-muted)' : 'var(--text-strong)',
    border: disabled ? 'none' : '1px solid var(--glass-border-subtle)',
  };
}
