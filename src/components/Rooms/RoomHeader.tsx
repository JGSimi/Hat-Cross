import { Copy, LogOut, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Room } from '../../types/rooms';
import { useToastStore } from '../../stores/toastStore';

interface Props {
  room: Room;
  leaving?: boolean;
  onLeave: () => void;
}

export default function RoomHeader({ room, leaving = false, onLeave }: Props) {
  const { t } = useTranslation('rooms');

  const copyRoomId = () => {
    navigator.clipboard.writeText(room.id);
    useToastStore.getState().showToast(t('header.copied'), 'success');
  };

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      padding: '14px 16px',
      borderBottom: '1px solid var(--border-subtle)',
      flexShrink: 0,
    }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ margin: 0, color: 'var(--text-strong)', fontSize: 17, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {room.title}
        </h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 5, color: 'var(--text-muted)', fontSize: 11 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Users size={12} />
            {room.memberCount} {t('header.members')}
          </span>
          <code style={{ color: 'var(--text-dim)', fontSize: 10 }}>{room.id}</code>
        </div>
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button type="button" onClick={copyRoomId} aria-label={t('header.copyId')} style={iconButton}>
          <Copy size={14} />
        </button>
        <button
          type="button"
          onClick={onLeave}
          disabled={leaving}
          aria-label={t('header.leave')}
          style={{ ...iconButton, color: 'var(--error)', cursor: leaving ? 'wait' : 'pointer' }}
        >
          <LogOut size={14} />
        </button>
      </div>
    </header>
  );
}

const iconButton: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 7,
  border: '1px solid var(--border-subtle)',
  background: 'var(--glass-secondary)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  display: 'grid',
  placeItems: 'center',
  flexShrink: 0,
};
