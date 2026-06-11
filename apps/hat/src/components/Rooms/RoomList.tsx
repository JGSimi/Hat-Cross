import type { Room } from '../../domain/rooms/types';

const STATUS_META: Record<Room['status'], { label: string; dot: string }> = {
  open: { label: 'aberta', dot: 'var(--color-consensus)' },
  locked: { label: 'trancada', dot: 'var(--color-divergence)' },
  ended: { label: 'encerrada', dot: 'var(--color-text-muted)' },
};

interface RoomListProps {
  rooms: Room[];
  onOpen: (roomId: string) => void;
}

/**
 * Lista de salas como linhas de instrumento: hairline entre itens, ponto de
 * status, contagem em mono. Sem cards gordos — discrição é o produto.
 */
export function RoomList({ rooms, onOpen }: RoomListProps) {
  return (
    <ul className="m-0 list-none p-0" data-testid="room-list">
      {rooms.map((room, i) => {
        const status = STATUS_META[room.status];
        return (
          <li key={room.id} className="hat-rise" style={{ animationDelay: `${i * 50}ms` }}>
            <button
              type="button"
              onClick={() => onOpen(room.id)}
              className="hat-row group flex w-full cursor-pointer items-baseline gap-3 border-0 border-b border-solid border-b-hairline bg-transparent px-1 py-3.5 text-left hover:bg-surface-raised"
            >
              <span
                aria-hidden
                className="inline-block size-1.5 shrink-0 self-center rounded-full"
                style={{ background: status.dot }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] text-text-primary">
                  {room.title}
                </span>
                <span className="mt-0.5 block font-mono text-[10px] tracking-[0.12em] text-text-muted uppercase">
                  {status.label}
                </span>
              </span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-secondary">
                {room.memberCount}{' '}
                <span className="text-text-muted">{room.memberCount === 1 ? 'membro' : 'membros'}</span>
              </span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-muted">
                {room.joinCost} cr
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
