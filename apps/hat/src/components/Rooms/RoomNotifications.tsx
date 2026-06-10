import type { RoomNotification } from '../../domain/rooms/types';

interface RoomNotificationsProps {
  notifications: RoomNotification[];
  onRead: (id: string) => void;
}

/**
 * Avisos da sala como linhas de ticker — não-lidos em âmbar pleno, lidos
 * esmaecidos. Clicar marca como lido.
 */
export function RoomNotifications({ notifications, onRead }: RoomNotificationsProps) {
  if (notifications.length === 0) return null;

  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0" data-testid="room-notifications">
      {notifications.map((notification) => {
        const unread = notification.readAt === undefined;
        return (
          <li key={notification.id}>
            <button
              type="button"
              onClick={() => onRead(notification.id)}
              title={unread ? 'Marcar como lida' : undefined}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-sm border-0 bg-transparent px-2 py-1.5 text-left transition-opacity duration-200"
              style={{ opacity: unread ? 1 : 0.4 }}
            >
              <span
                aria-hidden
                className={`inline-block size-1.5 shrink-0 rounded-full ${unread ? 'hat-pulse' : ''}`}
                style={{
                  background:
                    notification.severity === 'warning'
                      ? 'var(--color-divergence)'
                      : 'var(--color-state-info)',
                }}
              />
              <span className="min-w-0 flex-1 truncate text-[12px] text-text-secondary">
                {notification.message}
              </span>
              {unread && (
                <span className="shrink-0 font-mono text-[9px] tracking-[0.15em] text-text-muted uppercase">
                  nova
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
