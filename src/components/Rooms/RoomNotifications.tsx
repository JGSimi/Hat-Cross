import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { RoomNotification } from '../../types/rooms';

interface Props {
  notifications: RoomNotification[];
  onRead: (notificationId: string) => void;
}

export default function RoomNotifications({ notifications, onRead }: Props) {
  const { t } = useTranslation('rooms');
  const unread = notifications.filter((item) => !item.readAt);
  if (unread.length === 0) return null;

  return (
    <section style={{ display: 'grid', gap: 8 }}>
      <h2 style={titleStyle}>{t('notifications.title')}</h2>
      {unread.map((item) => (
        <button key={item.id} type="button" onClick={() => onRead(item.id)} style={notificationStyle}>
          <AlertTriangle size={14} style={{ color: 'var(--warning)', flexShrink: 0 }} />
          <span style={{ minWidth: 0 }}>{item.message || t('notifications.default')}</span>
        </button>
      ))}
    </section>
  );
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: 0.8,
};

const notificationStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  width: '100%',
  border: '1px solid color-mix(in srgb, var(--warning) 24%, transparent)',
  borderRadius: 7,
  background: 'color-mix(in srgb, var(--warning) 10%, transparent)',
  color: 'var(--text-strong)',
  padding: 10,
  textAlign: 'left',
  cursor: 'pointer',
  fontSize: 12,
  lineHeight: 1.35,
};
