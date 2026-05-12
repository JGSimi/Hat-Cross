import { DoorOpen, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Room } from '../../types/rooms';

interface Props {
  rooms: Room[];
  activeRoomId: string | null;
  onSelect: (roomId: string) => void;
  onOpenJoin: () => void;
}

export default function RoomList({ rooms, activeRoomId, onSelect, onOpenJoin }: Props) {
  const { t } = useTranslation('rooms');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
      <button type="button" onClick={onOpenJoin} style={newRoomButton}>
        <DoorOpen size={15} />
        {t('list.openJoin')}
      </button>

      <div style={{ display: 'grid', gap: 8, overflowY: 'auto', minHeight: 0 }}>
        {rooms.length === 0 ? (
          <div style={emptyStyle}>
            <Users size={18} />
            <strong>{t('list.emptyTitle')}</strong>
            <span>{t('list.emptyBody')}</span>
          </div>
        ) : (
          rooms.map((room) => {
            const active = room.id === activeRoomId;
            return (
              <button
                key={room.id}
                type="button"
                onClick={() => onSelect(room.id)}
                style={roomButtonStyle(active)}
              >
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {room.title}
                  </strong>
                  <small>{room.memberCount} {t('list.members')}</small>
                </span>
                <span style={statusPill}>{room.status}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

const newRoomButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '10px 12px',
  borderRadius: 7,
  border: 'none',
  background: 'var(--color-accent)',
  color: 'white',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 12,
};

const emptyStyle: React.CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  gap: 6,
  minHeight: 170,
  color: 'var(--text-muted)',
  border: '1px dashed var(--border-subtle)',
  borderRadius: 8,
  padding: 18,
  textAlign: 'center',
  fontSize: 12,
};

const statusPill: React.CSSProperties = {
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--color-accent) 24%, transparent)',
  color: 'var(--color-accent)',
  padding: '3px 7px',
  fontSize: 10,
  flexShrink: 0,
};

function roomButtonStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: 7,
    padding: '11px 12px',
    border: active
      ? '1px solid color-mix(in srgb, var(--color-accent) 38%, transparent)'
      : '1px solid var(--border-subtle)',
    background: active
      ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)'
      : 'var(--glass-secondary)',
    color: 'var(--text-strong)',
    cursor: 'pointer',
    textAlign: 'left',
  };
}
